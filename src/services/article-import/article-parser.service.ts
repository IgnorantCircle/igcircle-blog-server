import { Injectable } from '@nestjs/common';
import matter from 'gray-matter';
import * as path from 'path';
import readingTime from 'reading-time';
import { Article } from '@/entities/article.entity';
import {
  ParsedArticleData,
  FileValidationResult,
} from '@/dto/article-import.dto';
import { StructuredLoggerService } from '@/common/logger/structured-logger.service';

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
export class ArticleParserService {
  // 常量定义
  private static readonly MAX_SUMMARY_LENGTH = 200;
  private static readonly MAX_SLUG_LENGTH = 100;
  private static readonly SUPPORTED_EXTENSIONS = ['.md', '.markdown'];

  constructor(private readonly logger: StructuredLoggerService) {}

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
        {
          metadata: { filePath, error: errorMessage },
        },
      );
      errors.push(`解析文件失败: ${errorMessage}`);
      return { isValid: false, errors, warnings };
    }
  }

  /**
   * 检查是否为Markdown文件
   */
  public isMarkdownFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return ArticleParserService.SUPPORTED_EXTENSIONS.includes(ext);
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
   * 从内容中提取标题
   */
  private extractTitleFromContent(content: string): string | null {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : null;
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
   * 标准化标签
   */
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

  /**
   * 标准化关键词
   */
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

  /**
   * 标准化状态
   */
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

  /**
   * 解析日期
   */
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

  /**
   * 计算阅读时间
   * 使用 reading-time 库计算
   */
  private calculateReadingTime(content: string): number {
    const stats = readingTime(content);
    return stats.minutes;
  }

  /**
   * 生成摘要
   */
  public generateSummary(
    content: string,
    maxLength: number = ArticleParserService.MAX_SUMMARY_LENGTH,
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

  /**
   * 解码文件名
   */
  public decodeFileName(originalName: string): string {
    return Buffer.from(originalName, 'latin1').toString('utf8');
  }
}
