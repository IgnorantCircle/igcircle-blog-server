import { Injectable } from '@nestjs/common';
import { ValidationException } from '@/common/exceptions/business.exception';
import { ArticleParserService } from '@/services/article-import/article-parser.service';

export interface FileValidationResultItem {
  filename: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  title?: string;
  hasContent: boolean;
}

export interface FileValidationResponse {
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  results: FileValidationResultItem[];
}

@Injectable()
export class FileValidationService {
  constructor(private readonly articleParserService: ArticleParserService) {}

  /**
   * 验证文件数组的基本格式
   */
  validateFilesFormat(files: any, action: string): Express.Multer.File[] {
    if (!files || (Array.isArray(files) && files.length === 0)) {
      throw new ValidationException(`${action}失败：请选择要${action}的文件`);
    }

    // 将files对象转换为数组
    let filesArray: Express.Multer.File[];
    if (Array.isArray(files)) {
      filesArray = files as Express.Multer.File[];
    } else {
      const fileValues = Object.values(files || {});
      // 确保所有值都是File类型
      filesArray = fileValues.filter(
        (file): file is Express.Multer.File =>
          file !== null &&
          typeof file === 'object' &&
          'originalname' in file &&
          'buffer' in file,
      );
    }

    if (filesArray.length === 0) {
      throw new ValidationException(`${action}失败：请选择要${action}的文件`);
    }

    return filesArray;
  }

  /**
   * 验证文件内容并返回详细结果
   */
  validateFilesContent(files: Express.Multer.File[]): FileValidationResponse {
    const results = files.map((file): FileValidationResultItem => {
      try {
        const content = file.buffer.toString('utf-8');
        const validation = this.articleParserService.validateAndParseFile(
          content,
          file.originalname,
        );

        return {
          filename: file.originalname,
          isValid: validation.isValid,
          errors: validation.errors,
          warnings: validation.warnings,
          title: validation.data?.title,
          hasContent: Boolean(validation.data?.content?.trim()),
        };
      } catch (error) {
        return {
          filename: file.originalname,
          isValid: false,
          errors: [error instanceof Error ? error.message : '验证失败'],
          warnings: [],
          title: undefined,
          hasContent: false,
        };
      }
    });

    const validFiles = results.filter((r) => r.isValid).length;
    const invalidFiles = results.filter((r) => !r.isValid).length;

    return {
      totalFiles: files.length,
      validFiles,
      invalidFiles,
      results,
    };
  }

  /**
   * 组合验证：格式验证 + 内容验证
   */
  validateFiles(
    files: any,
    action: string,
    validateContent = false,
  ): {
    filesArray: Express.Multer.File[];
    validation?: FileValidationResponse;
  } {
    const filesArray = this.validateFilesFormat(files, action);

    if (validateContent) {
      const validation = this.validateFilesContent(filesArray);
      return { filesArray, validation };
    }

    return { filesArray };
  }
}
