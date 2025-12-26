# 即梦 API Swagger 文档使用指南

## 📖 概述

即梦 API 现已集成了完整的 Swagger 文档系统，提供交互式的 API 在线查看和测试功能。文档支持分组查看、参数验证、实时测试等功能。

## 🚀 访问方式

### 主要访问地址

- **Swagger UI 主页**: http://localhost:7860/docs
- **API 规范 JSON**: http://localhost:7860/docs/json
- **API 规范 YAML**: http://localhost:7860/docs/yaml

### 生产环境配置

在生产环境中，可以通过以下方式访问：

```bash
# 替换 YOUR_DOMAIN 为您的实际域名
http://YOUR_DOMAIN/docs
```

## 🎯 功能特性

### 1. 分组查看
API 文档按功能模块进行分组，便于查找：

- **System** - 系统信息和基础接口
- **Health** - 健康检查相关接口
- **Models** - 可用 AI 模型列表
- **Token** - 认证令牌管理
- **Usage** - 使用统计信息
- **Proxy** - 代理服务配置
- **Images** - AI 图像生成接口
- **Videos** - AI 视频生成接口
- **Chat** - 智能对话接口
- **Async** - 异步任务处理接口

### 2. 交互式测试
- ✅ 直接在浏览器中测试 API
- ✅ 自动填充认证头
- ✅ 参数验证和提示
- ✅ 实时查看响应结果
- ✅ 支持多种请求格式

### 3. 详细文档
- 📝 完整的接口说明
- 📝 参数详细描述
- 📝 响应示例
- 📝 错误处理说明
- 📝 使用限制和注意事项

## 📚 使用指南

### 1. 浏览接口文档

1. 访问 http://localhost:7860/docs
2. 在页面顶部可以看到 API 总览信息
3. 点击各个分组标签查看不同模块的接口
4. 点击具体接口查看详细文档

### 2. 测试 API 接口

#### 设置认证

大多数接口需要 Bearer Token 认证：

1. 点击页面右上角的 **"Authorize"** 按钮
2. 在弹出的对话框中输入您的认证 Token
3. 格式：`Bearer YOUR_TOKEN`
4. 点击 **"Authorize"** 完成认证

#### 测试图像生成

```bash
# 1. 展开 Images 分组
# 2. 点击 POST /v1/images/generations
# 3. 点击 "Try it out" 按钮
# 4. 修改请求参数：
{
  "prompt": "美丽的日落风景",
  "model": "jimeng-4.5",
  "ratio": "16:9",
  "resolution": "1080p"
}
# 5. 点击 "Execute" 执行请求
# 6. 查看响应结果
```

#### 测试异步任务

```bash
# 1. 展开 Async 分组
# 2. 点击 POST /v1/async/images/generations
# 3. 提交异步任务获取 task_id
# 4. 使用 GET /v1/async/tasks/{task_id}/status 查询进度
# 5. 使用 GET /v1/async/tasks/{task_id}/result 获取结果
```

### 3. 导出 API 文档

#### 导出 JSON 格式

```bash
curl -O http://localhost:7860/docs/json
```

#### 导出 YAML 格式

```bash
curl -O http://localhost:7860/docs/yaml
```

## 🔧 配置说明

### 自定义配置

可以通过修改 `src/lib/swagger-config.ts` 来自定义文档配置：

```typescript
const swaggerOptions = {
  definition: {
    info: {
      title: '即梦 API',           // API 标题
      version: '1.6.3',           // 版本号
      description: 'API 描述',      // 详细描述
      contact: {                   // 联系信息
        name: 'API Team',
        url: 'https://example.com',
        email: 'support@example.com'
      }
    },
    servers: [                     // 服务器地址
      {
        url: 'http://localhost:7860',
        description: '开发环境'
      },
      {
        url: 'https://your-domain.com',
        description: '生产环境'
      }
    ]
  }
};
```

### 添加新的接口文档

1. 在对应的控制器文件中添加 Swagger 注释
2. 使用 JSDoc 格式描述接口
3. 文件路径：`src/lib/swagger-docs/`

```javascript
/**
 * @swagger
 * /v1/example:
 *   get:
 *     tags:
 *       - Example
 *     summary: 接口摘要
 *     description: 详细描述
 *     parameters:
 *       - in: query
 *         name: param1
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 成功响应
 */
```

## 📋 接口总览

### 基础信息接口

| 接口 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/` | GET | 系统信息 | ❌ |
| `/ping` | GET | 健康检查 | ❌ |
| `/docs` | GET | API 文档 | ❌ |

### 认证管理

| 接口 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/token` | POST | 刷新令牌 | ❌ |
| `/token` | GET | 获取令牌信息 | ✅ |

### AI 服务接口

#### 图像生成
- `POST /v1/images/generations` - 文本生成图像
- `POST /v1/images/compositions` - 图像合成

#### 视频生成
- `POST /v1/videos/generations` - 图像生成视频

#### 智能对话
- `POST /v1/chat/completions` - 兼容 OpenAI 的对话接口

#### 异步处理
- `POST /v1/async/images/generations` - 异步图像生成
- `POST /v1/async/videos/generations` - 异步视频生成
- `GET /v1/async/tasks/{task_id}/status` - 查询任务状态
- `GET /v1/async/tasks/{task_id}/result` - 获取任务结果
- `POST /v1/async/batch/submit` - 批量提交任务

### 系统管理

| 接口 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/v1/models` | GET | 获取模型列表 | ❌ |
| `/usage` | GET | 使用统计 | ✅ |
| `/proxy` | GET | 代理信息 | ❌ |

## 🛠️ 故障排除

### 常见问题

1. **文档页面无法访问**
   - 检查服务器是否正常启动
   - 确认端口 7860 未被占用
   - 查看服务器日志是否有错误

2. **接口测试失败**
   - 确认已正确设置认证 Token
   - 检查请求参数格式是否正确
   - 查看响应中的错误信息

3. **文档内容不更新**
   - 重新构建项目：`npm run build`
   - 重启服务器：`npm start`
   - 清除浏览器缓存

### 调试模式

启用详细日志：

```bash
DEBUG=swagger:* npm start
```

## 📞 技术支持

如果在使用过程中遇到问题，请：

1. 查看 [项目文档](https://github.com/iptag/jimeng-api)
2. 提交 [Issue](https://github.com/iptag/jimeng-api/issues)
3. 联系技术支持：support@example.com

---

**即梦 API Team**
*让 AI 创作更简单*