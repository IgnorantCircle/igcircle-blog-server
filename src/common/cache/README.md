# 缓存系统使用指南

本项目实现了一个完整的缓存系统，包括缓存策略、事件监听、性能监控和管理接口。

## 核心组件

### 1. CacheStrategyService

核心缓存服务，提供基础的缓存操作功能。

```typescript
import { CacheStrategyService } from '@/common/cache/cache-strategy.service';

@Injectable()
export class UserService {
  constructor(
    private readonly cacheStrategy: CacheStrategyService,
  ) {}

  async getUser(id: string) {
    // 尝试从缓存获取
    const cached = await this.cacheStrategy.get(`user:${id}`, {
      type: 'user',
    });
    
    if (cached) {
      return cached;
    }
    
    // 从数据库获取
    const user = await this.userRepository.findById(id);
    
    // 缓存结果
    await this.cacheStrategy.set(`user:${id}`, user, {
      type: 'user',
      ttl: 1800, // 30分钟
      tags: ['user', 'auth'],
    });
    
    return user;
  }
}
```

### 2. 缓存装饰器

使用装饰器简化缓存操作：

```typescript
import { Cache, CacheEvict } from '@/common/decorators/cache.decorator';

@Injectable()
export class ArticleService {
  @Cache({
    key: 'article:{0}', // 使用第一个参数作为键
    type: 'article',
    ttl: 3600,
    tags: ['article', 'content'],
  })
  async getArticle(id: string) {
    return await this.articleRepository.findById(id);
  }

  @CacheEvict({
    tags: ['article', 'content'],
    patterns: ['article:*', 'articles:*'],
  })
  async createArticle(data: CreateArticleDto) {
    return await this.articleRepository.create(data);
  }
}
```

### 3. 缓存事件系统

自动处理缓存失效：

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CacheInvalidationEvent } from '@/common/cache/cache-event.listener';

@Injectable()
export class ArticleService {
  constructor(
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async updateArticle(id: string, data: UpdateArticleDto) {
    const article = await this.articleRepository.update(id, data);
    
    // 发送缓存失效事件
    const event: CacheInvalidationEvent = {
      type: 'article',
      action: 'update',
      entityId: id,
      relatedIds: [article.categoryId], // 相关的分类也需要清除缓存
      tags: ['article', 'content'],
    };
    
    this.eventEmitter.emit('cache.invalidate.article', event);
    
    return article;
  }
}
```

## 缓存配置

### 默认配置

系统提供了多种缓存类型的默认配置：

```typescript
// 在 cache.config.ts 中定义
export const DEFAULT_CACHE_CONFIGS = {
  user: {
    type: 'user',
    prefix: 'user',
    ttl: 1800, // 30分钟
    tags: ['user', 'auth'],
    enabled: true,
    maxSize: 10000,
    compressionThreshold: 1024,
  },
  article: {
    type: 'article',
    prefix: 'article',
    ttl: 3600, // 1小时
    tags: ['article', 'content'],
    enabled: true,
    maxSize: 5000,
    compressionThreshold: 2048,
  },
  // ... 更多配置
};
```

### 环境特定配置

不同环境可以有不同的缓存策略：

```typescript
// 开发环境：更详细的监控，较短的TTL
// 生产环境：优化的性能，较长的TTL
// 测试环境：禁用缓存或使用内存缓存
```

## 缓存监控

### 性能指标

系统自动收集以下指标：

- 缓存命中率
- 平均响应时间
- 错误率
- 热点键统计
- 慢查询记录

### 监控 API

```bash
# 获取缓存统计
GET /admin/cache/stats

# 获取性能报告
GET /admin/cache/performance-report

# 获取健康评分
GET /admin/cache/health-score

# 重置监控指标
POST /admin/cache/reset-metrics
```

## 缓存管理

### 清除缓存

```bash
# 按标签清除
DELETE /admin/cache/clear?tags=article,content

# 按模式清除
DELETE /admin/cache/clear?patterns=article:*

# 按类型清除
DELETE /admin/cache/clear?types=article

# 清除所有缓存
DELETE /admin/cache/clear-all
```

### 缓存预热

```bash
# 预热指定类型的缓存
POST /admin/cache/warmup
{
  "types": ["article", "user"]
}
```

### 配置管理

```bash
# 获取缓存配置
GET /admin/cache/config

# 更新特定类型的配置
PUT /admin/cache/config/article
{
  "ttl": 7200,
  "enabled": true
}
```

## 最佳实践

### 1. 缓存键设计

```typescript
// 好的做法：使用层次化的键名
'blog:article:123'
'blog:user:profile:456'
'blog:category:list:page:1'

// 避免：过于复杂或包含特殊字符的键名
'article_with_comments_and_tags_123'
'user:profile@domain.com'
```

### 2. TTL 设置

```typescript
// 根据数据更新频率设置合适的TTL
// 用户信息：30分钟（可能会更新）
// 文章内容：1小时（相对稳定）
// 分类列表：2小时（很少变化）
// 统计数据：5分钟（需要实时性）
```

### 3. 标签使用

```typescript
// 使用标签进行批量清除
const tags = ['article', 'content']; // 文章相关
const tags = ['user', 'auth']; // 用户认证相关
const tags = ['stats', 'analytics']; // 统计分析相关
```

### 4. 错误处理

```typescript
// 缓存操作应该是非阻塞的
try {
  const cached = await this.cacheStrategy.get(key, options);
  if (cached) {
    return cached;
  }
} catch (error) {
  // 记录错误但不影响业务逻辑
  this.logger.warn('Cache get failed', { error, key });
}

// 继续执行业务逻辑
const result = await this.businessLogic();

// 尝试缓存结果
try {
  await this.cacheStrategy.set(key, result, options);
} catch (error) {
  this.logger.warn('Cache set failed', { error, key });
}

return result;
```

### 5. 缓存预热

```typescript
// 在应用启动时预热关键数据
@Injectable()
export class CacheWarmupService implements OnApplicationBootstrap {
  async onApplicationBootstrap() {
    await this.warmupPopularArticles();
    await this.warmupCategories();
    await this.warmupUserProfiles();
  }

  private async warmupPopularArticles() {
    const articles = await this.articleService.getPopularArticles();
    for (const article of articles) {
      await this.cacheStrategy.set(
        `article:${article.id}`,
        article,
        { type: 'article' }
      );
    }
  }
}
```

## 故障排除

### 常见问题

1. **缓存命中率低**
   - 检查TTL设置是否合理
   - 确认缓存键的一致性
   - 查看是否有频繁的缓存清除操作

2. **内存使用过高**
   - 启用数据压缩
   - 调整缓存大小限制
   - 检查是否有内存泄漏

3. **响应时间慢**
   - 检查Redis连接状态
   - 优化缓存键的设计
   - 考虑使用缓存预热

### 监控告警

建议设置以下监控告警：

- 缓存命中率低于80%
- 平均响应时间超过100ms
- 错误率超过1%
- Redis内存使用率超过80%

## 性能优化

### 1. 数据压缩

系统自动对大于阈值的数据进行压缩：

```typescript
// 配置压缩阈值
compressionThreshold: 1024, // 1KB
```

### 2. 批量操作

```typescript
// 使用批量删除
await this.cacheStrategy.delMultiple([
  'article:1',
  'article:2',
  'article:3',
]);

// 使用模式删除
await this.cacheStrategy.clearCacheByPattern('article:*');
```

### 3. 连接池优化

```typescript
// 在 redis.config.ts 中配置连接池
{
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  lazyConnect: true,
  keepAlive: 30000,
}
```

这个缓存系统提供了完整的缓存解决方案，包括自动失效、性能监控、管理接口等功能，可以显著提升应用的性能和用户体验。