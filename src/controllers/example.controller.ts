import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApiResponse } from '@nestjs/swagger';
import { Public } from '@/decorators/public.decorator';
import {
  BusinessException,
  NotFoundException,
  ValidationException,
  ConflictException,
} from '@/common/exceptions/business.exception';
import { ErrorCode } from '@/common/constants/error-codes';
import { PaginationSortDto } from '@/dto/base/pagination.dto';
import {
  FieldVisibilityInterceptor,
  UsePublicVisibility,
} from '@/common/interceptors/field-visibility.interceptor';
import { PaginationUtil } from '@/common/utils/pagination.util';
import { PaginatedResponse } from '@/common/interfaces/response.interface';

@ApiTags('示例接口')
@Controller('examples')
@Public()
@UseInterceptors(FieldVisibilityInterceptor)
export class ExampleController {
  @Get('success')
  @UsePublicVisibility()
  @ApiOperation({ summary: '成功响应示例' })
  @ApiResponse({ status: 200, description: '操作成功' })
  getSuccess(): { id: number; name: string } {
    return { id: 1, name: '示例数据' };
  }

  @Get('success-custom')
  @UsePublicVisibility()
  @ApiOperation({ summary: '自定义成功响应示例' })
  @ApiResponse({ status: 200, description: '操作成功' })
  getSuccessCustom(): { id: number; name: string } {
    return { id: 1, name: '示例数据' };
  }

  @Get('paginated')
  @UsePublicVisibility()
  @ApiOperation({ summary: '分页响应示例' })
  @ApiResponse({ status: 200, description: '查询成功' })
  getPaginated(@Query() query: PaginationSortDto): any {
    const limit = query.limit || 10;
    const page = query.page || 1;
    const mockData = Array.from({ length: limit }, (_, i) => ({
      id: i + 1,
      name: `示例数据 ${i + 1}`,
    }));

    const result: PaginatedResponse<any> =
      PaginationUtil.buildPaginatedResponse(mockData, 100, page, limit);
    return result;
  }

  @Post('created')
  @UsePublicVisibility()
  @ApiOperation({ summary: '创建响应示例' })
  @ApiResponse({ status: 201, description: '创建成功' })
  postCreated(@Body() data: Record<string, any>): {
    id: number;
    createdAt: number;
    [key: string]: any;
  } {
    const result = { id: Date.now(), createdAt: Date.now(), ...data };
    return result;
  }

  @Get('not-found')
  @UsePublicVisibility()
  @ApiOperation({ summary: '404错误示例' })
  @ApiResponse({ status: 404, description: '资源不存在' })
  getNotFound() {
    throw new NotFoundException(ErrorCode.COMMON_NOT_FOUND, '示例资源');
  }

  @Get('business-error')
  @UsePublicVisibility()
  @ApiOperation({ summary: '业务错误示例' })
  @ApiResponse({ status: 400, description: '业务错误' })
  getBusinessError() {
    throw new BusinessException(
      ErrorCode.COMMON_NOT_FOUND,
      '这是一个业务逻辑错误示例',
    );
  }

  @Get('validation-error')
  @UsePublicVisibility()
  @ApiOperation({ summary: '验证错误示例' })
  @ApiResponse({ status: 400, description: '参数验证失败' })
  getValidationError() {
    throw new ValidationException('参数验证失败', [
      { field: 'name', message: '名称不能为空' },
      { field: 'email', message: '邮箱格式不正确' },
    ]);
  }

  @Get('conflict-error')
  @UsePublicVisibility()
  @ApiOperation({ summary: '冲突错误示例' })
  @ApiResponse({ status: 409, description: '资源冲突' })
  getConflictError() {
    throw new ConflictException(ErrorCode.USER_NOT_FOUND, '用户名已存在');
  }

  @Get('server-error')
  @UsePublicVisibility()
  @ApiOperation({ summary: '服务器错误示例' })
  @ApiResponse({ status: 500, description: '服务器内部错误' })
  getServerError() {
    throw new BusinessException(
      ErrorCode.COMMON_INTERNAL_ERROR,
      '这是一个服务器内部错误示例',
    );
  }

  @Get('user/:id')
  @UsePublicVisibility()
  @ApiOperation({ summary: '获取用户示例（带参数验证）' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: Object,
  })
  @ApiResponse({ status: 404, description: '用户不存在' })
  getUser(@Param('id', ParseUUIDPipe) id: string): {
    id: string;
    name: string;
    email: string;
  } {
    if (id === '00000000-0000-0000-0000-000000000999') {
      throw new NotFoundException(ErrorCode.USER_NOT_FOUND);
    }
    const result = { id, name: `用户${id}`, email: `user${id}@example.com` };
    return result;
  }
}
