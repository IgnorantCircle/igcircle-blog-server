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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CommentService } from '@/services/comment.service';
import { JwtAuthGuard } from '@/guards/auth.guard';
import { RolesGuard } from '@/guards/roles.guard';
import { Roles } from '@/decorators/roles.decorator';
import { Role } from '@/enums/role.enum';
import { CurrentUser } from '@/decorators/user.decorator';
import { User } from '@/entities/user.entity';
import {
  CreateCommentDto,
  AdminUpdateCommentDto,
  CommentQueryDto,
} from '@/dto/comment.dto';
import { ResponseUtil } from '@/common/utils/response.util';
import { ApiResponse as ApiResponseInterface } from '@/common/interfaces/response.interface';

@ApiTags('管理员评论管理')
@Controller('admin/comments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AdminCommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  @ApiOperation({ summary: '管理员创建评论' })
  @ApiResponse({ status: 201, description: '评论创建成功' })
  async create(
    @Body() createCommentDto: CreateCommentDto,
    @CurrentUser() user: User,
  ): Promise<ApiResponseInterface<any>> {
    const comment = await this.commentService.create(createCommentDto, user.id);

    return ResponseUtil.created(comment, '评论创建成功');
  }

  @Get()
  @ApiOperation({ summary: '获取所有评论列表（管理员）' })
  @ApiResponse({ status: 200, description: '获取评论列表成功' })
  async findAll(
    @Query() query: CommentQueryDto,
  ): Promise<ApiResponseInterface<any>> {
    // 管理员可以查看所有状态的评论
    const queryDto = new CommentQueryDto();
    Object.assign(queryDto, query);
    queryDto.status = query.status; // 不设置默认状态过滤

    const { comments, total } = await this.commentService.findAll(queryDto);

    return ResponseUtil.paginated(
      comments,
      total,
      query.page || 1,
      query.limit || 10,
      '获取评论列表成功',
    );
  }

  @Get('stats')
  @ApiOperation({ summary: '获取评论统计信息' })
  @ApiResponse({ status: 200, description: '获取统计信息成功' })
  async getStatistics(): Promise<ApiResponseInterface<any>> {
    const createQueryDto = (status?: string) => {
      const queryDto = new CommentQueryDto();
      queryDto.limit = 1;
      if (status) queryDto.status = status;
      return queryDto;
    };

    const [activeComments, hiddenComments, deletedComments, totalComments] =
      await Promise.all([
        this.commentService.findAll(createQueryDto('active')),
        this.commentService.findAll(createQueryDto('hidden')),
        this.commentService.findAll(createQueryDto('deleted')),
        this.commentService.findAll(createQueryDto()),
      ]);

    const statistics = {
      total: totalComments.total,
      active: activeComments.total,
      hidden: hiddenComments.total,
      deleted: deletedComments.total,
    };

    return ResponseUtil.success(statistics, '获取统计信息成功');
  }

  @Get('pending-review')
  @ApiOperation({ summary: '获取待审核评论列表' })
  @ApiResponse({ status: 200, description: '获取待审核评论列表成功' })
  async getPendingReview(
    @Query() query: CommentQueryDto,
  ): Promise<ApiResponseInterface<any>> {
    // 这里可以根据业务需求定义待审核的条件
    // 例如：新注册用户的评论、包含敏感词的评论等
    const queryDto = new CommentQueryDto();
    Object.assign(queryDto, query);
    queryDto.status = 'active'; // 可以扩展为更复杂的审核逻辑
    queryDto.sortBy = 'createdAt';
    queryDto.sortOrder = 'DESC';

    const { comments, total } = await this.commentService.findAll(queryDto);

    return ResponseUtil.paginated(
      comments,
      total,
      query.page || 1,
      query.limit || 10,
      '获取待审核评论列表成功',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: '获取评论详情（管理员）' })
  @ApiParam({ name: 'id', description: '评论ID' })
  @ApiResponse({ status: 200, description: '获取评论详情成功' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseInterface<any>> {
    const comment = await this.commentService.findById(id);
    return ResponseUtil.success(comment, '获取评论详情成功');
  }

  @Put(':id')
  @ApiOperation({ summary: '更新评论（管理员）' })
  @ApiParam({ name: 'id', description: '评论ID' })
  @ApiResponse({ status: 200, description: '评论更新成功' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCommentDto: AdminUpdateCommentDto,
    @CurrentUser() user: User,
  ): Promise<ApiResponseInterface<any>> {
    const comment = await this.commentService.update(
      id,
      updateCommentDto,
      user.id,
      true, // 管理员权限
    );

    return ResponseUtil.success(comment, '评论更新成功');
  }

  @Put(':id/hide')
  @ApiOperation({ summary: '隐藏评论' })
  @ApiParam({ name: 'id', description: '评论ID' })
  @ApiResponse({ status: 200, description: '评论隐藏成功' })
  async hideComment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body('adminNote') adminNote?: string,
  ): Promise<ApiResponseInterface<any>> {
    const comment = await this.commentService.update(
      id,
      {
        status: 'hidden',
        adminNote: adminNote || '管理员隐藏',
      },
      user.id,
      true,
    );

    return ResponseUtil.success(comment, '评论隐藏成功');
  }

  @Put(':id/show')
  @ApiOperation({ summary: '显示评论' })
  @ApiParam({ name: 'id', description: '评论ID' })
  @ApiResponse({ status: 200, description: '评论显示成功' })
  async showComment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<ApiResponseInterface<any>> {
    const comment = await this.commentService.update(
      id,
      {
        status: 'active',
        adminNote: '管理员恢复显示',
      },
      user.id,
      true,
    );

    return ResponseUtil.success(comment, '评论显示成功');
  }

  @Put(':id/top')
  @ApiOperation({ summary: '置顶评论' })
  @ApiParam({ name: 'id', description: '评论ID' })
  @ApiResponse({ status: 200, description: '评论置顶成功' })
  async topComment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<ApiResponseInterface<any>> {
    const comment = await this.commentService.update(
      id,
      {
        isTop: true,
        adminNote: '管理员置顶',
      },
      user.id,
      true,
    );

    return ResponseUtil.success(comment, '评论置顶成功');
  }

  @Put(':id/untop')
  @ApiOperation({ summary: '取消置顶评论' })
  @ApiParam({ name: 'id', description: '评论ID' })
  @ApiResponse({ status: 200, description: '取消置顶成功' })
  async untopComment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<ApiResponseInterface<any>> {
    const comment = await this.commentService.update(
      id,
      {
        isTop: false,
        adminNote: '管理员取消置顶',
      },
      user.id,
      true,
    );

    return ResponseUtil.success(comment, '取消置顶成功');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除评论（管理员）' })
  @ApiParam({ name: 'id', description: '评论ID' })
  @ApiResponse({ status: 204, description: '评论删除成功' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<ApiResponseInterface<null>> {
    await this.commentService.remove(id, user.id, true);
    return ResponseUtil.noContent('评论删除成功');
  }

  @Post('batch-hide')
  @ApiOperation({ summary: '批量隐藏评论' })
  @ApiResponse({ status: 200, description: '批量隐藏成功' })
  async batchHide(
    @Body('commentIds') commentIds: string[],
    @Body('adminNote') adminNote: string,
    @CurrentUser() user: User,
  ): Promise<ApiResponseInterface<any>> {
    const results = await Promise.all(
      commentIds.map((id) =>
        this.commentService.update(
          id,
          {
            status: 'hidden',
            adminNote: adminNote || '批量隐藏',
          },
          user.id,
          true,
        ),
      ),
    );

    return ResponseUtil.success(
      { count: results.length },
      `成功隐藏 ${results.length} 条评论`,
    );
  }

  @Post('batch-delete')
  @ApiOperation({ summary: '批量删除评论' })
  @ApiResponse({ status: 200, description: '批量删除成功' })
  async batchDelete(
    @Body('commentIds') commentIds: string[],
    @CurrentUser() user: User,
  ): Promise<ApiResponseInterface<any>> {
    await Promise.all(
      commentIds.map((id) => this.commentService.remove(id, user.id, true)),
    );

    return ResponseUtil.success(
      { count: commentIds.length },
      `成功删除 ${commentIds.length} 条评论`,
    );
  }
}
