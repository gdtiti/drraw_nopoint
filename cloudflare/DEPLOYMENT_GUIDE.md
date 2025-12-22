# 即梦API Cloudflare Worker 部署指南（增强版）

本指南介绍如何部署带有Session池化管理和负载均衡的Cloudflare Worker反向代理。

## 新增功能

### 🎯 Session池化管理
- **自动Session池维护**: 自动创建和管理Session池
- **智能分配**: 根据服务类型智能分配可用Session
- **每日使用限制**: 图像10次/天，视频2次/天，数字人1次/天
- **实时统计**: 记录每次使用的详细统计

### ⚡ 智能负载均衡
- **多策略路由**: 支持多种负载均衡策略
- **地理位置优化**: 根据客户端位置选择最近服务器
- **健康监控**: 实时监控服务器健康状态
- **动态调整**: 自动调整路由策略

### 📊 数据分析
- **D1数据库**: 持久化存储使用数据
- **KV缓存**: 高性能缓存优化
- **统计分析**: 多维度数据分析
- **报表导出**: 支持数据导出和报表生成

## 部署步骤

### 1. 准备工作

#### 安装依赖
```bash
cd cloudflare
npm install -g wrangler
npm install
```

#### 创建D1数据库
```bash
# 创建数据库
wrangler d1 create jimeng-api-db

# 记录返回的database_id，更新到wrangler.toml
```

#### 创建KV存储
```bash
# 创建KV命名空间
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "CACHE" --preview

# 记录返回的namespace_id，更新到wrangler.toml
```

### 2. 配置文件更新

#### 更新wrangler.toml
```toml
name = "jimeng-api-proxy"
main = "worker-updated.js"  # 使用更新版本的worker
compatibility_date = "2023-12-01"

# 帐户配置
account_id = "your-account-id"
zone_id = "your-zone-id"

# KV存储
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"
preview_id = "your-kv-preview-id"

# D1数据库
[[d1_databases]]
binding = "DB"
database_name = "jimeng-api-db"
database_id = "your-d1-database-id"

# 定时任务
[[triggers]]
crons = ["*/5 * * * *"]  # 每5分钟执行一次健康检查

# 路由配置
[[routes]]
pattern = "your-domain.com/api/*"
zone_name = "your-domain.com"
```

#### 配置后端服务器
编辑 `load-balancer.js` 中的服务器列表：

```javascript
this.servers = [
  {
    id: 'server-1',
    url: 'https://api1.your-domain.com',
    region: 'asia-east',
    priority: 1,
    weight: 3,
    maxSessions: 200,
    capabilities: ['image', 'video', 'avatar']
  },
  // 添加更多服务器...
];
```

### 3. 初始化数据库

#### 执行数据库初始化
```bash
# 使用wrangler执行SQL
wrangler d1 execute jimeng-api-db --file=./init-db.sql
```

#### 验证表创建
```bash
wrangler d1 execute jimeng-api-db --command="SELECT name FROM sqlite_master WHERE type='table'"
```

### 4. 部署Worker

#### 部署主要代码
```bash
# 部署worker
wrangler deploy

# 设置定时任务
wrangler cron schedule "*/5 * * * *"
```

#### 配置自定义域名
```bash
wrangler custom-domains add api.your-domain.com
```

### 5. 验证部署

#### 检查健康状态
```bash
curl https://api.your-domain.com/health
```

响应示例：
```json
{
  "status": "ok",
  "timestamp": "2025-12-21T10:00:00.000Z",
  "services": {
    "sessionManager": true,
    "loadBalancer": true
  },
  "sessions": {
    "active": 150,
    "minRequired": 50
  },
  "servers": {
    "total": 4,
    "healthy": 4,
    "totalConnections": 300
  }
}
```

#### 检查负载均衡状态
```bash
curl https://api.your-domain.com/api/load-balancer
```

## API接口说明

### Session管理接口

#### 获取Session使用情况
```bash
GET /api/session/usage?sessionId=session_123
```

响应：
```json
{
  "session_id": "session_123",
  "usage": {
    "image_count": 5,
    "video_count": 1,
    "avatar_count": 0
  },
  "remaining": {
    "image": 5,
    "video": 1,
    "avatar": 1
  },
  "limits": {
    "image": 10,
    "video": 2,
    "avatar": 1
  }
}
```

#### 获取Session统计
```bash
GET /api/session/stats?sessionId=session_123&days=7
```

#### 获取全局统计
```bash
GET /api/session/stats?date=2025-12-21
```

### 统计分析接口

#### 每日统计趋势
```bash
GET /api/stats/daily?start=2025-12-15&end=2025-12-21
```

#### 汇总统计
```bash
GET /api/stats/summary
```

## 监控和维护

### 查看实时日志
```bash
wrangler tail
```

### 监控Session池
```bash
# 查看活跃Session数
wrangler d1 execute jimeng-api-db --command="SELECT COUNT(*) FROM sessions WHERE status='active'"

# 查看今日使用情况
wrangler d1 execute jimeng-api-db --command="SELECT service_type, SUM(usage_count) FROM session_usage WHERE date=date('now') GROUP BY service_type"
```

### 清理过期数据
```bash
# 清理30天前的数据
wrangler d1 execute jimeng-api-db --command="DELETE FROM session_usage WHERE date < date('now', '-30 days')"
```

## 性能优化

### KV缓存策略
- Session信息缓存1小时
- 使用情况缓存5分钟
- 服务器健康状态缓存5分钟

### D1数据库优化
- 创建了必要的索引
- 定期清理历史数据
- 使用视图简化查询

### Session池优化
```javascript
// 在session-manager.js中调整配置
this.POOL_CONFIG = {
  minSize: 50,          // 最小Session池大小
  maxSize: 500,         // 最大Session池大小
  refreshThreshold: 0.2, // 触发补充的阈值
  healthCheckInterval: 300000, // 5分钟健康检查
  staleThreshold: 86400000    // 24小时未使用视为过期
};
```

## 故障排查

### 常见问题

1. **D1数据库连接失败**
   - 检查database_id是否正确
   - 确认wrangler.toml配置

2. **KV存储访问失败**
   - 检查namespace_id是否正确
   - 确认KV命名空间绑定

3. **Session池初始化失败**
   - 检查数据库表是否创建成功
   - 查看Worker日志获取详细错误

### 调试技巧

1. **启用调试模式**
   ```javascript
   // 在worker中添加
   console.log('Debug info:', { sessionId, serverId, serviceType });
   ```

2. **查看数据库内容**
   ```bash
   wrangler d1 execute jimeng-api-db --command="SELECT * FROM sessions LIMIT 10"
   ```

3. **监控缓存命中率**
   ```javascript
   // 在代码中添加缓存统计
   console.log('Cache hit rate:', cacheHits / totalRequests);
   ```

## 扩展开发

### 添加新的服务类型
1. 更新`session-manager.js`中的LIMITS配置
2. 在数据库表中添加新的service_type
3. 更新API接口中的服务类型判断

### 自定义负载均衡策略
在`load-balancer.js`中添加新策略：
```javascript
async selectByCustomStrategy(servers, criteria) {
  // 实现自定义逻辑
  return selectedServer;
}
```

### 添加新的统计指标
1. 扩展数据库表结构
2. 更新统计查询
3. 添加相应的API端点

## 安全建议

1. **API密钥管理**
   - 使用环境变量存储敏感信息
   - 定期轮换密钥

2. **访问控制**
   - 配置WAF规则
   - 限制API访问频率

3. **数据保护**
   - 启用加密传输
   - 定期备份数据库

## 更新维护

### 更新Worker代码
```bash
# 修改代码后重新部署
wrangler deploy
```

### 更新数据库结构
```bash
# 执行新的SQL脚本
wrangler d1 execute jimeng-api-db --file=./update-db.sql
```

### 回滚部署
```bash
# 回滚到上一个版本
wrangler rollback
```

## 支持与帮助

- 官方文档：https://developers.cloudflare.com
- Wrangler CLI文档：https://developers.cloudflare.com/workers/wrangler/
- D1数据库文档：https://developers.cloudflare.com/d1/

如有问题，请查看Cloudflare Dashboard中的Worker日志或联系技术支持。