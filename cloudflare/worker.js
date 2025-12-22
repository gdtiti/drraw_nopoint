/**
 * 即梦API Cloudflare Worker 反向代理
 *
 * 功能：
 * 1. 反向代理所有即梦API接口
 * 2. IP地址优选和负载均衡
 * 3. 缓存优化
 * 4. 错误处理和重试
 * 5. 请求/响应日志记录
 */

// 配置常量
const CONFIG = {
  // 后端服务器列表
  BACKEND_SERVERS: [
    {
      url: 'https://your-jimeng-api-1.com',
      priority: 1,
      region: 'default',
      weight: 3
    },
    {
      url: 'https://your-jimeng-api-2.com',
      priority: 2,
      region: 'backup',
      weight: 2
    },
    {
      url: 'https://your-jimeng-api-3.com',
      priority: 3,
      region: 'backup',
      weight: 1
    }
  ],

  // 健康检查配置
  HEALTH_CHECK: {
    enabled: true,
    path: '/ping',
    interval: 30000, // 30秒
    timeout: 5000,   // 5秒
    retries: 3
  },

  // 缓存配置
  CACHE: {
    enabled: true,
    ttl: {
      // GET请求缓存时间（秒）
      models: 300,        // 模型列表
      stats: 60,          // 统计数据
      health: 30          // 健康检查
    },
    // 不缓存的路径
    bypass: [
      '/v1/images',
      '/v1/videos',
      '/v1/chat/completions',
      '/token'
    ]
  },

  // 重试配置
  RETRY: {
    maxAttempts: 3,
    backoff: 1000, // 1秒
    retryableErrors: [
      'network error',
      'timeout',
      'connection refused',
      '502',
      '503',
      '504'
    ]
  },

  // 限流配置
  RATE_LIMIT: {
    enabled: true,
    requests: 100,  // 每100个请求
    window: 60,     // 每分钟
    blockDuration: 300 // 5分钟
  }
};

// 存储健康状态的KV
let serverHealth = new Map();
let requestCounts = new Map();
let latencyHistory = new Map();

// 主处理函数
export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();

    try {
      // 路由请求
      const response = await routeRequest(request, env, ctx);

      // 记录响应时间
      const latency = Date.now() - startTime;
      ctx.waitUntil(logRequest(request, response, latency));

      return response;
    } catch (error) {
      console.error('Worker Error:', error);
      return new Response(
        JSON.stringify({
          error: {
            code: -1001,
            message: 'Service temporarily unavailable',
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

  // IP优选端点
  if (path === '/api/ip-preference') {
    return handleIPPreference(request);
  }

  // 获取优选的服务器
  const server = await selectBestServer(path);

  if (!server) {
    throw new Error('No healthy servers available');
  }

  // 检查限流
  if (CONFIG.RATE_LIMIT.enabled) {
    const clientId = getClientId(request);
    if (await isRateLimited(clientId, env)) {
      return new Response(
        JSON.stringify({
          error: {
            code: -429,
            message: 'Too many requests',
            type: 'rate_limit_exceeded'
          }
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  }

  // 代理请求
  return await proxyRequest(request, server, env, ctx);
}

// 选择最优服务器
async function selectBestServer(path) {
  const healthyServers = CONFIG.BACKEND_SERVERS.filter(server => {
    const health = serverHealth.get(server.url);
    return health && health.isHealthy;
  });

  if (healthyServers.length === 0) {
    // 如果没有健康的服务器，返回所有服务器进行重试
    return CONFIG.BACKEND_SERVERS[0];
  }

  // 根据路径选择策略
  if (CONFIG.CACHE.bypass.some(p => path.startsWith(p))) {
    // 对于生成类请求，选择延迟最低的服务器
    return selectLowestLatencyServer(healthyServers);
  } else {
    // 对于查询类请求，使用加权轮询
    return selectWeightedServer(healthyServers);
  }
}

// 选择延迟最低的服务器
function selectLowestLatencyServer(servers) {
  let bestServer = null;
  let bestLatency = Infinity;

  for (const server of servers) {
    const history = latencyHistory.get(server.url);
    if (history && history.averageLatency < bestLatency) {
      bestLatency = history.averageLatency;
      bestServer = server;
    }
  }

  return bestServer || servers[0];
}

// 加权选择服务器
function selectWeightedServer(servers) {
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

// 代理请求
async function proxyRequest(request, server, env, ctx) {
  const targetUrl = server.url + new URL(request.url).pathname + new URL(request.url).search;

  // 准备请求头
  const headers = new Headers(request.headers);

  // 修改Host头
  headers.set('Host', new URL(server.url).host);

  // 添加自定义头
  headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || 'unknown');
  headers.set('X-Forwarded-Proto', new URL(request.url).protocol);
  headers.set('X-Forwarded-Host', new URL(request.url).host);
  headers.set('X-Worker-Server', server.url);

  // 创建新请求
  const newRequest = new Request(targetUrl, {
    method: request.method,
    headers: headers,
    body: request.body,
    redirect: 'manual'
  });

  // 重试逻辑
  let lastError;
  for (let attempt = 1; attempt <= CONFIG.RETRY.maxAttempts; attempt++) {
    try {
      const response = await fetch(newRequest, {
        signal: AbortSignal.timeout(30000) // 30秒超时
      });

      // 更新服务器健康状态
      if (response.ok || response.status < 500) {
        updateServerHealth(server.url, true);

        // 记录响应时间
        const latency = Date.now() - Date.now();
        updateLatency(server.url, latency);
      } else {
        updateServerHealth(server.url, false);
      }

      // 处理响应
      return await handleResponse(response, server);

    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt} failed for server ${server.url}:`, error);

      // 标记服务器不健康
      updateServerHealth(server.url, false);

      // 如果不是最后一次尝试，等待后重试
      if (attempt < CONFIG.RETRY.maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY.backoff * attempt));

        // 选择新的服务器
        const newServer = await selectBestServer(new URL(request.url).pathname);
        if (newServer && newServer.url !== server.url) {
          server = newServer;
          newRequest.url = server.url + new URL(request.url).pathname + new URL(request.url).search;
        }
      }
    }
  }

  throw lastError;
}

// 处理响应
async function handleResponse(response, server) {
  // 准备响应头
  const headers = new Headers(response.headers);

  // 添加CORS头
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  // 添加自定义头
  headers.set('X-Proxy-Server', server.url);
  headers.set('X-Proxy-Region', server.region);

  // 缓存控制
  const url = new URL(response.url);
  if (CONFIG.CACHE.enabled) {
    if (url.pathname === '/v1/models') {
      headers.set('Cache-Control', `public, max-age=${CONFIG.CACHE.ttl.models}`);
    } else if (url.pathname.startsWith('/usage')) {
      headers.set('Cache-Control', `public, max-age=${CONFIG.CACHE.ttl.stats}`);
    }
  }

  // 返回响应
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}

// 处理CORS
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

// 健康检查端点
async function handleHealthCheck() {
  const healthData = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    servers: []
  };

  for (const server of CONFIG.BACKEND_SERVERS) {
    const health = serverHealth.get(server.url) || { isHealthy: false, lastCheck: null };
    const latency = latencyHistory.get(server.url);

    healthData.servers.push({
      url: server.url,
      region: server.region,
      priority: server.priority,
      healthy: health.isHealthy,
      lastCheck: health.lastCheck,
      averageLatency: latency ? latency.averageLatency : null
    });
  }

  return new Response(JSON.stringify(healthData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// IP优选端点
async function handleIPPreference(request) {
  const data = {
    servers: CONFIG.BACKEND_SERVERS.map(server => {
      const health = serverHealth.get(server.url) || { isHealthy: false };
      const latency = latencyHistory.get(server.url);

      return {
        url: server.url,
        region: server.region,
        priority: server.priority,
        weight: server.weight,
        healthy: health.isHealthy,
        latency: latency ? latency.averageLatency : null
      };
    }).sort((a, b) => {
      // 优先按健康状态排序，然后按延迟
      if (a.healthy !== b.healthy) return b.healthy - a.healthy;
      if (a.latency && b.latency) return a.latency - b.latency;
      return a.priority - b.priority;
    })
  };

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// 更新服务器健康状态
function updateServerHealth(serverUrl, isHealthy) {
  const health = serverHealth.get(serverUrl) || {
    isHealthy: false,
    lastCheck: null,
    consecutiveFailures: 0
  };

  health.isHealthy = isHealthy;
  health.lastCheck = new Date().toISOString();

  if (isHealthy) {
    health.consecutiveFailures = 0;
  } else {
    health.consecutiveFailures = (health.consecutiveFailures || 0) + 1;
  }

  serverHealth.set(serverUrl, health);
}

// 更新延迟历史
function updateLatency(serverUrl, latency) {
  const history = latencyHistory.get(serverUrl) || {
    samples: [],
    averageLatency: 0
  };

  // 添加新样本
  history.samples.push(latency);

  // 只保留最近100个样本
  if (history.samples.length > 100) {
    history.samples.shift();
  }

  // 计算平均延迟
  history.averageLatency = Math.round(
    history.samples.reduce((sum, s) => sum + s, 0) / history.samples.length
  );

  latencyHistory.set(serverUrl, history);
}

// 获取客户端ID
function getClientId(request) {
  // 尝试从多个来源获取客���端标识
  return request.headers.get('CF-Connecting-IP') ||
         request.headers.get('X-Forwarded-For') ||
         request.headers.get('X-Real-IP') ||
         'anonymous';
}

// 检查限流
async function isRateLimited(clientId, env) {
  const key = `rate_limit:${clientId}`;
  const now = Date.now();
  const windowStart = now - (CONFIG.RATE_LIMIT.window * 1000);

  // 获取当前计数
  const count = requestCounts.get(clientId) || { count: 0, resetTime: now + CONFIG.RATE_LIMIT.window * 1000 };

  // 如果窗口已过期，重置计数
  if (now > count.resetTime) {
    count.count = 1;
    count.resetTime = now + CONFIG.RATE_LIMIT.window * 1000;
  } else {
    count.count++;
  }

  requestCounts.set(clientId, count);

  // 检查是否超过限制
  return count.count > CONFIG.RATE_LIMIT.requests;
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
    server: response.headers.get('X-Proxy-Server')
  };

  // 这里可以发送到日志服务
  console.log('Request Log:', JSON.stringify(logData));
}

// 定期健康检查（需要使用Cron Triggers）
export async function scheduled(event, env, ctx) {
  console.log('Running scheduled health check...');

  for (const server of CONFIG.BACKEND_SERVERS) {
    try {
      const healthUrl = server.url + CONFIG.HEALTH_CHECK.path;
      const response = await fetch(healthUrl, {
        signal: AbortSignal.timeout(CONFIG.HEALTH_CHECK.timeout)
      });

      updateServerHealth(server.url, response.ok);

      if (response.ok) {
        // 更新延迟
        const latency = Date.now() - Date.now();
        updateLatency(server.url, latency);
      }
    } catch (error) {
      console.error(`Health check failed for ${server.url}:`, error);
      updateServerHealth(server.url, false);
    }
  }
}