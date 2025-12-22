/**
 * 即梦API Cloudflare Worker 反向代理 - 增强版
 * 集成Session池化管理和负载均衡
 */

// 导入管理器类
import SessionManager from './session-manager.js';
import LoadBalancer from './load-balancer.js';

// 全局管理器实例
let sessionManager = null;
let loadBalancer = null;

// 主处理函数
export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();

    try {
      // 初始化管理器
      if (!sessionManager || !loadBalancer) {
        sessionManager = new SessionManager(env);
        loadBalancer = new LoadBalancer(env);
        await sessionManager.initialize();
        await loadBalancer.initialize();
      }

      // 路由请求
      const response = await routeRequest(request, env, ctx);

      // 记录响应时间
      const latency = Date.now() - startTime;
      ctx.waitUntil(logRequest(request, response, latency));

      return response;
    } catch (error) {
      console.error('Worker Error:', error);
      return createErrorResponse(error);
    }
  }
};

// 路由请求
async function routeRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // 处理CORS预检
  if (request.method === 'OPTIONS') {
    return handleCORS();
  }

  // 健康检查端点
  if (path === '/health') {
    return handleHealthCheck();
  }

  // Session管理端点
  if (path.startsWith('/api/session')) {
    return handleSessionAPI(request, path);
  }

  // 负载均衡端点
  if (path === '/api/load-balancer') {
    return handleLoadBalancerAPI();
  }

  // 统计端点
  if (path.startsWith('/api/stats')) {
    return handleStatsAPI(request, path);
  }

  // 代理请求到后端
  return await proxyRequestWithSession(request, env, ctx);
}

// 使用Session管理代理请求
async function proxyRequestWithSession(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // 确定服务类型
  const serviceType = determineServiceType(path, request);

  // 获取客户端信息
  const clientInfo = {
    ip: request.headers.get('CF-Connecting-IP') || 'unknown',
    userAgent: request.headers.get('User-Agent') || 'unknown',
    region: request.cf?.country || 'unknown'
  };

  try {
    // 1. 获取可用的Session
    const session = await sessionManager.getAvailableSession(serviceType);

    // 2. 选择最优服务器
    const server = await loadBalancer.selectServer({
      serviceType,
      clientIP: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      region: clientInfo.region
    });

    // 3. 构建代理请求
    const proxyRequest = await buildProxyRequest(request, session, server);

    // 4. 发送请求
    const response = await fetch(proxyRequest);

    // 5. 处理响应
    const processedResponse = await handleResponse(response, {
      sessionId: session.sessionId,
      serverId: server.id,
      serviceType
    });

    // 6. 记录使用统计
    if (response.ok || response.status < 500) {
      const latency = Date.now() - Date.now();
      await sessionManager.recordUsage(session.sessionId, serviceType, {
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        responseTime: latency,
        serverUrl: server.url
      });

      await loadBalancer.recordServerUsage(
        server.id,
        serviceType,
        latency,
        true
      );
    }

    // 7. 添加响应头
    processedResponse.headers.set('X-Session-ID', session.sessionId);
    processedResponse.headers.set('X-Server-Region', server.region);
    processedResponse.headers.set('X-Service-Type', serviceType);
    processedResponse.headers.set('X-Remaining-Quota', JSON.stringify(session.remaining));

    return processedResponse;

  } catch (error) {
    console.error('Proxy request failed:', error);

    // 记录失败
    if (serviceType && server) {
      await loadBalancer.recordServerUsage(
        server.id,
        serviceType,
        0,
        false
      );
    }

    throw error;
  }
}

// 构建代理请求
async function buildProxyRequest(request, session, server) {
  const url = new URL(request.url);
  const targetUrl = server.url + url.pathname + url.search;

  // 准备请求头
  const headers = new Headers(request.headers);

  // 修改关键头部
  headers.set('Host', new URL(server.url).host);
  headers.set('X-Session-ID', session.sessionId);
  headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || 'unknown');
  headers.set('X-Forwarded-Proto', url.protocol);
  headers.set('X-Forwarded-Host', url.host);

  // 处理Authorization
  const authHeader = request.headers.get('Authorization');
  if (authHeader && !authHeader.includes('Bearer ')) {
    headers.set('Authorization', `Bearer ${authHeader}`);
  }

  // 创建新请求
  return new Request(targetUrl, {
    method: request.method,
    headers: headers,
    body: request.body,
    redirect: 'manual'
  });
}

// 处理响应
async function handleResponse(response, context) {
  // 准备响应头
  const headers = new Headers(response.headers);

  // 添加CORS
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  // 缓存控制
  const url = response.url;
  if (url.includes('/models')) {
    headers.set('Cache-Control', 'public, max-age=300');
  } else if (url.includes('/usage')) {
    headers.set('Cache-Control', 'public, max-age=60');
  } else {
    headers.set('Cache-Control', 'no-cache, no-store');
  }

  // 如果是图像/视频响应，可能需要特殊处理
  const contentType = headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    // 修改响应体以包含额外信息
    const body = await response.json();
    if (Array.isArray(body.data)) {
      body.data.forEach(item => {
        item._meta = {
          sessionId: context.sessionId,
          serverId: context.serverId,
          serviceType: context.serviceType
        };
      });
    }

    return new Response(JSON.stringify(body), {
      status: response.status,
      statusText: response.statusText,
      headers: headers
    });
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}

// 确定服务类型
function determineServiceType(path, request) {
  if (path.includes('/images/generations')) {
    return 'image';
  } else if (path.includes('/images/compositions')) {
    return 'image';
  } else if (path.includes('/videos/generations')) {
    return 'video';
  } else if (path.includes('/avatar') || path.includes('/digital-human')) {
    return 'avatar';
  } else if (path.includes('/chat/completions')) {
    // 从请求体判断
    try {
      const body = request.clone().json();
      const model = body.model || '';
      if (model.includes('video')) {
        return 'video';
      } else {
        return 'image';
      }
    } catch {
      return 'image';
    }
  }

  return 'image'; // 默认
}

// Session API处理
async function handleSessionAPI(request, path) {
  if (!sessionManager) {
    return new Response('Session Manager not initialized', { status: 503 });
  }

  if (path === '/api/session/stats') {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    const days = parseInt(url.searchParams.get('days')) || 7;

    if (sessionId) {
      const stats = await sessionManager.getSessionStats(sessionId, days);
      return new Response(JSON.stringify(stats, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      const date = url.searchParams.get('date');
      const globalStats = await sessionManager.getGlobalStats(date);
      return new Response(JSON.stringify(globalStats, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (path === '/api/session/usage') {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const usage = await sessionManager.getSessionUsage(sessionId);
    const remaining = {
      image: Math.max(0, 10 - usage.image_count),
      video: Math.max(0, 2 - usage.video_count),
      avatar: Math.max(0, 1 - usage.avatar_count)
    };

    return new Response(JSON.stringify({
      session_id: sessionId,
      usage: usage,
      remaining: remaining,
      limits: {
        image: 10,
        video: 2,
        avatar: 1
      }
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response('Not Found', { status: 404 });
}

// 负载均衡API处理
async function handleLoadBalancerAPI() {
  if (!loadBalancer) {
    return new Response('Load Balancer not initialized', { status: 503 });
  }

  const stats = await loadBalancer.getAllServerStats();
  return new Response(JSON.stringify({
    strategy: loadBalancer.currentStrategy,
    servers: stats,
    timestamp: new Date().toISOString()
  }, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// 统计API处理
async function handleStatsAPI(request, path) {
  if (!sessionManager) {
    return new Response('Session Manager not initialized', { status: 503 });
  }

  if (path === '/api/stats/daily') {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('start');
    const endDate = url.searchParams.get('end');

    // 查询日期范围内的统计
    const stats = await sessionManager.db.prepare(`
      SELECT date,
             COUNT(DISTINCT session_id) as active_sessions,
             SUM(CASE WHEN service_type = 'image' THEN usage_count ELSE 0 END) as images,
             SUM(CASE WHEN service_type = 'video' THEN usage_count ELSE 0 END) as videos,
             SUM(CASE WHEN service_type = 'avatar' THEN usage_count ELSE 0 END) as avatars
      FROM session_usage
      WHERE date BETWEEN ? AND ?
      GROUP BY date
      ORDER BY date DESC
    `).bind(startDate || '1970-01-01', endDate || '9999-12-31').all();

    return new Response(JSON.stringify({
      data: stats.results,
      totalDays: stats.results.length
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (path === '/api/stats/summary') {
    // 获取7天汇总统计
    const summary = await sessionManager.db.prepare(`
      SELECT
        COUNT(DISTINCT su.session_id) as total_sessions,
        SUM(CASE WHEN su.service_type = 'image' THEN su.usage_count ELSE 0 END) as total_images,
        SUM(CASE WHEN su.service_type = 'video' THEN su.usage_count ELSE 0 END) as total_videos,
        SUM(CASE WHEN su.service_type = 'avatar' THEN su.usage_count ELSE 0 END) as total_avatars,
        AVG(s.request_count) as avg_requests_per_session
      FROM session_usage su
      JOIN sessions s ON su.session_id = s.session_id
      WHERE su.date >= DATE('now', '-7 days')
    `).first();

    return new Response(JSON.stringify({
      period: 'last_7_days',
      ...summary,
      total_requests: summary.total_images + summary.total_videos + summary.total_avatars
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response('Not Found', { status: 404 });
}

// 健康检查
async function handleHealthCheck() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      sessionManager: !!sessionManager,
      loadBalancer: !!loadBalancer
    }
  };

  if (sessionManager) {
    try {
      const activeSessions = await sessionManager.getActiveSessionsCount();
      health.sessions = {
        active: activeSessions,
        minRequired: sessionManager.POOL_CONFIG.minSize
      };
    } catch (error) {
      health.status = 'degraded';
      health.error = error.message;
    }
  }

  if (loadBalancer) {
    try {
      const servers = await loadBalancer.getAllServerStats();
      health.servers = {
        total: servers.length,
        healthy: servers.filter(s => s.healthy).length,
        totalConnections: servers.reduce((sum, s) => sum + s.connections, 0)
      };
    } catch (error) {
      health.status = 'degraded';
      health.error = error.message;
    }
  }

  return new Response(JSON.stringify(health, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// CORS处理
function handleCORS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400'
    }
  });
}

// 创建错误响应
function createErrorResponse(error) {
  return new Response(
    JSON.stringify({
      error: {
        code: -1001,
        message: error.message || 'Service temporarily unavailable',
        type: 'worker_error'
      }
    }),
    {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }
  );
}

// 记录请求日志
async function logRequest(request, response, latency) {
  const logData = {
    timestamp: new Date().toISOString(),
    method: request.method,
    url: request.url,
    status: response.status,
    latency: latency,
    userAgent: request.headers.get('User-Agent'),
    ip: request.headers.get('CF-Connecting-IP'),
    sessionId: response.headers.get('X-Session-ID'),
    serverId: response.headers.get('X-Server-ID'),
    serviceType: response.headers.get('X-Service-Type')
  };

  console.log('Request Log:', JSON.stringify(logData));
}

// 定时任务 - 健康检查和数据清理
export async function scheduled(event, env, ctx) {
  console.log('Running scheduled tasks...');

  try {
    // 初始化管理器
    if (!sessionManager) {
      sessionManager = new SessionManager(env);
      await sessionManager.initialize();
    }

    if (!loadBalancer) {
      loadBalancer = new LoadBalancer(env);
      await loadBalancer.initialize();
    }

    // 1. 刷新Session池
    await sessionManager.refreshSessionPool();
    console.log('Session pool refreshed');

    // 2. 确保Session池大小
    await sessionManager.ensureSessionPool();
    console.log('Session pool ensured');

    // 3. 清理过期数据
    await sessionManager.cleanup();
    console.log('Data cleanup completed');

    // 4. 更新服务器健康状态
    if (loadBalancer) {
      const servers = await loadBalancer.getAllServerStats();
      console.log(`Server health check completed: ${servers.filter(s => s.healthy).length}/${servers.length} healthy`);
    }

    // 5. 更新每日统计
    await updateDailyStats(env);
    console.log('Daily statistics updated');

  } catch (error) {
    console.error('Scheduled task error:', error);
  }
}

// 更新每日统计
async function updateDailyStats(env) {
  const today = new Date().toISOString().split('T')[0];

  // 这里应该计算并更新daily_stats表
  // 简化实现
  const db = env.DB;
  await db.prepare(`
    INSERT OR REPLACE INTO daily_stats (date, updated_at)
    VALUES (?, CURRENT_TIMESTAMP)
  `).bind(today).run();
}