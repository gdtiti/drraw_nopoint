# 即梦API Cloudflare Worker 反向代理

这个项目提供了一个高性能的Cloudflare Worker反向代理解决方案，用于为即梦API服务提供负载均衡、IP优选和缓存优化。

## 功能特性

### 🚀 核心功能
- **反向代理**: 无缝代理所有即梦API接口
- **智能负载均衡**: 支持加权轮询和最低延迟算法
- **IP优选**: 自动测试和选择最优服务器节点
- **健康检查**: 定期检测后端服务器状态
- **自动重试**: 失败请求自动重试，支持故障转移
- **缓存优化**: 智能缓存策略，减少后端负载

### 🛡️ 安全与性能
- **请求限流**: 防止API滥用
- **CORS支持**: 完整的跨域支持
- **请求日志**: 详细的请求和响应日志
- **响应压缩**: 自动压缩响应数据

## 项目结构

```
cloudflare/
├── worker.js          # 主Worker代码
├── wrangler.toml      # Cloudflare配置文件
├── ip-tester.js       # IP测速工具
├── package.json       # 项目依赖
└── README.md          # 说明文档
```

## 快速开始

### 1. 安装依赖

```bash
npm install -g wrangler
```

### 2. 配置后端服务器

编辑 `worker.js` 文件中的 `CONFIG.BACKEND_SERVERS`：

```javascript
const CONFIG = {
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
    }
  ]
};
```

### 3. 配置Cloudflare

编辑 `wrangler.toml` 文件：

```toml
account_id = "your-account-id"
zone_id = "your-zone-id"

[[routes]]
pattern = "your-domain.com/api/*"
zone_name = "your-domain.com"
```

### 4. 部署Worker

```bash
# 登录Cloudflare
wrangler login

# 部署Worker
wrangler deploy

# 设置定时触发器（健康检查）
wrangler cron schedule "*/1 * * * *"
```

## 配置说明

### 后端服务器配置

每个后端服务器支持以下配置：

- `url`: 服务器地址
- `priority`: 优先级（数字越小优先级越高）
- `region`: 区域标识（如: default, backup, cn, us）
- `weight`: 权重（用于加权轮询）

### 缓存配置

```javascript
CACHE: {
  enabled: true,
  ttl: {
    models: 300,    // 模型列表缓存5分钟
    stats: 60,      // 统计数据缓存1分钟
    health: 30      // 健康检查缓存30秒
  },
  bypass: [
    '/v1/images',     // 生成类请求不缓存
    '/v1/videos',
    '/v1/chat/completions',
    '/token'
  ]
}
```

### 限流配置

```javascript
RATE_LIMIT: {
  enabled: true,
  requests: 100,     // 每100个请求
  window: 60,        // 每分钟
  blockDuration: 300 // 封禁5分钟
}
```

## IP测速工具

使用 `ip-tester.js` 来测试和选择最优的服务器节点：

```bash
# 运行IP测速
node ip-tester.js
```

测速工具会输出：
- 各服务器的可用性
- 延迟统计（最小、最大、平均、P95、P99）
- 错误统计
- 推荐的服务器排序

## API接口

Worker代理支持所有原始API接口，包括：

### 图像生成
- `POST /v1/images/generations` - 文生图
- `POST /v1/images/compositions` - 图生图

### 视频生成
- `POST /v1/videos/generations` - 视频生成

### 聊天接口
- `POST /v1/chat/completions` - 智能路由聊天

### 管理接口
- `GET /v1/models` - 模型列表
- `GET /ping` - 健康检查
- `POST /token/check` - Token验证

### 统计接口
- `GET /usage/stats` - 使用统计
- `GET /usage/session/:sessionId` - Session统计

### 新增接口

#### 健康检查
```
GET /health
```
返回所有后端服务器的健康状态。

#### IP优选信息
```
GET /api/ip-preference
```
返回服务器列表及其性能数据，按性能排序。

## 监控和日志

### 健康检查

Worker会自动执行健康检查：
- 检查频率：每分钟
- 超时时间：5秒
- 重试次数：3次

### 日志记录

每个请求都会记录以下信息：
- 请求方法和URL
- 响应状态码
- 处理延迟
- 客户端IP
- 使用的后端服务器
- User-Agent

### 性能指标

Worker自动跟踪以下指标：
- 各服务器的请求延迟
- 成功/失败率
- 平均响应时间
- P95/P99延迟

## 高级配置

### 使用KV存储持久化数据

如果需要在部署间保持数据，可以启用KV存储：

```javascript
// 在worker.js中使用KV
const cachedValue = await env.CACHE.get('key');
await env.CACHE.put('key', 'value', { expirationTtl: 3600 });
```

### 使用D1数据库存储日志

对于详细的日志分析，可以配置D1数据库：

```javascript
// 存储请求日志
await env.DB.prepare(`
  INSERT INTO request_logs (timestamp, method, url, status, latency)
  VALUES (?, ?, ?, ?, ?)
`).bind(timestamp, method, url, status, latency).run();
```

## 故障处理

### 自动故障转移

- 当主服务器失败时，自动切换到备用服务器
- 支持多级故障转移
- 自动恢复检测

### 错误重试

- 网络错误自动重试（最多3次）
- 指数退避算法
- 智能服务器选择

## 性能优化建议

### 1. 缓存策略

- 静态数据（如模型列表）使用长期缓存
- 动态数据（如统计信息）使用短期缓存
- 生成类请求不使用缓存

### 2. 地理分布

- 在不同地区部署多个后端服务器
- 使用Cloudflare的Argo Smart Routing
- 配置边缘缓存

### 3. 压缩

- 启用Brotli/Gzip压缩
- 优化API响应格式
- 减少不必要的数据传输

## 故障排查

### 常见问题

1. **502错误**
   - 检查后端服务器是否正常运行
   - 查看健康检查状态
   - 检查防火墙设置

2. **高延迟**
   - 运行IP测速工具
   - 检查服务器地理位置
   - 考虑使用CDN

3. **限流触发**
   - 检查请求频率
   - 调整限流配置
   - 使用多个客户端IP

### 日志分析

```javascript
// 查看详细错误日志
console.error('Worker Error:', error);

// 查看请求日志
console.log('Request Log:', JSON.stringify(logData));
```

## 更新和维护

### 部署更新

```bash
# 更新代码后重新部署
wrangler deploy
```

### 配置更新

大部分配置支持热更新，无需重新部署：

```javascript
// 通过环境变量更新配置
wrangler secret put BACKEND_SERVERS
```

### 监控告警

建议配置以下监控：
- 服务器健康状态
- 错误率超过阈值
- 平均延迟过高
- 请求量异常

## 安全建议

1. **访问控制**
   - 配置WAF规则
   - 使用API密钥
   - 限制访问来源

2. **数据保护**
   - 启用HTTPS
   - 敏感数据加密
   - 定期更新密钥

3. **DDoS防护**
   - 配置Cloudflare DDoS防护
   - 实施请求限流
   - 监控异常流量

## 许可证

MIT License

## 支持

如有问题或建议，请提交Issue或联系维护者。