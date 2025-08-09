/**
 * Slug生成工具类
 * 提供统一的slug生成逻辑，支持中文和英文
 */
export class SlugUtil {
  /**
   * 生成slug
   * @param text 原始文本
   * @param options 配置选项
   * @returns 生成的slug
   */
  static generate(
    text: string,
    options: {
      maxLength?: number;
      fallbackPrefix?: string;
      preserveSpaces?: boolean;
    } = {},
  ): string {
    const {
      maxLength = 100,
      fallbackPrefix = 'item',
      preserveSpaces = false,
    } = options;

    if (!text || typeof text !== 'string') {
      return `${fallbackPrefix}-${Date.now()}`;
    }

    let slug = text.toLowerCase();

    if (preserveSpaces) {
      // 保留空格的处理方式（适用于文章标题）
      slug = slug
        .replace(/[^a-z0-9\u4e00-\u9fff\s-]/g, '') // 保留中文、英文、数字、空格和连字符
        .replace(/\s+/g, '-') // 将空格替换为连字符
        .replace(/-+/g, '-') // 将多个连字符合并为一个
        .replace(/^-|-$/g, ''); // 移除开头和结尾的连字符
    } else {
      // 不保留空格的处理方式（适用于标签、分类名称）
      slug = slug
        .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '-') // 将非字母数字中文字符替换为连字符
        .replace(/-+/g, '-') // 将多个连字符合并为一个
        .replace(/^-|-$/g, ''); // 移除开头和结尾的连字符
    }

    // 如果处理后的slug为空，使用回退方案
    if (!slug) {
      slug = `${fallbackPrefix}-${Date.now()}`;
    }

    // 限制长度
    if (maxLength > 0 && slug.length > maxLength) {
      slug = slug.substring(0, maxLength).replace(/-+$/, '');
    }

    return slug;
  }

  /**
   * 为文章生成slug
   * @param title 文章标题
   * @param maxLength 最大长度，默认100
   * @returns 生成的slug
   */
  static forArticle(title: string, maxLength: number = 100): string {
    return this.generate(title, {
      maxLength,
      fallbackPrefix: 'article',
      preserveSpaces: true,
    });
  }

  /**
   * 为标签生成slug
   * @param name 标签名称
   * @param maxLength 最大长度，默认100
   * @returns 生成的slug
   */
  static forTag(name: string, maxLength: number = 100): string {
    return this.generate(name, {
      maxLength,
      fallbackPrefix: 'tag',
      preserveSpaces: false,
    });
  }

  /**
   * 为分类生成slug
   * @param name 分类名称
   * @param maxLength 最大长度，默认100
   * @returns 生成的slug
   */
  static forCategory(name: string, maxLength: number = 100): string {
    return this.generate(name, {
      maxLength,
      fallbackPrefix: 'category',
      preserveSpaces: false,
    });
  }

  /**
   * 验证slug格式是否有效
   * @param slug 要验证的slug
   * @returns 是否有效
   */
  static isValid(slug: string): boolean {
    if (!slug || typeof slug !== 'string') {
      return false;
    }

    // slug应该只包含小写字母、数字、中文字符和连字符
    // 不能以连字符开头或结尾
    // 不能包含连续的连字符
    const slugPattern = /^[a-z0-9\u4e00-\u9fff]+(-[a-z0-9\u4e00-\u9fff]+)*$/;
    return slugPattern.test(slug);
  }

  /**
   * 清理和标准化slug
   * @param slug 原始slug
   * @param maxLength 最大长度
   * @returns 清理后的slug
   */
  static normalize(slug: string, maxLength: number = 100): string {
    if (!slug || typeof slug !== 'string') {
      return '';
    }

    let normalized = slug
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff-]/g, '-') // 将无效字符替换为连字符
      .replace(/-+/g, '-') // 合并连续连字符
      .replace(/^-|-$/g, ''); // 移除首尾连字符

    // 限制长度
    if (maxLength > 0 && normalized.length > maxLength) {
      normalized = normalized.substring(0, maxLength).replace(/-+$/, '');
    }

    return normalized;
  }
}
