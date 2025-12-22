/**
 * Session 池化管理器
 * 负责Session的��建、分配、使用限制和统计分析
 */

class SessionManager {
  constructor(env) {
    this.env = env;
    this.kv = env.CACHE;  // KV存储用于缓存
    this.db = env.DB;     // D1数据库用于持久化

    // 使用限制配置
    this.LIMITS = {
      image: 10,    // 每日图像生成限制
      video: 2,     // 每日视频生成限制
      avatar: 1     // 每日数字人生成限制
    };

    // Session池配置
    this.POOL_CONFIG = {
      minSize: 50,          // 最小Session池大小
      maxSize: 500,         // 最大Session池大小
      refreshThreshold: 0.2, // 当可用Session低于20%时触发补充
      healthCheckInterval: 300000, // 5分钟健康检查
      staleThreshold: 86400000    // 24小时未使用视为过期
    };
  }

  /**
   * 初始化Session管理器
   */
  async initialize() {
    console.log('Initializing Session Manager...');

    // 检查并初始化Session池
    await this.ensureSessionPool();

    // 启动健康检查定时任务
    this.startHealthCheck();

    console.log('Session Manager initialized');
  }

  /**
   * 获取可用的Session
   */
  async getAvailableSession(serviceType = 'image') {
    // 1. 尝试从缓存获取
    const cacheKey = `active_sessions:${serviceType}`;
    let sessionIds = await this.getCachedSessionIds(cacheKey);

    // 2. 如果没有可用的Session，刷新Session池
    if (!sessionIds || sessionIds.length === 0) {
      await this.refreshSessionPool(serviceType);
      sessionIds = await this.getCachedSessionIds(cacheKey);
    }

    // 3. 检查每个Session的使用限制
    for (const sessionId of sessionIds) {
      const usage = await this.getSessionUsage(sessionId);

      if (this.canUseSession(usage, serviceType)) {
        // 更新Session最后使用时间
        await this.updateSessionLastUsed(sessionId);
        return {
          sessionId,
          remaining: {
            image: this.LIMITS.image - usage.image_count,
            video: this.LIMITS.video - usage.video_count,
            avatar: this.LIMITS.avatar - usage.avatar_count
          }
        };
      }
    }

    // 4. 如果没有可用的Session，尝试创建新Session
    const newSession = await this.createNewSession();
    if (newSession) {
      return {
        sessionId: newSession,
        remaining: {
          image: this.LIMITS.image,
          video: this.LIMITS.video,
          avatar: this.LIMITS.avatar
        }
      };
    }

    throw new Error(`No available sessions for ${serviceType} service`);
  }

  /**
   * 记录Session使用
   */
  async recordUsage(sessionId, serviceType, metadata = {}) {
    const today = new Date().toISOString().split('T')[0];

    try {
      // 1. 更新使用计数
      await this.db.prepare(`
        INSERT OR REPLACE INTO session_usage (
          session_id, date, service_type, usage_count,
          last_used, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        sessionId,
        today,
        serviceType,
        new Date().toISOString(),
        JSON.stringify(metadata)
      ).run();

      // 2. 更新Session状态
      await this.db.prepare(`
        UPDATE sessions
        SET last_used = ?, request_count = request_count + 1
        WHERE session_id = ?
      `).bind(
        new Date().toISOString(),
        sessionId
      ).run();

      // 3. 更新缓存
      await this.updateUsageCache(sessionId);

      // 4. 记录详细日志
      await this.logUsage(sessionId, serviceType, metadata);

      console.log(`Usage recorded for session ${sessionId}: ${serviceType}`);

    } catch (error) {
      console.error('Failed to record usage:', error);
      throw error;
    }
  }

  /**
   * 检查Session是否可以使用
   */
  async canUseSession(sessionId, serviceType) {
    const usage = await this.getSessionUsage(sessionId);
    return this.canUseSession(usage, serviceType);
  }

  /**
   * 确保Session池中有足够的Session
   */
  async ensureSessionPool() {
    const activeSessions = await this.getActiveSessionsCount();

    if (activeSessions < this.POOL_CONFIG.minSize) {
      const needed = this.POOL_CONFIG.minSize - activeSessions;
      console.log(`Need to create ${needed} new sessions`);

      for (let i = 0; i < needed; i++) {
        await this.createNewSession();
      }
    }
  }

  /**
   * 创建新的Session
   */
  async createNewSession() {
    try {
      // 1. 生成唯一的Session ID
      const sessionId = this.generateSessionId();

      // 2. 查找可用的后端服务器
      const server = await this.selectLeastLoadedServer();

      // 3. 创建Session记录
      await this.db.prepare(`
        INSERT INTO sessions (
          session_id, server_url, status, created_at,
          last_used, health_score, request_count
        ) VALUES (?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 100, 0)
      `).bind(
        sessionId,
        server.url
      ).run();

      // 4. 缓存Session信息
      await this.cacheSessionInfo(sessionId, server);

      console.log(`Created new session: ${sessionId} on server: ${server.url}`);
      return sessionId;

    } catch (error) {
      console.error('Failed to create new session:', error);
      return null;
    }
  }

  /**
   * 刷新Session池
   */
  async refreshSessionPool(serviceType = null) {
    const sessions = await this.getAllSessions();
    const healthySessions = [];
    const now = Date.now();

    // 筛选健康的Session
    for (const session of sessions) {
      // 检查健康状态
      const isHealthy = await this.checkSessionHealth(session);

      // 检查是否过期
      const isStale = (now - new Date(session.last_used).getTime()) > this.POOL_CONFIG.staleThreshold;

      if (isHealthy && !isStale) {
        // 检查使用限制
        const usage = await this.getSessionUsage(session.session_id);

        if (serviceType) {
          if (this.canUseSession(usage, serviceType)) {
            healthySessions.push(session.session_id);
          }
        } else {
          healthySessions.push(session.session_id);
        }
      } else {
        // 标记Session为不健康或删除
        if (!isHealthy) {
          await this.markSessionUnhealthy(session.session_id);
        } else if (isStale) {
          await this.removeSession(session.session_id);
        }
      }
    }

    // 更新缓存
    const cacheKey = serviceType ? `active_sessions:${serviceType}` : 'active_sessions';
    await this.kv.put(cacheKey, JSON.stringify(healthySessions), {
      expirationTtl: 300 // 5分钟缓存
    });

    // 如果健康的Session太少，创建新的
    if (healthySessions.length < this.POOL_CONFIG.minSize) {
      const needed = Math.min(
        this.POOL_CONFIG.minSize - healthySessions.length,
        this.POOL_CONFIG.maxSize - sessions.length
      );

      for (let i = 0; i < needed; i++) {
        await this.createNewSession();
      }
    }

    return healthySessions;
  }

  /**
   * 获取Session的使用统计
   */
  async getSessionUsage(sessionId) {
    const today = new Date().toISOString().split('T')[0];

    // 先尝试从缓存获取
    const cacheKey = `usage:${sessionId}:${today}`;
    const cached = await this.kv.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // 从数据库查询
    const results = await this.db.prepare(`
      SELECT service_type, SUM(usage_count) as count
      FROM session_usage
      WHERE session_id = ? AND date = ?
      GROUP BY service_type
    `).bind(sessionId, today).all();

    const usage = {
      session_id: sessionId,
      date: today,
      image_count: 0,
      video_count: 0,
      avatar_count: 0
    };

    results.results.forEach(row => {
      usage[`${row.service_type}_count`] = row.count;
    });

    // 缓存结果
    await this.kv.put(cacheKey, JSON.stringify(usage), {
      expirationTtl: 300 // 5分钟缓存
    });

    return usage;
  }

  /**
   * 获取Session详细统计
   */
  async getSessionStats(sessionId, days = 7) {
    const stats = {
      sessionId,
      totalRequests: 0,
      dailyStats: [],
      serviceBreakdown: {
        image: 0,
        video: 0,
        avatar: 0
      },
      avgDailyUsage: {
        image: 0,
        video: 0,
        avatar: 0
      }
    };

    // 获取每日统计
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dailyResults = await this.db.prepare(`
      SELECT date, service_type, SUM(usage_count) as count
      FROM session_usage
      WHERE session_id = ? AND date >= ? AND date <= ?
      GROUP BY date, service_type
      ORDER BY date DESC
    `).bind(
      sessionId,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    ).all();

    // 组织数据
    const dailyMap = new Map();
    dailyResults.results.forEach(row => {
      if (!dailyMap.has(row.date)) {
        dailyMap.set(row.date, {
          date: row.date,
          image_count: 0,
          video_count: 0,
          avatar_count: 0
        });
      }

      const dayData = dailyMap.get(row.date);
      dayData[`${row.service_type}_count`] = row.count;
      stats.totalRequests += row.count;
      stats.serviceBreakdown[row.service_type] += row.count;
    });

    stats.dailyStats = Array.from(dailyMap.values());

    // 计算平均值
    const activeDays = dailyMap.size || 1;
    stats.avgDailyUsage.image = Math.round(stats.serviceBreakdown.image / activeDays);
    stats.avgDailyUsage.video = Math.round(stats.serviceBreakdown.video / activeDays);
    stats.avgDailyUsage.avatar = Math.round(stats.serviceBreakdown.avatar / activeDays);

    return stats;
  }

  /**
   * 获取全局统计
   */
  async getGlobalStats(date = null) {
    const targetDate = date || new Date().toISOString().split('T')[0];

    const stats = await this.db.prepare(`
      SELECT
        COUNT(DISTINCT su.session_id) as active_sessions,
        SUM(CASE WHEN su.service_type = 'image' THEN su.usage_count ELSE 0 END) as total_images,
        SUM(CASE WHEN su.service_type = 'video' THEN su.usage_count ELSE 0 END) as total_videos,
        SUM(CASE WHEN su.service_type = 'avatar' THEN su.usage_count ELSE 0 END) as total_avatars,
        AVG(s.request_count) as avg_requests_per_session
      FROM session_usage su
      JOIN sessions s ON su.session_id = s.session_id
      WHERE su.date = ?
    `).bind(targetDate).first();

    return {
      date: targetDate,
      active_sessions: stats.active_sessions || 0,
      total_images: stats.total_images || 0,
      total_videos: stats.total_videos || 0,
      total_avatars: stats.total_avatars || 0,
      avg_requests_per_session: Math.round(stats.avg_requests_per_session || 0)
    };
  }

  // 私有方法

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  canUseSession(usage, serviceType) {
    const limitKey = `${serviceType}_count`;
    return usage[limitKey] < this.LIMITS[serviceType];
  }

  async getCachedSessionIds(cacheKey) {
    try {
      const cached = await this.kv.get(cacheKey);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('Failed to get cached session IDs:', error);
      return [];
    }
  }

  async updateSessionLastUsed(sessionId) {
    await this.db.prepare(`
      UPDATE sessions SET last_used = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `).bind(sessionId).run();
  }

  async updateUsageCache(sessionId) {
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `usage:${sessionId}:${today}`;

    // 使缓存失效，下次访问时会重新加载
    await this.kv.delete(cacheKey);
  }

  async logUsage(sessionId, serviceType, metadata) {
    // 记录详细的使用日志
    await this.db.prepare(`
      INSERT INTO usage_logs (
        session_id, service_type, timestamp,
        ip_address, user_agent, metadata
      ) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?)
    `).bind(
      sessionId,
      serviceType,
      metadata.ip || 'unknown',
      metadata.userAgent || 'unknown',
      JSON.stringify(metadata)
    ).run();
  }

  async getActiveSessionsCount() {
    const result = await this.db.prepare(`
      SELECT COUNT(*) as count FROM sessions
      WHERE status = 'active' AND health_score > 50
    `).first();

    return result.count || 0;
  }

  async getAllSessions() {
    return await this.db.prepare(`
      SELECT * FROM sessions WHERE status = 'active'
      ORDER BY health_score DESC, last_used DESC
    `).all();
  }

  async checkSessionHealth(session) {
    try {
      const healthUrl = session.server_url + '/ping';
      const response = await fetch(healthUrl, {
        signal: AbortSignal.timeout(5000)
      });

      const isHealthy = response.ok;
      const newScore = isHealthy
        ? Math.min(100, session.health_score + 5)
        : Math.max(0, session.health_score - 20);

      // 更新健康分数
      if (Math.abs(newScore - session.health_score) > 10) {
        await this.db.prepare(`
          UPDATE sessions SET health_score = ?
          WHERE session_id = ?
        `).bind(newScore, session.session_id).run();
      }

      return isHealthy;
    } catch (error) {
      // 标记为不健康
      await this.db.prepare(`
        UPDATE sessions SET health_score = 0
        WHERE session_id = ?
      `).bind(session.session_id).run();

      return false;
    }
  }

  async markSessionUnhealthy(sessionId) {
    await this.db.prepare(`
      UPDATE sessions SET status = 'unhealthy', health_score = 0
      WHERE session_id = ?
    `).bind(sessionId).run();
  }

  async removeSession(sessionId) {
    await this.db.prepare(`
      DELETE FROM sessions WHERE session_id = ?
    `).bind(sessionId).run();

    // 清理相关缓存
    const keys = [
      `usage:${sessionId}:*`,
      `session_info:${sessionId}`
    ];

    // KV不支持批量删除，这里简化处理
    for (const key of keys) {
      await this.kv.delete(key);
    }
  }

  async cacheSessionInfo(sessionId, server) {
    const cacheKey = `session_info:${sessionId}`;
    await this.kv.put(cacheKey, JSON.stringify({
      sessionId,
      serverUrl: server.url,
      serverRegion: server.region,
      cachedAt: new Date().toISOString()
    }), {
      expirationTtl: 3600 // 1小时缓存
    });
  }

  async selectLeastLoadedServer() {
    // 这里应该与worker.js中的服务器选择逻辑一致
    // 简化处理，返回第一个服务器
    const BACKEND_SERVERS = [
      { url: 'https://your-jimeng-api-1.com', region: 'default' },
      { url: 'https://your-jimeng-api-2.com', region: 'backup' }
    ];

    // 实际实现中应该根据负载选择
    return BACKEND_SERVERS[0];
  }

  startHealthCheck() {
    // 这个应该在scheduled触发器中调用
    console.log('Health check scheduler started');
  }

  /**
   * 清理过期数据
   */
  async cleanup() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // 清理旧的使用记录
    const result = await this.db.prepare(`
      DELETE FROM session_usage WHERE date < ?
    `).bind(cutoffDateStr).run();

    // 清理旧的日志
    const logResult = await this.db.prepare(`
      DELETE FROM usage_logs WHERE timestamp < datetime('now', '-7 days')
    `).run();

    console.log(`Cleanup completed: ${result.changes} usage records, ${logResult.changes} log records removed`);
  }
}

module.exports = SessionManager;