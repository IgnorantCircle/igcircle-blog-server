import { Injectable } from '@nestjs/common';
import { ValidationException } from '@/common/exceptions/business.exception';
import { ArticleImportConfigDto } from '@/dto/article-import.dto';

export interface RawImportConfigData {
  defaultCategory?: string;
  defaultTags?: string; // 逗号分隔的字符串
  autoPublish?: string | boolean;
  overwriteExisting?: string | boolean;
  importMode?: string;
  skipInvalidFiles?: string | boolean;
}

@Injectable()
export class ConfigValidationService {
  /**
   * 解析原始配置数据为DTO
   */
  parseConfig(configData: RawImportConfigData): ArticleImportConfigDto {
    const config = new ArticleImportConfigDto();

    // 处理字符串类型字段
    config.defaultCategory = configData.defaultCategory?.trim() || undefined;
    config.importMode =
      (configData.importMode as 'strict' | 'loose') || 'loose';

    // 处理标签字段（逗号分隔字符串转数组）
    if (configData.defaultTags) {
      config.defaultTags = configData.defaultTags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
    }

    // 处理布尔类型字段
    config.autoPublish = this.parseBoolean(configData.autoPublish, false);
    config.overwriteExisting = this.parseBoolean(
      configData.overwriteExisting,
      false,
    );
    config.skipInvalidFiles = this.parseBoolean(
      configData.skipInvalidFiles,
      true,
    );

    return config;
  }

  /**
   * 验证解析后的配置
   */
  validateConfig(config: ArticleImportConfigDto): void {
    if (config.importMode && !['strict', 'loose'].includes(config.importMode)) {
      throw new ValidationException('导入模式只能是 strict 或 loose');
    }

    if (config.defaultTags && config.defaultTags.length > 10) {
      throw new ValidationException('默认标签数量不能超过10个');
    }

    if (config.defaultCategory && config.defaultCategory.length > 50) {
      throw new ValidationException('默认分类名称不能超过50个字符');
    }
  }

  /**
   * 组合方法：解析并验证配置
   */
  parseAndValidateConfig(
    configData: RawImportConfigData,
  ): ArticleImportConfigDto {
    const config = this.parseConfig(configData);
    this.validateConfig(config);
    return config;
  }

  /**
   * 解析布尔值的辅助方法
   */
  private parseBoolean(
    value: string | boolean | undefined,
    defaultValue: boolean,
  ): boolean {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return defaultValue;
  }
}
