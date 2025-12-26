/**
 * @swagger
 * /v1/chat/completions:
 *   post:
 *     tags:
 *       - Chat
 *     summary: 智能对话（兼容 OpenAI API）
 *     description: |
 *       兼容 OpenAI API 格式的智能对话接口，支持流式输出和多轮对话。
 *
 *       ## 功能特性
 *       - 兼容 OpenAI ChatGPT API 格式
 *       - 支持多轮对话上下文
 *       - 流式输出和普通输出
 *       - 可调节的生成参数
 *       - 智能对话理解和生成
 *
 *       ## 使用场景
 *       - 智能问答
 *       - 文本创作
 *       - 代码生成
 *       - 翻译服务
 *       - 对话系统
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messages
 *             properties:
 *               model:
 *                 type: string
 *                 description: 使用的模型
 *                 enum: ['gpt-3.5-turbo', 'gpt-4', 'jimeng-chat']
 *                 default: 'gpt-3.5-turbo'
 *                 example: 'gpt-3.5-turbo'
 *               messages:
 *                 type: array
 *                 description: 对话消息列表
 *                 items:
 *                   type: object
 *                   required:
 *                     - role
 *                     - content
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: ['system', 'user', 'assistant']
 *                       description: 消息角色
 *                     content:
 *                       type: string
 *                       description: 消息内容
 *                 example:
 *                   - role: "system"
 *                     content: "你是一个有用的AI助手。"
 *                   - role: "user"
 *                     content: "请写一个关于春天的诗。"
 *               temperature:
 *                 type: number
 *                 description: 生成温度，控制随机性
 *                 minimum: 0
 *                 maximum: 2
 *                 default: 1
 *                 example: 0.7
 *               max_tokens:
 *                 type: integer
 *                 description: 最大生成token数
 *                 minimum: 1
 *                 maximum: 4096
 *                 default: 1000
 *                 example: 500
 *               top_p:
 *                 type: number
 *                 description: 核采样参数
 *                 minimum: 0
 *                 maximum: 1
 *                 default: 1
 *                 example: 0.9
 *               frequency_penalty:
 *                 type: number
 *                 description: 频率惩罚
 *                 minimum: -2
 *                 maximum: 2
 *                 default: 0
 *                 example: 0
 *               presence_penalty:
 *                 type: number
 *                 description: 存在惩罚
 *                 minimum: -2
 *                 maximum: 2
 *                 default: 0
 *                 example: 0
 *               stream:
 *                 type: boolean
 *                 description: 是否启用流式输出
 *                 default: false
 *                 example: false
 *               stop:
 *                 oneOf:
 *                   - type: string
 *                   - type: array
 *                     items:
 *                       type: string
 *                 description: 停止词
 *                 example: ["\n", "Human:", "AI:"]
 *           examples:
 *            简单对话:
 *              value:
 *                model: "gpt-3.5-turbo"
 *                messages:
 *                  - role: "user"
 *                    content: "你好，请介绍一下你自己。"
 *                max_tokens: 200
 *            创意写作:
 *              value:
 *                model: "gpt-4"
 *                messages:
 *                  - role: "system"
 *                    content: "你是一个创意写作助手。"
 *                  - role: "user"
 *                    content: "写一个关于时间旅行的小故事开头。"
 *                temperature: 0.8
 *                max_tokens: 300
 *                top_p: 0.95
 *            流式输出:
 *              value:
 *                model: "gpt-3.5-turbo"
 *                messages:
 *                  - role: "user"
 *                    content: "解释什么是量子计算。"
 *                stream: true
 *                max_tokens: 500
 *     responses:
 *       200:
 *         description: 对话生成成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: 对话ID
 *                   example: "chatcmpl-123"
 *                 object:
 *                   type: string
 *                   description: 对象类型
 *                   example: "chat.completion"
 *                 created:
 *                   type: integer
 *                   description: 创建时间戳
 *                   example: 1677652288
 *                 model:
 *                   type: string
 *                   description: 使用的模型
 *                   example: "gpt-3.5-turbo"
 *                 choices:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       index:
 *                         type: integer
 *                         example: 0
 *                       message:
 *                         type: object
 *                         properties:
 *                           role:
 *                             type: string
 *                             example: "assistant"
 *                           content:
 *                             type: string
 *                             example: "你好！我是一个AI助手，很高兴为您服务..."
 *                       finish_reason:
 *                         type: string
 *                         example: "stop"
 *                 usage:
 *                   type: object
 *                   properties:
 *                     prompt_tokens:
 *                       type: integer
 *                       example: 56
 *                     completion_tokens:
 *                       type: integer
 *                       example: 31
 *                     total_tokens:
 *                       type: integer
 *                       example: 87
 *             examples:
 *               成功响应:
 *                 value:
 *                   id: "chatcmpl-123"
 *                   object: "chat.completion"
 *                   created: 1677652288
 *                   model: "gpt-3.5-turbo"
 *                   choices:
 *                     - index: 0
 *                       message:
 *                         role: "assistant"
 *                         content: "你好！我是一个AI助手..."
 *                       finish_reason: "stop"
 *                   usage:
 *                     prompt_tokens: 56
 *                     completion_tokens: 31
 *                     total_tokens: 87
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               消息格式错误:
 *                 value:
 *                   success: false
 *                   error: "消息格式不正确"
 *                   code: "INVALID_MESSAGE_FORMAT"
 *               参数范围错误:
 *                 value:
 *                   success: false
 *                   error: "temperature 必须在 0-2 之间"
 *                   code: "INVALID_PARAMETER_RANGE"
 *       401:
 *         description: 认证失败
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: 请求频率过高
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       default:
 *         description: 流式响应（当 stream=true 时）
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               description: Server-Sent Events 格式的流式数据
 *             example: |
 *               data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}
 *
 *               data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"content":"你好"},"finish_reason":null}]}
 *
 *               data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"content":"！"},"finish_reason":null}]}
 *
 *               data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}
 *
 *               data: [DONE]