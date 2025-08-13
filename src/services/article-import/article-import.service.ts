import { Injectable } from '@nestjs/common';
import { Article } from '@/entities/article.entity';
import { ArticleService } from '../article/article.service';
import { TagService } from '../tag.service';
import { CategoryService } from '../category.service';
import {
  ArticleImportConfigDto,
  ArticleImportResponseDto,
  ArticleImportResultDto,
  ParsedArticleData,
  ImportProgressDto,
  StartImportResponseDto,
} from '@/dto/article-import.dto';
import { ValidationException } from '@/common/exceptions/business.exception';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';
import { ArticleParserService } from './article-parser.service';
import { ImportProgressService } from './import-progress.service';
import { ImportValidationService } from './import-validation.service';

@Injectable()
export class ArticleImportService {
  constructor(
    private readonly articleService: ArticleService,
    private readonly tagService: TagService,
    private readonly categoryService: CategoryService,
    private readonly logger: StructuredLoggerService,
    private readonly articleParserService: ArticleParserService,
    private readonly importProgressService: ImportProgressService,
    private readonly importValidationService: ImportValidationService,
  ) {}

  /**
   * 开始异步导入文章
   */
  async startImportArticles(
    files: Express.Multer.File[],
    authorId: string,
    config: ArticleImportConfigDto = {},
  ): Promise<StartImportResponseDto> {
    // 验证输入参数
    const configErrors =
      this.importValidationService.validateImportConfig(config);
    if (configErrors.length > 0) {
      throw new ValidationException('导入配置无效', configErrors);
    }

    const fileErrors = this.importValidationService.validateFiles(files);
    if (fileErrors.length > 0) {
      throw new ValidationException('文件验证失败', fileErrors);
    }

    // 验证作者存在
    await this.importValidationService.validateAuthor(authorId);

    const taskId = this.importProgressService.generateTaskId();
    const totalFiles = files.length;

    this.logger.log(
      `开始导入任务 ${taskId}，共 ${totalFiles} 个文件，作者ID: ${authorId}`,
      { metadata: { taskId, totalFiles, authorId } },
    );

    // 初始化进度信息
    const response = this.importProgressService.initializeProgress(
      taskId,
      totalFiles,
    );

    // 异步执行导入
    this.executeImport(taskId, files, authorId, config).catch((error) => {
      this.logger.error(
        `导入任务 ${taskId} 执行失败`,
        error instanceof Error ? error.stack : undefined,
        {
          metadata: {
            taskId,
            error: error instanceof Error ? error.message : '未知错误',
          },
        },
      );
    });

    return response;
  }

  /**
   * 获取导入进度
   */
  async getImportProgress(taskId: string): Promise<ImportProgressDto | null> {
    return  await this.importProgressService.getImportProgress(taskId);
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
      this.logger.log(`开始执行导入任务 ${taskId}`, { metadata: { taskId } });

      // 更新状态为处理中
      await this.importProgressService.markAsProcessing(taskId);

      const result = await this.importArticles(files, authorId, config, taskId);

      this.logger.log(
        `导入任务 ${taskId} 完成，成功: ${result.successCount}，失败: ${result.failureCount}，跳过: ${result.skippedCount}`,
        {
          metadata: {
            taskId,
            successCount: result.successCount,
            failureCount: result.failureCount,
            skippedCount: result.skippedCount,
          },
        },
      );

      // 更新为完成状态
      await this.importProgressService.markTaskCompleted(
        taskId,
        result.results,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.logger.error(
        `导入任务 ${taskId} 失败: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
        { metadata: { taskId, error: errorMessage } },
      );

      // 更新为失败状态
      await this.importProgressService.markAsFailed(taskId, errorMessage);
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
      const fileName = this.articleParserService.decodeFileName(
        file.originalname,
      );

      // 更新当前处理的文件
      if (taskId) {
        await this.importProgressService.updateCurrentFile(
          taskId,
          fileName,
          i,
          files.length,
        );
      }

      try {
        const result = await this.processFile(file, authorId, config);
        results.push(result);
        this.updateCounters(result, counters);

        // 更新进度
        if (taskId) {
          await this.importProgressService.updateProgressAfterFile(
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
        this.logger.warn(`处理文件 ${fileName} 时发生错误: ${errorMessage}`, {
          metadata: { fileName, error: errorMessage },
        });

        results.push({
          filePath: fileName,
          success: false,
          error: errorMessage,
        });
        counters.failureCount++;

        // 更新进度
        if (taskId) {
          await this.importProgressService.updateProgressAfterFile(
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
   * 处理单个文件
   */
  private async processFile(
    file: Express.Multer.File,
    authorId: string,
    config: ArticleImportConfigDto,
  ): Promise<ArticleImportResultDto> {
    const filePath = this.articleParserService.decodeFileName(
      file.originalname,
    );

    try {
      // 验证单个文件
      const fileErrors = this.importValidationService.validateSingleFile(file);
      if (fileErrors.length > 0) {
        return this.importValidationService.createErrorResult(
          filePath,
          fileErrors.join('; '),
        );
      }

      // 检查文件类型
      if (!this.articleParserService.isMarkdownFile(filePath)) {
        return this.importValidationService.createErrorResult(
          filePath,
          '不支持的文件类型，仅支持 .md 和 .markdown 文件',
        );
      }

      // 解析文件内容
      const content = file.buffer.toString('utf-8');
      const validationResult = this.articleParserService.validateAndParseFile(
        content,
        filePath,
      );

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

      // 验证解析后的数据
      const dataErrors =
        this.importValidationService.validateParsedData(parsedData);
      const dateErrors = this.importValidationService.validateDates(parsedData);
      const allErrors = [...dataErrors, ...dateErrors];

      if (allErrors.length > 0) {
        return this.importValidationService.createErrorResult(
          filePath,
          allErrors.join('; '),
        );
      }

      // 检查是否已存在相同的文章
      const validationResult2 =
        await this.importValidationService.validateFileForImport(
          parsedData,
          config,
          filePath,
        );

      if (!validationResult2.canImport) {
        return validationResult2.result!;
      }

      // 创建文章
      const article = await this.createArticleFromData(
        parsedData,
        authorId,
        config,
        validationResult2.existingArticle,
      );

      this.logger.debug(`成功处理文件: ${filePath}, 文章ID: ${article.id}`, {
        metadata: { filePath, articleId: article.id },
      });

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
        {
          metadata: { filePath, error: errorMessage },
        },
      );
      return this.importValidationService.createErrorResult(
        filePath,
        errorMessage,
      );
    }
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
   * 从解析的数据创建文章
   */
  private async createArticleFromData(
    data: ParsedArticleData,
    authorId: string,
    config: ArticleImportConfigDto,
    existingArticle?: Article,
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
    const summary =
      data.summary || this.articleParserService.generateSummary(data.content);

    // 确定状态
    const status = config.autoPublish ? 'published' : data.status || 'draft';

    // 处理覆盖逻辑
    if (config.overwriteExisting && existingArticle) {
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
   * 清理过期的导入进度
   */
  async cleanupExpiredProgress(): Promise<void> {
    return this.importProgressService.cleanupExpiredProgress();
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
    return this.importProgressService.getImportStatistics(taskId);
  }

  /**
   * 取消导入任务
   */
  async cancelImportTask(taskId: string): Promise<boolean> {
    return this.importProgressService.cancelImportTask(taskId);
  }
}
