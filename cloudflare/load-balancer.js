/**
 * 负载均衡器
 * 负责智能路由和服务器选择
 */

class LoadBalancer {
  constructor(env) {
    this.env = env;
    this.db = env.DB;
    this.kv = env.CACHE;

    // 服务器配置
    this.servers = [
      {
        id: 'server-1',
        url: 'https://your-jimeng-api-1.com',
        region: 'asia-east',
        priority: 1,
        weight: 3,
        maxSessions: 200,
        capabilities: ['image', 'video', 'avatar']
      },
      {
        id: 'server-2',
        url: 'https://your-jimeng-api-2.com',
        region: 'asia-east',
        priority: 2,
        weight: 2,
        maxSessions: 150,
        capabilities: ['image', 'video']
      },
      {
        id: 'server-3',
        url: 'https://your-jimeng-api-3.com',
        region: 'us-west',
        priority: 3,
        weight: 2,
        maxSessions: 100,
        capabilities: ['image']
      },
      {
        id: 'server-4',
        url: 'https://your-jimeng-api-4.com',
        region: 'europe-west',
        priority: 4,
        weight: 1,
        maxSessions: 100,
        capabilities: ['image', 'video']
      }
    ];

    // 负载均衡策略
    this.STRATEGIES = {
      ROUND_ROBIN: 'round_robin',
      WEIGHTED_ROUND_ROBIN: 'weighted_round_robin',
      LEAST_CONNECTIONS: 'least_connections',
      LEAST_RESPONSE_TIME: 'least_response_time',
      GEOGRAPHIC: 'geographic',
      CAPABILITY_BASED: 'capability_based'
    };

    // 当前策略
    this.currentStrategy = this.STRATEGIES.CAPABILITY_BASED;

    // 服务器状态缓存
    this.serverStats = new Map();

    // 初始化
    this.initialize();
  }

  /**
   * 初始化负载均衡器
   */
  async initialize() {
    console.log('Initializing Load Balancer...');

    // 加载服务器统计信息
    await this.loadServerStats();

    // 启动健康监控
    this.startHealthMonitoring();

    console.log('Load Balancer initialized with strategy:', this.currentStrategy);
  }

  /**
   * 选择最优服务器
   */
  async selectServer(requestInfo) {
    const { serviceType, clientIP, userAgent, region } = requestInfo;

    // 1. 获取可用的服务器列表
    const availableServers = await this.getAvailableServers(serviceType);

    if (availableServers.length === 0) {
      throw new Error('No available servers');
    }

    // 2. 根据策略选择服务器
    let selectedServer;
    switch (this.currentStrategy) {
      case this.STRATEGIES.CAPABILITY_BASED:
        selectedServer = await this.selectByCapability(availableServers, serviceType, requestInfo);
        break;

      case this.STRATEGIES.LEAST_CONNECTIONS:
        selectedServer = await this.selectByLeastConnections(availableServers);
        break;

      case this.STRATEGIES.LEAST_RESPONSE_TIME:
        selectedServer = await this.selectByLeastResponseTime(availableServers);
        break;

      case this.STRATEGIES.GEOGRAPHIC:
        selectedServer = await this.selectByGeography(availableServers, region);
        break;

      case this.STRATEGIES.WEIGHTED_ROUND_ROBIN:
        selectedServer = await this.selectByWeightedRoundRobin(availableServers);
        break;

      default:
        selectedServer = availableServers[0];
    }

    // 3. 更新服务器统计
    await this.incrementServerConnections(selectedServer.id);

    // 4. 记录选择日志
    await this.logServerSelection(selectedServer.id, serviceType, this.currentStrategy);

    return selectedServer;
  }

  /**
   * 获取可用的服务器列表
   */
  async getAvailableServers(serviceType) {
    const available = [];

    for (const server of this.servers) {
      // 检查服务器健康状态
      const isHealthy = await this.isServerHealthy(server);
      if (!isHealthy) continue;

      // 检查服务能力
      if (!server.capabilities.includes(serviceType)) continue;

      // 检查会话限制
      const sessionCount = await this.getServerSessionCount(server.id);
      if (sessionCount >= server.maxSessions) continue;

      available.push({
        ...server,
        currentConnections: sessionCount,
        healthScore: await this.getServerHealthScore(server.id)
      });
    }

    return available.sort((a, b) => {
      // 按优先级排序
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // 相同优先级按健康分数排序
      return b.healthScore - a.healthScore;
    });
  }

  /**
   * 基于能力的服务器选择
   */
  async selectByCapability(servers, serviceType, requestInfo) {
    // 1. 优先选择专用于该服务的服务器
    const specialized = servers.filter(s => {
      const stats = this.serverStats.get(s.id);
      return stats && stats.serviceStats[serviceType] > 10; // 有处理经验
    });

    if (specialized.length > 0) {
      // 2. 在专业服务器中选择负载最低的
      return specialized.reduce((best, current) => {
        return current.currentConnections < best.currentConnections ? current : best;
      });
    }

    // 3. 如果没有专业服务器，使用最少连接策略
    return await this.selectByLeastConnections(servers);
  }

  /**
   * 基于最少连接的服务器选择
   */
  async selectByLeastConnections(servers) {
    return servers.reduce((best, current) => {
      return current.currentConnections < best.currentConnections ? current : best;
    });
  }

  /**
   * 基于响应时间的服务器选择
   */
  async selectByLeastResponseTime(servers) {
    const serversWithStats = await Promise.all(
      servers.map(async server => {
        const stats = await this.getServerStats(server.id);
        return {
          ...server,
          avgResponseTime: stats.avgResponseTime || 1000
        };
      })
    );

    return serversWithStats.reduce((best, current) => {
      return current.avgResponseTime < best.avgResponseTime ? current : best;
    });
  }

  /**
   * 基于地理位置的服务器选择
   */
  async selectByGeography(servers, clientRegion) {
    // 地理位置映射
    const regionMapping = {
      'asia': ['asia-east', 'asia-southeast'],
      'china': ['asia-east'],
      'us': ['us-west', 'us-east'],
      'europe': ['europe-west'],
      'japan': ['asia-northeast']
    };

    // 获取客户端所在大区
    const detectedRegion = this.detectClientRegion(clientRegion);
    const preferredRegions = regionMapping[detectedRegion] || ['asia-east'];

    // 优先选择最近的服务器
    for (const region of preferredRegions) {
      const regionalServers = servers.filter(s => s.region === region);
      if (regionalServers.length > 0) {
        return await this.selectByLeastConnections(regionalServers);
      }
    }

    // 如果没有就近服务器，使用默认策略
    return await this.selectByLeastConnections(servers);
  }

  /**
   * 加权轮询服务器选择
   */
  async selectByWeightedRoundRobin(servers) {
    const totalWeight = servers.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;

    for (const server of servers) {
      random -= server.weight;
      if (random <= 0) {
        return server;
      }
    }

    return servers[0];
  }

  /**
   * 记录服务器使用统计
   */
  async recordServerUsage(serverId, serviceType, responseTime, success) {
    const today = new Date().toISOString().split('T')[0];

    try {
      // 更新服务器统计
      await this.db.prepare(`
        INSERT OR REPLACE INTO server_stats (
          server_id, server_url, date, total_requests,
          successful_requests, failed_requests, avg_response_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        serverId,
        this.servers.find(s => s.id === serverId)?.url || '',
        today,
        1,
        success ? 1 : 0,
        success ? 0 : 1,
        responseTime
      ).run();

      // 更新内存缓存
      const stats = this.serverStats.get(serverId) || {
        totalRequests: 0,
        successfulRequests: 0,
        avgResponseTime: 0,
        serviceStats: {
          image: 0,
          video: 0,
          avatar: 0
        }
      };

      stats.totalRequests++;
      if (success) {
        stats.successfulRequests++;
      }
      stats.avgResponseTime = (stats.avgResponseTime + responseTime) / 2;
      stats.serviceStats[serviceType]++;

      this.serverStats.set(serverId, stats);

      // 减少连接计数
      await this.decrementServerConnections(serverId);

    } catch (error) {
      console.error('Failed to record server usage:', error);
    }
  }

  /**
   * 获取服务器统计信息
   */
  async getServerStats(serverId) {
    const cached = this.serverStats.get(serverId);
    if (cached) {
      return cached;
    }

    // 从数据库加载
    const result = await this.db.prepare(`
      SELECT
        SUM(total_requests) as total_requests,
        SUM(successful_requests) as successful_requests,
        AVG(avg_response_time) as avg_response_time
      FROM server_stats
      WHERE server_id = ? AND date >= DATE('now', '-7 days')
    `).bind(serverId).first();

    const stats = {
      totalRequests: result.total_requests || 0,
      successfulRequests: result.successful_requests || 0,
      avgResponseTime: result.avg_response_time || 1000,
      serviceStats: {
        image: 0,
        video: 0,
        avatar: 0
      }
    };

    this.serverStats.set(serverId, stats);
    return stats;
  }

  /**
   * 获取所有服务器状态
   */
  async getAllServerStats() {
    const stats = [];

    for (const server of this.servers) {
      const health = await this.isServerHealthy(server);
      const connections = await this.getServerSessionCount(server.id);
      const serverStats = await this.getServerStats(server.id);

      stats.push({
        id: server.id,
        url: server.url,
        region: server.region,
        healthy: health,
        connections: connections,
        maxConnections: server.maxConnections,
        utilization: Math.round((connections / server.maxConnections) * 100),
        avgResponseTime: serverStats.avgResponseTime,
        successRate: serverStats.totalRequests > 0
          ? Math.round((serverStats.successfulRequests / serverStats.totalRequests) * 100)
          : 0,
        capabilities: server.capabilities,
        priority: server.priority
      });
    }

    return stats;
  }

  // 私有方法

  async loadServerStats() {
    // 从缓存加载
    try {
      const cached = await this.kv.get('server_stats');
      if (cached) {
        const data = JSON.parse(cached);
        for (const [serverId, stats] of Object.entries(data)) {
          this.serverStats.set(serverId, stats);
        }
      }
    } catch (error) {
      console.error('Failed to load server stats from cache:', error);
    }
  }

  async isServerHealthy(server) {
    // 检查缓存的健康状态
    const cacheKey = `server_health:${server.id}`;
    try {
      const cached = await this.kv.get(cacheKey);
      if (cached) {
        const health = JSON.parse(cached);
        // 如果1分钟内检查过，使用缓存结果
        if (Date.now() - health.lastCheck < 60000) {
          return health.healthy;
        }
      }
    } catch (error) {
      // 继续进行健康检查
    }

    // 执行健康检查
    try {
      const response = await fetch(server.url + '/ping', {
        signal: AbortSignal.timeout(5000)
      });

      const healthy = response.ok;

      // 缓存结果
      await this.kv.put(cacheKey, JSON.stringify({
        healthy,
        lastCheck: Date.now()
      }), {
        expirationTtl: 300 // 5分钟缓存
      });

      return healthy;
    } catch (error) {
      // 标记为不健康
      await this.kv.put(cacheKey, JSON.stringify({
        healthy: false,
        lastCheck: Date.now()
      }), {
        expirationTtl: 60 // 1分钟缓存
      });

      return false;
    }
  }

  async getServerSessionCount(serverId) {
    try {
      const result = await this.db.prepare(`
        SELECT COUNT(*) as count
        FROM sessions
        WHERE server_url = ? AND status = 'active'
      `).bind(
        this.servers.find(s => s.id === serverId)?.url || ''
      ).first();

      return result.count || 0;
    } catch (error) {
      console.error('Failed to get server session count:', error);
      return 0;
    }
  }

  async getServerHealthScore(serverId) {
    const stats = await this.getServerStats(serverId);
    const connections = await this.getServerSessionCount(serverId);
    const maxConnections = this.servers.find(s => s.id === serverId)?.maxConnections || 100;

    // 计算综合健康分数
    let score = 100;

    // 基于成功率
    const successRate = stats.totalRequests > 0
      ? stats.successfulRequests / stats.totalRequests
      : 1;
    score *= successRate;

    // 基于响应时间
    const responseScore = Math.max(0, 1 - (stats.avgResponseTime - 200) / 2000);
    score *= responseScore;

    // 基于连接率
    const connectionScore = Math.max(0, 1 - (connections / maxConnections));
    score *= connectionScore;

    return Math.round(score);
  }

  async incrementServerConnections(serverId) {
    const cacheKey = `server_connections:${serverId}`;
    try {
      const cached = await this.kv.get(cacheKey);
      const connections = (cached ? parseInt(cached) : 0) + 1;
      await this.kv.put(cacheKey, connections.toString(), {
        expirationTtl: 300
      });
    } catch (error) {
      console.error('Failed to increment connections:', error);
    }
  }

  async decrementServerConnections(serverId) {
    const cacheKey = `server_connections:${serverId}`;
    try {
      const cached = await this.kv.get(cacheKey);
      const connections = Math.max(0, (cached ? parseInt(cached) : 0) - 1);
      await this.kv.put(cacheKey, connections.toString(), {
        expirationTtl: 300
      });
    } catch (error) {
      console.error('Failed to decrement connections:', error);
    }
  }

  detectClientRegion(clientRegion) {
    // 简化的区域检测逻辑
    if (!clientRegion) return 'asia';

    const region = clientRegion.toLowerCase();
    if (region.includes('cn') || region.includes('china')) return 'china';
    if (region.includes('us') || region.includes('america')) return 'us';
    if (region.includes('eu') || region.includes('europe')) return 'europe';
    if (region.includes('jp') || region.includes('japan')) return 'japan';
    if (region.includes('kr') || region.includes('korea')) return 'korea';
    if (region.includes('sg') || region.includes('singapore')) return 'singapore';

    return 'asia';
  }

  async logServerSelection(serverId, serviceType, strategy) {
    await this.db.prepare(`
      INSERT INTO server_selection_logs (
        server_id, service_type, strategy, timestamp
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(serverId, serviceType, strategy).run();
  }

  startHealthMonitoring() {
    // 在scheduled触发器中实现定期健康检查
    console.log('Health monitoring started');
  }
}

module.exports = LoadBalancer;