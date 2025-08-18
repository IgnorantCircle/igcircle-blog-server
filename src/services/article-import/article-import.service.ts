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
  getImportProgress(taskId: string): ImportProgressDto | null {
    return this.importProgressService.getImportProgress(taskId);
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
      this.importProgressService.markAsProcessing(taskId);

      const result = await this.processImportTask(
        files,
        authorId,
        config,
        taskId,
      );

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
      this.importProgressService.markTaskCompleted(taskId, result.results);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.logger.error(
        `导入任务 ${taskId} 失败: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
        { metadata: { taskId, error: errorMessage } },
      );

      // 更新为失败状态
      this.importProgressService.markAsFailed(taskId, errorMessage);
    }
  }

  /**
   * 处理导入任务
   */
  private async processImportTask(
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
    const batchSize = 5; // 批量处理大小
    const maxConcurrency = 3; // 最大并发数

    // 分批处理文件
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      // 并发处理当前批次，但限制并发数
      const batchPromises = batch.map(async (file, batchIndex) => {
        const globalIndex = i + batchIndex;
        const fileName = this.articleParserService.decodeFileName(
          file.originalname,
        );

        // 更新当前处理的文件
        if (taskId) {
          this.importProgressService.updateCurrentFile(
            taskId,
            fileName,
            globalIndex,
            files.length,
          );
        }

        try {
          const result = await this.processFile(file, authorId, config);
          return { result, index: globalIndex };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : '未知错误';
          this.logger.warn(`处理文件 ${fileName} 时发生错误: ${errorMessage}`, {
            metadata: { fileName, error: errorMessage },
          });

          return {
            result: this.importValidationService.createErrorResult(
              fileName,
              errorMessage,
            ),
            index: globalIndex,
          };
        }
      });

      // 限制并发执行
      const batchResults = await this.executeConcurrentlyWithLimit(
        batchPromises,
        maxConcurrency,
      );

      // 处理批次结果
      for (const { result } of batchResults) {
        results.push(result);
        this.updateCounters(result, counters);
      }

      // 更新整体进度
      if (taskId) {
        const processedCount = Math.min(i + batchSize, files.length);
        this.importProgressService.updateProgressAfterFile(
          taskId,
          processedCount,
          files.length,
          counters,
          startTime,
        );
      }
    }

    return { results, ...counters };
  }

  /**
   * 限制并发执行Promise数组
   */
  private async executeConcurrentlyWithLimit<T>(
    promises: Promise<T>[],
    limit: number,
  ): Promise<T[]> {
    const results: T[] = [];

    for (let i = 0; i < promises.length; i += limit) {
      const batch = promises.slice(i, i + limit);
      const batchResults = await Promise.allSettled(batch);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          this.logger.error('批量处理中的Promise执行失败', result.reason);
          // 这里可以根据需要处理失败的情况
        }
      }
    }

    return results;
  }

  /**
   * 处理单个文件时的错误处理
   */
  private handleFileProcessingError(
    fileName: string,
    error: unknown,
    results: ArticleImportResultDto[],
    counters: {
      successCount: number;
      failureCount: number;
      skippedCount: number;
    },
  ): void {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    this.logger.warn(`处理文件 ${fileName} 时发生错误: ${errorMessage}`, {
      metadata: { fileName, error: errorMessage },
    });

    results.push({
      filePath: fileName,
      success: false,
      error: errorMessage,
    });
    counters.failureCount++;
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
   * 清理过期的进度记录
   */
  cleanupExpiredProgress(): void {
    this.importProgressService.cleanupExpiredProgress();
  }

  /**
   * 获取导入统计信息
   */
  getImportStatistics(taskId: string): {
    totalFiles: number;
    processedFiles: number;
    successRate: number;
    averageProcessingTime: number;
  } | null {
    return this.importProgressService.getImportStatistics(taskId);
  }

  /**
   * 取消导入任务
   */
  cancelImportTask(taskId: string): boolean {
    return this.importProgressService.cancelImportTask(taskId);
  }
}
