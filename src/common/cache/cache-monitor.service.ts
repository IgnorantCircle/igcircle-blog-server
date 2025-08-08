import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { StructuredLoggerService } from '../logger/structured-logger.service';
import { ConfigService } from '@nestjs/config';

export interface CacheMetrics {
  /** 缓存命中次数 */
  hits: number;
  /** 缓存未命中次数 */
  misses: number;
  /** 缓存设置次数 */
  sets: number;
  /** 缓存删除次数 */
  deletes: number;
  /** 错误次数 */
  errors: number;
  /** 总执行时间 */
  totalExecutionTime: number;
  /** 平均执行时间 */
  averageExecutionTime: number;
  /** 命中率 */
  hitRate: number;
  /** 最后更新时间 */
  lastUpdated: Date;
}

export interface CacheEvent {
  type: 'hit' | 'miss' | 'set' | 'delete' | 'error';
  key: string;
  executionTime: number;
  timestamp: Date;
  error?: string;
}

export interface CachePerformanceReport {
  /** 时间段 */
  period: string;
  /** 总体指标 */
  overall: CacheMetrics;
  /** 按缓存类型分组的指标 */
  byType: Record<string, CacheMetrics>;
  /** 热点键 */
  hotKeys: Array<{
    key: string;
    accessCount: number;
    lastAccessed: Date;
  }>;
  /** 慢查询 */
  slowQueries: Array<{
    key: string;
    executionTime: number;
    timestamp: Date;
  }>;
  /** 错误统计 */
  errors: Array<{
    key: string;
    error: string;
    count: number;
    lastOccurred: Date;
  }>;
}

@Injectable()
export class CacheMonitorService implements OnModuleInit {
  private metrics: CacheMetrics;
  private typeMetrics: Map<string, CacheMetrics> = new Map();
  private keyAccessCount: Map<string, { count: number; lastAccessed: Date }> =
    new Map();
  private slowQueries: Array<{
    key: string;
    executionTime: number;
    timestamp: Date;
  }> = [];
  private errorStats: Map<
    string,
    { count: number; lastOccurred: Date; error: string }
  > = new Map();
  private reportInterval: number;
  private maxSlowQueries: number = 100;
  private maxHotKeys: number = 50;
  private slowQueryThreshold: number = 1000; // 1秒

  constructor(
    private readonly logger: StructuredLoggerService,
    private readonly configService: ConfigService,
  ) {
    this.logger.setContext({ module: 'CacheMonitorService' });
    this.initializeMetrics();
    this.reportInterval = this.configService.get(
      'CACHE_REPORT_INTERVAL',
      300000,
    ); // 5分钟
    this.slowQueryThreshold = this.configService.get(
      'CACHE_SLOW_QUERY_THRESHOLD',
      1000,
    );
  }

  onModuleInit() {
    this.startPeriodicReporting();
  }

  private initializeMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      hitRate: 0,
      lastUpdated: new Date(),
    };
  }

  private startPeriodicReporting(): void {
    setInterval(() => {
      this.generatePerformanceReport()
        .then((report) => {
          this.logger.log(
            `Cache performance report generated: ${JSON.stringify(report)}`,
          );
        })
        .catch((error) => {
          this.logger.error(
            'Failed to generate performance report',
            (error as Error).message,
          );
        });
    }, this.reportInterval);

    this.logger.log(
      `Cache monitoring started: reportInterval=${this.reportInterval}ms, slowQueryThreshold=${this.slowQueryThreshold}ms`,
    );
  }

  /**
   * 处理缓存事件
   */
  @OnEvent('cache.event')
  handleCacheEvent(event: CacheEvent): void {
    this.updateMetrics(event);
    this.trackKeyAccess(event);
    this.trackSlowQueries(event);
    this.trackErrors(event);
  }

  /**
   * 处理缓存监控事件
   */
  @OnEvent('cache.monitor')
  handleCacheMonitor(data: {
    key: string;
    hit: boolean;
    executionTime: number;
    timestamp: Date;
  }): void {
    const event: CacheEvent = {
      type: data.hit ? 'hit' : 'miss',
      key: data.key,
      executionTime: data.executionTime,
      timestamp: data.timestamp,
    };
    this.updateMetrics(event);
    this.trackKeyAccess(event);
    this.trackSlowQueries(event);
    this.trackErrors(event);
  }

  private updateMetrics(event: CacheEvent): void {
    // 更新总体指标
    this.updateMetricsObject(this.metrics, event);

    // 更新按类型分组的指标
    const cacheType = this.extractCacheType(event.key);
    if (cacheType) {
      if (!this.typeMetrics.has(cacheType)) {
        this.typeMetrics.set(cacheType, {
          hits: 0,
          misses: 0,
          sets: 0,
          deletes: 0,
          errors: 0,
          totalExecutionTime: 0,
          averageExecutionTime: 0,
          hitRate: 0,
          lastUpdated: new Date(),
        });
      }

      const typeMetrics = this.typeMetrics.get(cacheType)!;
      this.updateMetricsObject(typeMetrics, event);
    }
  }

  private updateMetricsObject(metrics: CacheMetrics, event: CacheEvent): void {
    switch (event.type) {
      case 'hit':
        metrics.hits++;
        break;
      case 'miss':
        metrics.misses++;
        break;
      case 'set':
        metrics.sets++;
        break;
      case 'delete':
        metrics.deletes++;
        break;
      case 'error':
        metrics.errors++;
        break;
    }

    metrics.totalExecutionTime += event.executionTime;

    const totalOperations =
      metrics.hits +
      metrics.misses +
      metrics.sets +
      metrics.deletes +
      metrics.errors;
    metrics.averageExecutionTime =
      totalOperations > 0 ? metrics.totalExecutionTime / totalOperations : 0;

    const totalCacheAccess = metrics.hits + metrics.misses;
    metrics.hitRate =
      totalCacheAccess > 0 ? metrics.hits / totalCacheAccess : 0;

    metrics.lastUpdated = new Date();
  }

  private trackKeyAccess(event: CacheEvent): void {
    if (event.type === 'hit' || event.type === 'miss') {
      const existing = this.keyAccessCount.get(event.key);
      if (existing) {
        existing.count++;
        existing.lastAccessed = event.timestamp;
      } else {
        this.keyAccessCount.set(event.key, {
          count: 1,
          lastAccessed: event.timestamp,
        });
      }

      // 限制热点键的数量
      if (this.keyAccessCount.size > this.maxHotKeys * 2) {
        this.pruneHotKeys();
      }
    }
  }

  private trackSlowQueries(event: CacheEvent): void {
    if (event.executionTime > this.slowQueryThreshold) {
      this.slowQueries.push({
        key: event.key,
        executionTime: event.executionTime,
        timestamp: event.timestamp,
      });

      // 限制慢查询记录数量
      if (this.slowQueries.length > this.maxSlowQueries) {
        this.slowQueries = this.slowQueries
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, this.maxSlowQueries);
      }
    }
  }

  private trackErrors(event: CacheEvent): void {
    if (event.type === 'error' && event.error) {
      const existing = this.errorStats.get(event.key);
      if (existing) {
        existing.count++;
        existing.lastOccurred = event.timestamp;
      } else {
        this.errorStats.set(event.key, {
          count: 1,
          lastOccurred: event.timestamp,
          error: event.error,
        });
      }
    }
  }

  private extractCacheType(key: string): string | null {
    // 从缓存键中提取类型，例如 "blog:article:123" -> "article"
    const parts = key.split(':');
    return parts.length >= 2 ? parts[1] : null;
  }

  private pruneHotKeys(): void {
    // 保留访问次数最多的键
    const sortedKeys = Array.from(this.keyAccessCount.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, this.maxHotKeys);

    this.keyAccessCount.clear();
    sortedKeys.forEach(([key, data]) => {
      this.keyAccessCount.set(key, data);
    });
  }

  /**
   * 生成性能报告
   */
  generatePerformanceReport(): Promise<CachePerformanceReport> {
    const hotKeys = Array.from(this.keyAccessCount.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, this.maxHotKeys)
      .map(([key, data]) => ({
        key,
        accessCount: data.count,
        lastAccessed: data.lastAccessed,
      }));

    const slowQueries = this.slowQueries
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 20); // 取前20个最慢的查询

    const errors = Array.from(this.errorStats.entries())
      .map(([key, data]) => ({
        key,
        error: data.error,
        count: data.count,
        lastOccurred: data.lastOccurred,
      }))
      .sort((a, b) => b.count - a.count);

    const byType: Record<string, CacheMetrics> = {};
    this.typeMetrics.forEach((metrics, type) => {
      byType[type] = { ...metrics };
    });

    return Promise.resolve({
      period: `${this.reportInterval / 1000}s`,
      overall: { ...this.metrics },
      byType,
      hotKeys,
      slowQueries,
      errors,
    });
  }

  /**
   * 获取当前指标
   */
  getCurrentMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * 获取按类型分组的指标
   */
  getMetricsByType(): Record<string, CacheMetrics> {
    const result: Record<string, CacheMetrics> = {};
    this.typeMetrics.forEach((metrics, type) => {
      result[type] = { ...metrics };
    });
    return result;
  }

  /**
   * 重置指标
   */
  resetMetrics(): void {
    this.initializeMetrics();
    this.typeMetrics.clear();
    this.keyAccessCount.clear();
    this.slowQueries.length = 0;
    this.errorStats.clear();

    this.logger.log('Cache metrics reset');
  }

  /**
   * 获取缓存健康评分
   */
  getHealthScore(): {
    score: number;
    status: 'excellent' | 'good' | 'fair' | 'poor';
    factors: Record<string, number>;
  } {
    const factors = {
      hitRate: this.metrics.hitRate * 100, // 命中率权重最高
      averageResponseTime: Math.max(
        0,
        100 - this.metrics.averageExecutionTime / 10,
      ), // 响应时间
      errorRate: Math.max(
        0,
        100 -
          (this.metrics.errors /
            Math.max(1, this.metrics.hits + this.metrics.misses)) *
            100,
      ), // 错误率
    };

    const score =
      factors.hitRate * 0.5 +
      factors.averageResponseTime * 0.3 +
      factors.errorRate * 0.2;

    let status: 'excellent' | 'good' | 'fair' | 'poor';
    if (score >= 90) {
      status = 'excellent';
    } else if (score >= 75) {
      status = 'good';
    } else if (score >= 60) {
      status = 'fair';
    } else {
      status = 'poor';
    }

    return { score, status, factors };
  }
}
