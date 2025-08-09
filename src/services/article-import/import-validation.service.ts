import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from '@/entities/article.entity';
import { User } from '@/entities/user.entity';
import {
  ArticleImportConfigDto,
  ArticleImportResultDto,
  ParsedArticleData,
} from '@/dto/article-import.dto';
import { BusinessException } from '@/common/exceptions/business.exception';
import { ErrorCode } from '@/common/constants/error-codes';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';

@Injectable()
export class ImportValidationService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly logger: StructuredLoggerService,
  ) {}

  /**
   * 验证作者是否存在
   */
  async validateAuthor(authorId: string): Promise<void> {
    const author = await this.userRepository.findOne({
      where: { id: authorId },
    });
    if (!author) {
      throw new BusinessException(ErrorCode.USER_NOT_FOUND);
    }
  }

  /**
   * 验证文件并处理重复检查
   */
  async validateFileForImport(
    parsedData: ParsedArticleData,
    config: ArticleImportConfigDto,
    filePath: string,
  ): Promise<{
    canImport: boolean;
    result?: ArticleImportResultDto;
    existingArticle?: Article;
  }> {
    // 检查是否已存在相同的文章
    const existingArticle = await this.findExistingArticle(parsedData);

    if (existingArticle && !config.overwriteExisting) {
      return {
        canImport: false,
        result: {
          filePath,
          success: false,
          skipped: true,
          error: `文章已存在，已跳过 (标题: ${parsedData.title})`,
        },
      };
    }

    return {
      canImport: true,
      existingArticle: existingArticle || undefined,
    };
  }

  /**
   * 验证导入配置
   */
  validateImportConfig(config: ArticleImportConfigDto): string[] {
    const errors: string[] = [];

    // 验证默认分类
    if (config.defaultCategory && typeof config.defaultCategory !== 'string') {
      errors.push('默认分类必须是字符串类型');
    }

    // 验证默认标签
    if (config.defaultTags && !Array.isArray(config.defaultTags)) {
      errors.push('默认标签必须是数组类型');
    }

    // 验证布尔类型配置
    if (
      config.autoPublish !== undefined &&
      typeof config.autoPublish !== 'boolean'
    ) {
      errors.push('自动发布配置必须是布尔类型');
    }

    if (
      config.overwriteExisting !== undefined &&
      typeof config.overwriteExisting !== 'boolean'
    ) {
      errors.push('覆盖已存在文章配置必须是布尔类型');
    }

    if (
      config.skipInvalidFiles !== undefined &&
      typeof config.skipInvalidFiles !== 'boolean'
    ) {
      errors.push('跳过无效文件配置必须是布尔类型');
    }

    return errors;
  }

  /**
   * 验证文件列表
   */
  validateFiles(files: Express.Multer.File[]): string[] {
    const errors: string[] = [];

    if (!files || files.length === 0) {
      errors.push('没有提供要导入的文件');
    }

    // 检查文件大小限制（例如：每个文件不超过10MB）
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    for (const file of files) {
      if (file.size > maxFileSize) {
        errors.push(`文件 ${file.originalname} 超过大小限制（10MB）`);
      }
    }

    // 检查文件总数限制（例如：一次不超过100个文件）
    const maxFileCount = 100;
    if (files.length > maxFileCount) {
      errors.push(`文件数量超过限制，最多允许 ${maxFileCount} 个文件`);
    }

    return errors;
  }

  /**
   * 验证单个文件的基本信息
   */
  validateSingleFile(file: Express.Multer.File): string[] {
    const errors: string[] = [];

    if (!file.buffer || file.buffer.length === 0) {
      errors.push('文件内容为空');
    }

    if (!file.originalname) {
      errors.push('文件名为空');
    }

    // 检查文件编码是否有效
    try {
      file.buffer.toString('utf-8');
    } catch {
      errors.push('文件编码无效，请确保文件为UTF-8编码');
    }

    return errors;
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
   * 创建错误结果
   */
  createErrorResult(filePath: string, error: string): ArticleImportResultDto {
    return {
      filePath,
      success: false,
      error,
    };
  }

  /**
   * 创建跳过结果
   */
  createSkippedResult(
    filePath: string,
    reason: string,
  ): ArticleImportResultDto {
    return {
      filePath,
      success: false,
      skipped: true,
      error: reason,
    };
  }

  /**
   * 验证解析后的数据
   */
  validateParsedData(parsedData: ParsedArticleData): string[] {
    const errors: string[] = [];

    // 验证标题长度
    if (parsedData.title.length > 200) {
      errors.push('文章标题过长，最多允许200个字符');
    }

    // 验证内容长度
    if (parsedData.content.length > 1000000) {
      // 1MB
      errors.push('文章内容过长，最多允许1MB');
    }

    // 验证摘要长度
    if (parsedData.summary && parsedData.summary.length > 500) {
      errors.push('文章摘要过长，最多允许500个字符');
    }

    // 验证slug格式
    if (parsedData.slug && !/^[a-z0-9-]+$/.test(parsedData.slug)) {
      errors.push('Slug格式无效，只能包含小写字母、数字和连字符');
    }

    // 验证标签数量
    if (parsedData.tags && parsedData.tags.length > 10) {
      errors.push('标签数量过多，最多允许10个标签');
    }

    // 验证标签长度
    if (parsedData.tags) {
      for (const tag of parsedData.tags) {
        if (tag.length > 50) {
          errors.push(`标签 "${tag}" 过长，最多允许50个字符`);
        }
      }
    }

    // 验证分类长度
    if (parsedData.category && parsedData.category.length > 100) {
      errors.push('分类名称过长，最多允许100个字符');
    }

    // 验证权重值
    if (
      parsedData.weight !== undefined &&
      (parsedData.weight < 0 || parsedData.weight > 1000)
    ) {
      errors.push('权重值必须在0-1000之间');
    }

    return errors;
  }

  /**
   * 验证日期字段
   */
  validateDates(parsedData: ParsedArticleData): string[] {
    const errors: string[] = [];
    const now = new Date();

    // 验证发布日期不能太久远
    if (parsedData.publishedAt) {
      const minDate = new Date('2000-01-01');
      const maxDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 一年后

      if (parsedData.publishedAt < minDate) {
        errors.push('发布日期不能早于2000年1月1日');
      }

      if (parsedData.publishedAt > maxDate) {
        errors.push('发布日期不能超过一年后');
      }
    }

    // 验证创建日期
    if (parsedData.createdAt && parsedData.createdAt > now) {
      errors.push('创建日期不能是未来时间');
    }

    // 验证更新日期
    if (parsedData.updatedAt && parsedData.updatedAt > now) {
      errors.push('更新日期不能是未来时间');
    }

    // 验证日期逻辑关系
    if (
      parsedData.createdAt &&
      parsedData.updatedAt &&
      parsedData.updatedAt < parsedData.createdAt
    ) {
      errors.push('更新日期不能早于创建日期');
    }

    return errors;
  }
}
