import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ResponseUtil } from '@/common/utils/response.util';
import {
  BusinessException,
  NotFoundException,
  ValidationException,
  ConflictException,
} from '@/common/exceptions/business.exception';
import { PaginationDto } from '@/common/dto/pagination.dto';
// 定义创建数据的接口
interface CreateExampleDto {
  [key: string]: any;
}

// 定义返回数据的接口
interface CreatedExampleDto extends CreateExampleDto {
  id: number;
  createdAt: Date;
}
@ApiTags('示例接口')
@Controller('examples')
export class ExampleController {
  @Get('success')
  @ApiOperation({ summary: '成功响应示例' })
  @ApiResponse({ status: 200, description: '操作成功' })
  getSuccess() {
    return {
      message: '这是一个成功的响应示例',
      data: { id: 1, name: '示例数据' },
    };
  }

  @Get('success-custom')
  @ApiOperation({ summary: '自定义成功响应示例' })
  @ApiResponse({ status: 200, description: '操作成功' })
  getSuccessCustom() {
    return ResponseUtil.success({ id: 1, name: '示例数据' }, '自定义成功消息');
  }

  @Get('paginated')
  @ApiOperation({ summary: '分页响应示例' })
  @ApiResponse({ status: 200, description: '查询成功' })
  getPaginated(@Query() query: PaginationDto) {
    const limit = query.limit || 10;
    const page = query.page || 1;
    const mockData = Array.from({ length: limit }, (_, i) => ({
      id: i + 1,
      name: `示例数据 ${i + 1}`,
    }));

    return ResponseUtil.paginated(
      mockData,
      100, // 总数
      page,
      limit,
      '分页查询成功',
    );
  }

  @Post('created')
  @ApiOperation({ summary: '创建响应示例' })
  @ApiResponse({ status: 201, description: '创建成功' })
  postCreated(@Body() data: CreateExampleDto): CreatedExampleDto {
    return { id: 1, ...data, createdAt: new Date() };
  }

  @Get('not-found')
  @ApiOperation({ summary: '404错误示例' })
  @ApiResponse({ status: 404, description: '资源不存在' })
  getNotFound() {
    throw new NotFoundException('示例资源');
  }

  @Get('business-error')
  @ApiOperation({ summary: '业务错误示例' })
  @ApiResponse({ status: 400, description: '业务错误' })
  getBusinessError() {
    throw new BusinessException('这是一个业务逻辑错误示例');
  }

  @Get('validation-error')
  @ApiOperation({ summary: '验证错误示例' })
  @ApiResponse({ status: 400, description: '参数验证失败' })
  getValidationError() {
    throw new ValidationException('参数验证失败', [
      { field: 'name', message: '名称不能为空' },
      { field: 'email', message: '邮箱格式不正确' },
    ]);
  }

  @Get('conflict-error')
  @ApiOperation({ summary: '冲突错误示例' })
  @ApiResponse({ status: 409, description: '资源冲突' })
  getConflictError() {
    throw new ConflictException('用户名已存在');
  }

  @Get('server-error')
  @ApiOperation({ summary: '服务器错误示例' })
  @ApiResponse({ status: 500, description: '服务器内部错误' })
  getServerError() {
    throw new Error('这是一个服务器内部错误示例');
  }

  @Get('user/:id')
  @ApiOperation({ summary: '获取用户示例（带参数验证）' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  getUser(@Param('id', ParseIntPipe) id: number) {
    if (id === 999) {
      throw new NotFoundException('用户');
    }
    return { id, name: `用户${id}`, email: `user${id}@example.com` };
  }
}
