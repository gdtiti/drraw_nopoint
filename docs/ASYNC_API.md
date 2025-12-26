# 即梦API异步接口文档

## 概述

在保持原有同步接口的基础上，我们新增了一套完整的异步接口系统。异步接口采用任务队列模式，能够更好地处理长时间运行的任务，支持批量提交、进度查询、任务取消等功能。

## 异步接口优势

1. **非阻塞处理**：提交任务后立即返回，无需等待生成完成
2. **进度追踪**：实时查看任务执行进度和状态
3. **批量操作**：支持批量提交多个任务
4. **资源管理**：智能队列管理，避免服务器过载
5. **容错机制**：自动重试和错误恢复

## API 端点

### 1. 异步图片生成

**POST** `/v1/async/images/generations`

提交图片生成任务

**请求参数**（与同步接口相同）：
```json
{
  "model": "jimeng-4.5",
  "prompt": "一张美丽的风景画",
  "ratio": "16:9",
  "resolution": "2k",
  "negative_prompt": "模糊",
  "response_format": "url"
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "task_id": "uuid-string",
    "status": "pending",
    "created_at": "2025-01-22T10:00:00.000Z",
    "message": "任务已提交，请使用task_id查询进度和结果"
  }
}
```

### 2. 异步图片合成

**POST** `/v1/async/images/compositions`

提交图片合成任务

**请求参数**：
```json
{
  "model": "jimeng-4.5",
  "prompt": "合成图片",
  "images": ["base64...", "base64..."],
  "response_format": "url"
}
```

### 3. 异步视频生成

**POST** `/v1/async/videos/generations`

提交视频生成任务

**请求参数**：
```json
{
  "model": "jimeng-video-3.5-pro",
  "prompt": "生成视频",
  "file_paths": ["image1.jpg", "image2.jpg"],
  "ratio": "16:9",
  "duration": 5
}
```

### 4. 任务状态查询

**GET** `/v1/async/tasks/:task_id/status`

查询任务执行状态

**响应**：
```json
{
  "success": true,
  "data": {
    "task_id": "uuid-string",
    "type": "image_generation",
    "status": "running",
    "progress": 45,
    "created_at": "2025-01-22T10:00:00.000Z",
    "updated_at": "2025-01-22T10:02:30.000Z",
    "started_at": "2025-01-22T10:00:05.000Z",
    "error": null,
    "has_result": false,
    "estimated_time_remaining": 180
  }
}
```

**状态说明**：
- `pending`: 等待中
- `running`: 运行中
- `completed`: 已完成
- `failed`: 失败
- `cancelled`: 已取消

### 5. 获取任务结果

**GET** `/v1/async/tasks/:task_id/result`

获取任务执行结果

**成功响应**：
```json
{
  "success": true,
  "data": {
    "task_id": "uuid-string",
    "status": "completed",
    "result": {
      "created": 1705870400,
      "data": [
        {
          "url": "https://example.com/image1.jpg"
        }
      ]
    },
    "completed_at": "2025-01-22T10:05:00.000Z",
    "execution_time": 295000
  }
}
```

**失败响应**：
```json
{
  "success": true,
  "data": {
    "task_id": "uuid-string",
    "status": "failed",
    "error": "网络连接错误",
    "completed_at": "2025-01-22T10:02:00.000Z"
  }
}
```

### 6. 任务管理

#### 取消任务

**DELETE** `/v1/async/tasks/:task_id/cancel`

#### 删除任务

**DELETE** `/v1/async/tasks/:task_id`

#### 获取用户任务列表

**GET** `/v1/async/tasks`

**查询参数**：
- `status`: 过滤特定状态的任务
- `limit`: 返回数量限制（默认20）

#### 获取系统统计

**GET** `/v1/async/stats`

**响应**：
```json
{
  "success": true,
  "data": {
    "statistics": {
      "pending": 5,
      "running": 3,
      "completed": 156,
      "failed": 2,
      "cancelled": 1
    },
    "total": 167,
    "timestamp": "2025-01-22T10:00:00.000Z"
  }
}
```

### 7. 批量操作

#### 批量提交任务

**POST** `/v1/async/batch/submit`

**请求参数**：
```json
{
  "tasks": [
    {
      "type": "image_generation",
      "model": "jimeng-4.5",
      "prompt": "图片1",
      "ratio": "1:1"
    },
    {
      "type": "image_generation",
      "model": "jimeng-4.0",
      "prompt": "图片2",
      "ratio": "16:9"
    },
    {
      "type": "video_generation",
      "model": "jimeng-video-3.5",
      "prompt": "视频1",
      "duration": 5
    }
  ]
}
```

#### 批量取消任务

**DELETE** `/v1/async/batch/cancel`

**请求参数**：
```json
{
  "task_ids": ["uuid1", "uuid2", "uuid3"]
}
```

## 使用示例

### 基本流程

```bash
# 1. 提交图片生成任务
curl -X POST http://localhost:7860/v1/async/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_token" \
  -d '{
    "prompt": "美丽的日落风景",
    "model": "jimeng-4.5"
  }'

# 2. 获取任务状态
curl -X GET http://localhost:7860/v1/async/tasks/{task_id}/status

# 3. 获取任务结果
curl -X GET http://localhost:7860/v1/async/tasks/{task_id}/result
```

### 批量提交示例

```javascript
const tasks = [
  {
    type: 'image_generation',
    prompt: '风景1',
    model: 'jimeng-4.5'
  },
  {
    type: 'image_generation',
    prompt: '风景2',
    model: 'jimeng-4.0'
  },
  {
    type: 'video_generation',
    prompt: '动态视频',
    duration: 5
  }
];

fetch('http://localhost:7860/v1/async/batch/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({ tasks })
})
.then(response => response.json())
.then(data => {
  console.log('提交结果:', data);
});
```

## 任务队列特性

### 优先级系统

- **HIGH**: 视频生成任务（默认）
- **NORMAL**: 图片生成任务（默认）
- **LOW**: 低优先级任务

### 并发控制

- 默认最大并发数：3个任务
- 智能队列调度
- 自动负载均衡

### 任务超时

- 图片生成：15分钟超时
- 视频生成：30分钟超时

### 任务清理

- 已完成任务保留24小时
- 自动清理过期任务
- 支持手动删除

## 最佳实践

1. **进度轮询建议间隔**：
   - 运行中任务：每2-5秒查询一次
   - 等待中任务：每10-30秒查询一次

2. **错误处理**：
   - 检查状态码和错误信息
   - 实现重试机制
   - 记录失败任务供分析

3. **批量操作**：
   - 限制批量提交数量（建议≤20）
   - 监控队列状态
   - 分批处理大量任务

4. **资源管理**：
   - 监控系统统计信息
   - 避免高峰时段批量提交
   - 合理设置任务优先级

## SDK 示例

### JavaScript/Node.js

```javascript
class JimengAsyncAPI {
  constructor(baseURL, token) {
    this.baseURL = baseURL;
    this.token = token;
  }

  async submitImageGeneration(params) {
    const response = await fetch(`${this.baseURL}/v1/async/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify(params)
    });
    return response.json();
  }

  async getTaskStatus(taskId) {
    const response = await fetch(`${this.baseURL}/v1/async/tasks/${taskId}/status`);
    return response.json();
  }

  async getTaskResult(taskId) {
    const response = await fetch(`${this.baseURL}/v1/async/tasks/${taskId}/result`);
    return response.json();
  }

  async waitForTask(taskId, timeout = 300000, pollInterval = 3000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const status = await this.getTaskStatus(taskId);

      if (status.data.status === 'completed') {
        return await this.getTaskResult(taskId);
      }

      if (status.data.status === 'failed' || status.data.status === 'cancelled') {
        throw new Error(`任务${status.data.status === 'failed' ? '失败' : '被取消'}: ${status.data.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('任务超时');
  }
}

// 使用示例
const api = new JimengAPI('http://localhost:7860', 'your_token');

// 提交任务
const { data } = await api.submitImageGeneration({
  prompt: "美丽的风景",
  model: "jimeng-4.5"
});

// 等待完成
try {
  const result = await api.waitForTask(data.task_id);
  console.log('生成结果:', result);
} catch (error) {
  console.error('任务失败:', error.message);
}
```

### Python

```python
import requests
import time

class JimengAsyncAPI:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.token = token

    def submit_image_generation(self, params):
        response = requests.post(
            f"{self.base_url}/v1/async/images/generations",
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.token}'
            },
            json=params
        )
        return response.json()

    def get_task_status(self, task_id):
        response = requests.get(
            f"{self.base_url}/v1/async/tasks/{task_id}/status"
        )
        return response.json()

    def get_task_result(self, task_id):
        response = requests.get(
            f"{self.base_url}/v1/async/tasks/{task_id}/result"
        )
        return response.json()

    def wait_for_task(self, task_id, timeout=300, poll_interval=3):
        start_time = time.time()

        while time.time() - start_time < timeout:
            status = self.get_task_status(task_id)

            if status['data']['status'] == 'completed':
                return self.get_task_result(task_id)

            if status['data']['status'] in ['failed', 'cancelled']:
                raise Exception(f"任务{status['data']['status']}: {status['data']['error']}")

            time.sleep(poll_interval)

        raise Exception("任务超时")

# 使用示例
api = JimengAsyncAPI('http://localhost:7860', 'your_token')

# 提交任务
result = api.submit_image_generation({
    'prompt': '美丽的风景',
    'model': 'jimeng-4.5'
})

# 等待完成
try:
    final_result = api.wait_for_task(result['data']['task_id'])
    print('生成结果:', final_result)
except Exception as e:
    print('任务失败:', str(e))
```

## 注意事项

1. **Token有效期**：确保token在任务执行期间有效
2. **任务存储**：任务结果仅在服务器保存24小时
3. **并发限制**：注意最大并发任务数限制
4. **网络稳定性**：长时间任务需要稳定的网络连接
5. **资源清理**：定期清理不需要的任务数据

## 性能优化建议

1. **批量提交**：使用批量接口减少网络开销
2. **合理轮询**：根据任务类型调整轮询频率
3. **缓存结果**：缓存常用查询结果
4. **连接池**：使用HTTP连接池提升性能
5. **监控队列**：监控队列状态，合理调度任务

通过异步接口系统，您可以更高效地处理大量生成任务，同时提供更好的用户体验和系统稳定性。