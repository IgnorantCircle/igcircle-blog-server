import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import matter from 'gray-matter';
import * as path from 'path';
import { Article } from '@/entities/article.entity';
import { Tag } from '@/entities/tag.entity';
import { Category } from '@/entities/category.entity';
import { User } from '@/entities/user.entity';
import { ArticleService } from './article.service';
import { TagService } from './tag.service';
import { CategoryService } from './category.service';
import {
  ArticleImportConfigDto,
  ArticleImportResponseDto,
  ArticleImportResultDto,
  ParsedArticleData,
  FileValidationResult,
  ImportProgressDto,
  ImportStatus,
  StartImportResponseDto,
} from '@/dto/article-import.dto';
import {
  BusinessException,
  ValidationException,
} from '@/common/exceptions/business.exception';
import { ErrorCode } from '@/common/constants/error-codes';

// 基于Article实体的Frontmatter接口定义
interface ArticleFrontmatter
  extends Partial<
    Pick<
      Article,
      | 'title'
      | 'summary'
      | 'slug'
      | 'coverImage'
      | 'status'
      | 'allowComment'
      | 'metaDescription'
      | 'metaKeywords'
      | 'socialImage'
      | 'readingTime'
      | 'isFeatured'
      | 'isTop'
      | 'weight'
      | 'publishedAt'
      | 'createdAt'
      | 'updatedAt'
    >
  > {
  // Frontmatter特有的字段映射
  description?: string; // 映射到summary
  excerpt?: string; // 映射到summary
  tags?: string | string[]; // 标签名称数组
  categories?: string | string[]; // 分类名称
  cover?: string; // 映射到coverImage
  image?: string; // 映射到coverImage
  date?: string | Date; // 映射到publishedAt
  published?: boolean | string; // 发布状态
  featured?: boolean; // 映射到isFeatured
  top?: boolean; // 映射到isTop
  isTop?: boolean; // 映射到isTop
  pinned?: boolean; // 映射到isTop
  keywords?: string | string[]; // 映射到metaKeywords
  ogImage?: string; // 映射到socialImage
  [key: string]: any; // 允许其他未定义的字段
}

@Injectable()
export class ArticleImportService {
  private readonly logger = new Logger(ArticleImportService.name);

  // 常量定义
  private static readonly CACHE_TTL = 3600000; // 1小时
  private static readonly WORDS_PER_MINUTE = 200;
  private static readonly MAX_SUMMARY_LENGTH = 200;
  private static readonly MAX_SLUG_LENGTH = 100;
  private static readonly SUPPORTED_EXTENSIONS = ['.md', '.markdown'];
  private static readonly PROGRESS_CACHE_PREFIX = 'import_progress_';

  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly articleService: ArticleService,
    private readonly tagService: TagService,
    private readonly categoryService: CategoryService,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  /**
   * 开始异步导入文章
   */
  async startImportArticles(
    files: Express.Multer.File[],
    authorId: string,
    config: ArticleImportConfigDto = {},
  ): Promise<StartImportResponseDto> {
    const taskId = this.generateTaskId();
    const totalFiles = files.length;

    this.logger.log(
      `开始导入任务 ${taskId}，共 ${totalFiles} 个文件，作者ID: ${authorId}`,
    );

    // 初始化进度信息
    const initialProgress: ImportProgressDto = {
      taskId,
      status: ImportStatus.PENDING,
      totalFiles,
      processedFiles: 0,
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      progress: 0,
      startTime: Date.now(),
    };

    // 存储进度信息到缓存
    await this.cacheManager.set(
      `${ArticleImportService.PROGRESS_CACHE_PREFIX}${taskId}`,
      initialProgress,
      ArticleImportService.CACHE_TTL,
    );

    // 异步执行导入
    this.executeImport(taskId, files, authorId, config).catch((error) => {
      this.logger.error(
        `导入任务 ${taskId} 执行失败:`,
        error instanceof Error ? error.stack : undefined,
      );
    });

    return {
      taskId,
      status: ImportStatus.PENDING,
      totalFiles,
      message: '导入任务已开始，请使用任务ID查询进度',
    };
  }

  /**
   * 获取导入进度
   */
  async getImportProgress(taskId: string): Promise<ImportProgressDto | null> {
    const progress = await this.cacheManager.get<ImportProgressDto>(
      `${ArticleImportService.PROGRESS_CACHE_PREFIX}${taskId}`,
    );
    return progress || null;
  }

  /**
   * 执行导入任务
   */
  private async executeImport(
    taskId: string,
    files: Express.Multer.File[],
    authorId: string,
    config: ArticleImportConfigDto,
  ): Promise<void> {
    try {
      this.logger.log(`开始执行导入任务 ${taskId}`);

      // 更新状态为处理中
      await this.updateProgress(taskId, {
        status: ImportStatus.PROCESSING,
      });

      const result = await this.importArticles(files, authorId, config, taskId);

      this.logger.log(
        `导入任务 ${taskId} 完成，成功: ${result.successCount}，失败: ${result.failureCount}，跳过: ${result.skippedCount}`,
      );

      // 更新为完成状态
      await this.updateProgress(taskId, {
        status: ImportStatus.COMPLETED,
        progress: 100,
        results: result.results,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.logger.error(
        `导入任务 ${taskId} 失败: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      // 更新为失败状态
      await this.updateProgress(taskId, {
        status: ImportStatus.FAILED,
        error: errorMessage,
      });
    }
  }

  /**
   * 导入文章
   */
  private async importArticles(
    files: Express.Multer.File[],
    authorId: string,
    config: ArticleImportConfigDto = {},
    taskId?: string,
  ): Promise<ArticleImportResponseDto> {
    const startTime = Date.now();

    // 验证作者存在
    await this.validateAuthor(authorId);

    // 处理文件
    const { results, successCount, failureCount, skippedCount } =
      await this.processFiles(files, authorId, config, taskId, startTime);

    const endTime = Date.now();

    return {
      totalFiles: files.length,
      successCount,
      failureCount,
      skippedCount,
      results,
      startTime,
      endTime,
      duration: endTime - startTime,
    };
  }

  /**
   * 验证作者是否存在
   */
  private async validateAuthor(authorId: string): Promise<void> {
    const author = await this.userRepository.findOne({
      where: { id: authorId },
    });
    if (!author) {
      throw new BusinessException(ErrorCode.USER_NOT_FOUND);
    }
  }

  /**
   * 处理所有文件
   */
  private async processFiles(
    files: Express.Multer.File[],
    authorId: string,
    config: ArticleImportConfigDto,
    taskId: string | undefined,
    startTime: number,
  ): Promise<{
    results: ArticleImportResultDto[];
    successCount: number;
    failureCount: number;
    skippedCount: number;
  }> {
    const results: ArticleImportResultDto[] = [];
    const counters = { successCount: 0, failureCount: 0, skippedCount: 0 };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = this.decodeFileName(file.originalname);

      // 更新当前处理的文件
      if (taskId) {
        await this.updateProgress(taskId, {
          currentFile: fileName,
          processedFiles: i,
          progress: Math.round((i / files.length) * 100),
        });
      }

      try {
        const result = await this.processFile(file, authorId, config);
        results.push(result);
        this.updateCounters(result, counters);

        // 更新进度
        if (taskId) {
          await this.updateProgressAfterFile(
            taskId,
            i + 1,
            files.length,
            counters,
            startTime,
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : '未知错误';
        this.logger.warn(`处理文件 ${fileName} 时发生错误: ${errorMessage}`);

        results.push({
          filePath: fileName,
          success: false,
          error: errorMessage,
        });
        counters.failureCount++;

        // 更新进度
        if (taskId) {
          await this.updateProgressAfterFile(
            taskId,
            i + 1,
            files.length,
            counters,
            startTime,
          );
        }
      }
    }

    return {
      results,
      successCount: counters.successCount,
      failureCount: counters.failureCount,
      skippedCount: counters.skippedCount,
    };
  }

  /**
   * 解码文件名
   */
  private decodeFileName(originalName: string): string {
    return Buffer.from(originalName, 'latin1').toString('utf8');
  }

  /**
   * 更新计数器
   */
  private updateCounters(
    result: ArticleImportResultDto,
    counters: {
      successCount: number;
      failureCount: number;
      skippedCount: number;
    },
  ): void {
    if (result.success) {
      counters.successCount++;
    } else if (result.skipped) {
      counters.skippedCount++;
    } else {
      counters.failureCount++;
    }
  }

  /**
   * 处理文件后更新进度
   */
  private async updateProgressAfterFile(
    taskId: string,
    processedFiles: number,
    totalFiles: number,
    counters: {
      successCount: number;
      failureCount: number;
      skippedCount: number;
    },
    startTime: number,
  ): Promise<void> {
    await this.updateProgress(taskId, {
      processedFiles,
      successCount: counters.successCount,
      failureCount: counters.failureCount,
      skippedCount: counters.skippedCount,
      progress: Math.round((processedFiles / totalFiles) * 100),
      estimatedTimeRemaining: this.calculateEstimatedTime(
        startTime,
        processedFiles,
        totalFiles,
      ),
    });
  }

  /**
   * 处理单个文件
   */
  private async processFile(
    file: Express.Multer.File,
    authorId: string,
    config: ArticleImportConfigDto,
  ): Promise<ArticleImportResultDto> {
    const filePath = this.decodeFileName(file.originalname);

    try {
      // 检查文件类型
      if (!this.isMarkdownFile(filePath)) {
        return this.createErrorResult(
          filePath,
          '不支持的文件类型，仅支持 .md 和 .markdown 文件',
        );
      }

      // 解析文件内容
      const content = file.buffer.toString('utf-8');
      const validationResult = this.validateAndParseFile(content, filePath);

      if (!validationResult.isValid) {
        if (config.skipInvalidFiles) {
          return {
            filePath,
            success: false,
            error: validationResult.errors.join('; '),
            warnings: validationResult.warnings,
          };
        } else {
          throw new ValidationException(
            validationResult.errors.join('; '),
            validationResult.errors,
          );
        }
      }

      const parsedData = validationResult.data!;

      // 检查是否已存在相同的文章
      const existingArticle = await this.findExistingArticle(parsedData);
      if (existingArticle && !config.overwriteExisting) {
        return {
          filePath,
          success: false,
          skipped: true,
          error: `文章已存在，已跳过 (标题: ${parsedData.title})`,
        };
      }

      // 创建文章
      const article = await this.createArticleFromData(
        parsedData,
        authorId,
        config,
      );

      this.logger.debug(`成功处理文件: ${filePath}, 文章ID: ${article.id}`);

      return {
        filePath,
        success: true,
        articleId: article.id,
        title: article.title,
        warnings: validationResult.warnings,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.logger.error(
        `处理文件 ${filePath} 失败: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      return this.createErrorResult(filePath, errorMessage);
    }
  }

  /**
   * 创建错误结果
   */
  private createErrorResult(
    filePath: string,
    error: string,
  ): ArticleImportResultDto {
    return {
      filePath,
      success: false,
      error,
    };
  }

  /**
   * 查找已存在的文章
   */
  private async findExistingArticle(
    parsedData: ParsedArticleData,
  ): Promise<Article | null> {
    // 首先检查是否有相同的slug
    if (parsedData.slug) {
      const existingBySlug = await this.articleRepository.findOne({
        where: { slug: parsedData.slug },
      });
      if (existingBySlug) return existingBySlug;
    }

    // 如果没有找到相同slug的文章，再检查是否有相同标题的文章
    return await this.articleRepository.findOne({
      where: { title: parsedData.title },
    });
  }

  /**
   * 验证和解析文件内容
   */
  public validateAndParseFile(
    content: string,
    filePath: string,
  ): FileValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 使用 gray-matter 解析 frontmatter
      const parsed = matter(content);
      const { data: frontmatter, content: markdownContent } = parsed;

      // 验证必需字段
      const validationErrors = this.validateRequiredFields(
        frontmatter,
        markdownContent,
      );
      errors.push(...validationErrors);

      if (errors.length > 0) {
        return { isValid: false, errors, warnings };
      }

      // 构建解析后的数据
      const parsedData = this.buildParsedData(
        frontmatter,
        markdownContent,
        filePath,
      );

      // 添加警告
      this.addValidationWarnings(parsedData, warnings);

      return {
        isValid: true,
        errors,
        warnings,
        data: parsedData,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.logger.error(
        `解析文件 ${filePath} 失败: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      errors.push(`解析文件失败: ${errorMessage}`);
      return { isValid: false, errors, warnings };
    }
  }

  /**
   * 验证必需字段
   */
  private validateRequiredFields(
    frontmatter: ArticleFrontmatter,
    markdownContent: string,
  ): string[] {
    const errors: string[] = [];

    if (!frontmatter.title && !this.extractTitleFromContent(markdownContent)) {
      errors.push('缺少文章标题');
    }

    if (!markdownContent.trim()) {
      errors.push('文章内容为空');
    }

    return errors;
  }

  /**
   * 构建解析后的数据
   */
  private buildParsedData(
    frontmatter: ArticleFrontmatter,
    markdownContent: string,
    filePath: string,
  ): ParsedArticleData {
    return {
      title: this.extractTitle(frontmatter, markdownContent, filePath),
      content: markdownContent,
      summary: this.getStringField(frontmatter, [
        'summary',
        'description',
        'excerpt',
      ]),
      slug: typeof frontmatter.slug === 'string' ? frontmatter.slug : undefined,
      tags: this.normalizeTags(frontmatter.tags),
      category:
        typeof frontmatter.categories === 'string'
          ? frontmatter.categories
          : undefined,
      coverImage: this.getStringField(frontmatter, [
        'coverImage',
        'cover',
        'image',
      ]),
      publishedAt: this.parseDate(
        (frontmatter.date || frontmatter.publishedAt) ?? undefined,
      ),
      createdAt: this.parseDate(frontmatter.createdAt || frontmatter.date),
      updatedAt: this.parseDate(frontmatter.updatedAt),
      status: this.normalizeStatus(frontmatter.status, frontmatter.published),
      isFeatured: Boolean(frontmatter.featured || frontmatter.isFeatured),
      isTop: Boolean(
        frontmatter.top || frontmatter.isTop || frontmatter.pinned,
      ),
      allowComment: frontmatter.allowComment !== false,
      metaDescription: this.getStringField(frontmatter, [
        'metaDescription',
        'description',
      ]),
      metaKeywords: this.normalizeKeywords(
        frontmatter.keywords || frontmatter.metaKeywords,
      ),
      socialImage: this.getStringField(frontmatter, ['socialImage', 'ogImage']),
      readingTime: this.calculateReadingTime(markdownContent),
      weight: Number(frontmatter.weight) || 0,
    };
  }

  /**
   * 提取标题
   */
  private extractTitle(
    frontmatter: ArticleFrontmatter,
    markdownContent: string,
    filePath: string,
  ): string {
    if (typeof frontmatter.title === 'string') {
      return frontmatter.title;
    }

    const titleFromContent = this.extractTitleFromContent(markdownContent);
    if (titleFromContent) {
      return titleFromContent;
    }

    return path.basename(filePath, path.extname(filePath));
  }

  /**
   * 提取字符串字段的辅助函数
   */
  private getStringField(
    frontmatter: ArticleFrontmatter,
    fieldNames: string[],
  ): string | undefined {
    for (const fieldName of fieldNames) {
      if (typeof frontmatter[fieldName] === 'string') {
        return frontmatter[fieldName];
      }
    }
    return undefined;
  }

  /**
   * 添加验证警告
   */
  private addValidationWarnings(
    parsedData: ParsedArticleData,
    warnings: string[],
  ): void {
    if (!parsedData.summary) {
      warnings.push('未找到文章摘要，将自动生成');
    }

    if (!parsedData.slug) {
      warnings.push('未找到slug，将自动生成');
    }
  }

  /**
   * 从解析的数据创建文章
   */
  private async createArticleFromData(
    data: ParsedArticleData,
    authorId: string,
    config: ArticleImportConfigDto,
  ): Promise<Article> {
    // 处理分类
    let categoryId: string | undefined;
    const categoryName = data.category || config.defaultCategory;
    if (categoryName) {
      // 使用CategoryService创建或查找分类
      const category = await this.categoryService.findOrCreate(categoryName);
      categoryId = category.id;
    }

    // 处理标签
    const tagNames = [...(data.tags || []), ...(config.defaultTags || [])];
    // 使用TagService创建或查找标签
    const tags = await this.tagService.createOrFindTags(tagNames);
    const tagIds = tags.map((tag) => tag.id);

    // 生成摘要（如果没有）
    const summary = data.summary || this.generateSummary(data.content);

    // 确定状态
    const status = config.autoPublish ? 'published' : data.status || 'draft';

    // 处理覆盖逻辑
    if (config.overwriteExisting) {
      // 覆盖模式：查找现有文章并更新
      const slug = data.slug || this.generateSlug(data.title);
      const existingArticle = await this.articleRepository.findOne({
        where: { slug },
        relations: ['tags'],
      });

      if (existingArticle) {
        // 更新现有文章
        const updateData = {
          title: data.title,
          content: data.content,
          summary,
          coverImage: data.coverImage,
          status,
          categoryId,
          tagIds,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          publishedAt:
            status === 'published'
              ? data.publishedAt || new Date()
              : data.publishedAt,
          isFeatured: data.isFeatured || false,
          isTop: data.isTop || false,
          allowComment: data.allowComment !== false,
          metaDescription: data.metaDescription,
          metaKeywords: data.metaKeywords,
          socialImage: data.socialImage,
          readingTime: data.readingTime,
          weight: data.weight || 0,
        };

        // 使用ArticleService的update方法
        return await this.articleService.update(existingArticle.id, updateData);
      }
    }

    // 创建新文章 - 使用ArticleService的create方法
    const createData = {
      title: data.title,
      content: data.content,
      summary,
      slug: data.slug, // 可能为undefined，让ArticleService处理
      coverImage: data.coverImage,
      status,
      categoryId,
      authorId,
      tagIds,
      publishedAt:
        status === 'published'
          ? data.publishedAt || new Date()
          : data.publishedAt,
      isFeatured: data.isFeatured || false,
      isTop: data.isTop || false,
      allowComment: data.allowComment !== false,
      metaDescription: data.metaDescription,
      metaKeywords: data.metaKeywords,
      socialImage: data.socialImage,
      readingTime: data.readingTime,
      weight: data.weight || 0,
      isVisible: true,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };

    return await this.articleService.create(createData);
  }
  /**
   * 工具方法
   */
  private isMarkdownFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return ArticleImportService.SUPPORTED_EXTENSIONS.includes(ext);
  }

  private extractTitleFromContent(content: string): string | null {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : null;
  }

  private normalizeTags(tags: string | string[] | undefined): string[] {
    if (!tags) return [];

    if (typeof tags === 'string') {
      return this.splitAndClean(tags);
    }

    if (Array.isArray(tags)) {
      return tags.map((tag) => String(tag).trim()).filter(Boolean);
    }

    return [];
  }

  private normalizeKeywords(keywords: string | string[] | undefined): string[] {
    if (!keywords) return [];

    if (typeof keywords === 'string') {
      return this.splitAndClean(keywords);
    }

    if (Array.isArray(keywords)) {
      return keywords.map((kw) => String(kw).trim()).filter(Boolean);
    }

    return [];
  }

  /**
   * 分割字符串并清理空值
   */
  private splitAndClean(str: string): string[] {
    return str
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private normalizeStatus(
    status: string | undefined,
    published: boolean | string | undefined,
  ): 'draft' | 'published' | 'archived' {
    const validStatuses = ['draft', 'published', 'archived'];

    if (status && validStatuses.includes(status)) {
      return status as 'draft' | 'published' | 'archived';
    }

    if (published === true || published === 'true') {
      return 'published';
    }

    if (published === false || published === 'false') {
      return 'draft';
    }

    return 'draft';
  }

  private parseDate(
    date: string | Date | number | undefined,
  ): Date | undefined {
    if (!date) return undefined;

    if (typeof date === 'number') {
      return new Date(date);
    }

    if (typeof date === 'string') {
      const parsed = new Date(date);
      return isNaN(parsed.getTime()) ? undefined : parsed;
    }

    if (date instanceof Date) {
      return isNaN(date.getTime()) ? undefined : date;
    }

    return undefined;
  }

  private calculateReadingTime(content: string): number {
    const words = content.trim().split(/\s+/).length;
    return Math.ceil(words / ArticleImportService.WORDS_PER_MINUTE);
  }

  private generateSummary(
    content: string,
    maxLength: number = ArticleImportService.MAX_SUMMARY_LENGTH,
  ): string {
    const text = content
      .replace(/#{1,6}\s+/g, '') // 移除标题标记
      .replace(/\*\*(.+?)\*\*/g, '$1') // 移除粗体标记
      .replace(/\*(.+?)\*/g, '$1') // 移除斜体标记
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // 移除链接，保留文本
      .replace(/`(.+?)`/g, '$1') // 移除行内代码标记
      .replace(/```[\s\S]*?```/g, '') // 移除代码块
      .trim();

    return text.length > maxLength
      ? text.substring(0, maxLength) + '...'
      : text;
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, ArticleImportService.MAX_SLUG_LENGTH);
  }

  /**
   * 生成任务ID
   */
  private generateTaskId(): string {
    return `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 更新进度信息
   */
  private async updateProgress(
    taskId: string,
    updates: Partial<ImportProgressDto>,
  ): Promise<void> {
    const cacheKey = `${ArticleImportService.PROGRESS_CACHE_PREFIX}${taskId}`;
    const currentProgress =
      await this.cacheManager.get<ImportProgressDto>(cacheKey);

    if (currentProgress) {
      const updatedProgress = { ...currentProgress, ...updates };
      await this.cacheManager.set(
        cacheKey,
        updatedProgress,
        ArticleImportService.CACHE_TTL,
      );
    }
  }

  /**
   * 计算预计剩余时间
   */
  private calculateEstimatedTime(
    startTime: number,
    processedCount: number,
    totalCount: number,
  ): number {
    if (processedCount === 0) return 0;

    const elapsedTime = Date.now() - startTime;
    const averageTimePerFile = elapsedTime / processedCount;
    const remainingFiles = totalCount - processedCount;

    return Math.round(remainingFiles * averageTimePerFile);
  }

  /**
   * 同步导入方法，直接调用异步导入并等待完成
   */
  async importArticlesSync(
    files: Express.Multer.File[],
    authorId: string,
    config: ArticleImportConfigDto = {},
  ): Promise<ArticleImportResponseDto> {
    return this.importArticles(files, authorId, config);
  }

  /**
   * 清理过期的导入进度缓存
   */
  async cleanupExpiredProgress(): Promise<void> {
    try {
      // 这里可以实现清理逻辑，具体实现取决于缓存管理器的能力
      this.logger.log('清理过期的导入进度缓存');
      await Promise.resolve();
    } catch (error) {
      this.logger.error(
        '清理过期缓存失败:',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * 获取导入统计信息
   */
  async getImportStatistics(taskId: string): Promise<{
    totalFiles: number;
    processedFiles: number;
    successRate: number;
    averageProcessingTime: number;
  } | null> {
    const progress = await this.getImportProgress(taskId);
    if (!progress) return null;

    const successRate =
      progress.totalFiles > 0
        ? (progress.successCount / progress.totalFiles) * 100
        : 0;

    const elapsedTime = Date.now() - progress.startTime;
    const averageProcessingTime =
      progress.processedFiles > 0 ? elapsedTime / progress.processedFiles : 0;

    return {
      totalFiles: progress.totalFiles,
      processedFiles: progress.processedFiles,
      successRate: Math.round(successRate * 100) / 100,
      averageProcessingTime: Math.round(averageProcessingTime),
    };
  }

  /**
   * 取消导入任务
   */
  async cancelImportTask(taskId: string): Promise<boolean> {
    try {
      const cacheKey = `${ArticleImportService.PROGRESS_CACHE_PREFIX}${taskId}`;
      const progress = await this.cacheManager.get<ImportProgressDto>(cacheKey);

      if (progress && progress.status === ImportStatus.PROCESSING) {
        await this.updateProgress(taskId, {
          status: ImportStatus.FAILED,
          error: '任务已被用户取消',
        });
        this.logger.log(`导入任务 ${taskId} 已被取消`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(
        `取消导入任务 ${taskId} 失败:`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }
}
