import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CommentService } from '@/services/comment.service';

import { RolesGuard } from '@/guards/roles.guard';
import { Roles } from '@/decorators/roles.decorator';
import { Role } from '@/enums/role.enum';
import { CurrentUser } from '@/decorators/user.decorator';
import { User } from '@/entities/user.entity';
import {
  CreateCommentDto,
  AdminUpdateCommentDto,
  CommentQueryDto,
  CommentStatus,
} from '@/dto/comment.dto';
import {
  FieldVisibilityInterceptor,
  UseAdminVisibility,
} from '@/common/interceptors/field-visibility.interceptor';
import { PaginationUtil } from '@/common/utils/pagination.util';

@ApiTags('1.4 管理端API - 评论管理')
@Controller('admin/comments')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
@UseInterceptors(FieldVisibilityInterceptor)
export class AdminCommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  @UseAdminVisibility()
  @ApiOperation({ summary: '管理员创建评论' })
  @ApiResponse({ status: 201, description: '评论创建成功' })
  async create(
    @Body() createCommentDto: CreateCommentDto,
    @CurrentUser() user: User,
  ): Promise<any> {
    const comment = await this.commentService.createComment(
      createCommentDto,
      user.id,
    );

    return comment;
  }

  @Get()
  @UseAdminVisibility()
  @ApiOperation({ summary: '获取所有评论列表（管理员）' })
  @ApiResponse({ status: 200, description: '获取评论列表成功' })
  async findAll(@Query() query: CommentQueryDto): Promise<any> {
    // 管理员可以查看所有状态的评论
    const queryDto = new CommentQueryDto();
    Object.assign(queryDto, query);
    queryDto.status = query.status; // 不设置默认状态过滤

    const result = await this.commentService.findAllPaginated(queryDto);

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    return PaginationUtil.fromQueryResult(result, page, limit);
  }

  @Get('stats')
  @UseAdminVisibility()
  @ApiOperation({ summary: '获取评论统计信息' })
  @ApiResponse({ status: 200, description: '获取统计信息成功' })
  async getStatistics(): Promise<any> {
    const createQueryDto = (status?: CommentStatus) => {
      const queryDto = new CommentQueryDto();
      queryDto.limit = 1;
      if (status) queryDto.status = status;
      return queryDto;
    };

    const [activeComments, hiddenComments, deletedComments, totalComments] =
      await Promise.all([
        this.commentService.findAllComments(
          createQueryDto(CommentStatus.ACTIVE),
        ),
        this.commentService.findAllComments(
          createQueryDto(CommentStatus.HIDDEN),
        ),
        this.commentService.findAllComments(
          createQueryDto(CommentStatus.DELETED),
        ),
        this.commentService.findAllComments(createQueryDto()),
      ]);

    const statistics = {
      total: totalComments.total,
      active: activeComments.total,
      hidden: hiddenComments.total,
      deleted: deletedComments.total,
    };

    return statistics;
  }

  @Get('pending-review')
  @UseAdminVisibility()
  @ApiOperation({ summary: '获取待审核评论列表' })
  @ApiResponse({ status: 200, description: '获取待审核评论列表成功' })
  async getPendingReview(@Query() query: CommentQueryDto): Promise<any> {
    // 这里可以根据业务需求定义待审核的条件
    // 例如：新注册用户的评论、包含敏感词的评论等
    const queryDto = new CommentQueryDto();
    Object.assign(queryDto, query);
    queryDto.status = CommentStatus.ACTIVE;
    queryDto.sortBy = 'createdAt';
    queryDto.sortOrder = 'DESC';

    const { comments, total } =
      await this.commentService.findAllComments(queryDto);

    return {
      comments,
      total,
      page: query.page || 1,
      limit: query.limit || 10,
    };
  }

  @Get(':id')
  @UseAdminVisibility()
  @ApiOperation({ summary: '获取评论详情（管理员）' })
  @ApiParam({ name: 'id', description: '评论ID' })
  @ApiResponse({ status: 200, description: '获取评论详情成功' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<any> {
    const comment = await this.commentService.findById(id);
    return comment;
  }

  @Put(':id')
  @UseAdminVisibility()
  @ApiOperation({ summary: '更新评论（管理员）' })
  @ApiParam({ name: 'id', description: '评论ID' })
  @ApiResponse({ status: 200, description: '评论更新成功' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCommentDto: AdminUpdateCommentDto,
    @CurrentUser() user: User,
  ): Promise<any> {
    const comment = await this.commentService.update(
      id,
      updateCommentDto,
      user.id,
      true, // 管理员权限
    );

    return comment;
  }

  @Put(':id/hide')
  @UseAdminVisibility()
  @ApiOperation({ summary: '隐藏评论' })
  @ApiParam({ name: 'id', description: '评论ID' })
  @ApiResponse({ status: 200, description: '评论隐藏成功' })
  async hideComment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body('adminNote') adminNote?: string,
  ): Promise<any> {
    const comment = await this.commentService.update(
      id,
      {
        status: CommentStatus.HIDDEN,
        adminNote: adminNote || '管理员隐藏',
      },
      user.id,
      true,
    );

    return comment;
  }

  @Put(':id/show')
  @UseAdminVisibility()
  @ApiOperation({ summary: '显示评论' })
  @ApiParam({ name: 'id', description: '评论ID' })
  @ApiResponse({ status: 200, description: '评论显示成功' })
  async showComment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<any> {
    const comment = await this.commentService.update(
      id,
      {
        status: CommentStatus.ACTIVE,
        adminNote: '管理员恢复显示',
      },
      user.id,
      true,
    );

    return comment;
  }

  @Put(':id/top')
  @UseAdminVisibility()
  @ApiOperation({ summary: '置顶评论' })
  @ApiParam({ name: 'id', description: '评论ID' })
  @ApiResponse({ status: 200, description: '评论置顶成功' })
  async topComment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<any> {
    const comment = await this.commentService.update(
      id,
      {
        isTop: true,
        adminNote: '管理员置顶',
      },
      user.id,
      true,
    );

    return comment;
  }

  @Put(':id/untop')
  @UseAdminVisibility()
  @ApiOperation({ summary: '取消置顶评论' })
  @ApiParam({ name: 'id', description: '评论ID' })
  @ApiResponse({ status: 200, description: '取消置顶成功' })
  async untopComment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<any> {
    const comment = await this.commentService.update(
      id,
      {
        isTop: false,
        adminNote: '管理员取消置顶',
      },
      user.id,
      true,
    );

    return comment;
  }

  @Delete(':id')
  @UseAdminVisibility()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除评论（管理员）' })
  @ApiParam({ name: 'id', description: '评论ID' })
  @ApiResponse({ status: 200, description: '评论删除成功' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<any> {
    await this.commentService.remove(id, user.id, true);
    return { message: '评论删除成功' };
  }

  @Post('batch-hide')
  @UseAdminVisibility()
  @ApiOperation({ summary: '批量隐藏评论' })
  @ApiResponse({ status: 200, description: '批量隐藏成功' })
  async batchHide(
    @Body('commentIds') commentIds: string[],
    @Body('adminNote') adminNote: string,
    @CurrentUser() user: User,
  ): Promise<any> {
    const results = await Promise.all(
      commentIds.map((id) =>
        this.commentService.update(
          id,
          {
            status: CommentStatus.HIDDEN,
            adminNote: adminNote || '批量隐藏',
          },
          user.id,
          true,
        ),
      ),
    );

    return results;
  }

  @Post('batch-delete')
  @UseAdminVisibility()
  @ApiOperation({ summary: '批量删除评论' })
  @ApiResponse({ status: 200, description: '批量删除成功' })
  async batchDelete(
    @Body('commentIds') commentIds: string[],
    @CurrentUser() user: User,
  ): Promise<any> {
    const results = await Promise.all(
      commentIds.map((id) => this.commentService.remove(id, user.id, true)),
    );

    return { message: '批量删除成功', count: results.length };
  }
}
