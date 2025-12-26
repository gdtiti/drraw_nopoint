/**
 * @swagger
 * /:
 *   get:
 *     tags:
 *       - System
 *     summary: 系统信息
 *     description: 获取 API 服务的基本信息和可用端点
 *     responses:
 *       200:
 *         description: 获取系统信息成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 service:
 *                   type: string
 *                   example: "jimeng-api"
 *                 status:
 *                   type: string
 *                   example: "running"
 *                 version:
 *                   type: string
 *                   example: "1.6.3"
 *                 description:
 *                   type: string
 *                   example: "免费的AI图像和视频生成API服务 - 基于即梦AI的逆向工程实现"
 *                 documentation:
 *                   type: string
 *                   format: uri
 *                   example: "https://github.com/iptag/jimeng-api"
 *                 endpoints:
 *                   type: object
 *                   properties:
 *                     images:
 *                       type: string
 *                       example: "/v1/images/generations"
 *                     compositions:
 *                       type: string
 *                       example: "/v1/images/compositions"
 *                     videos:
 *                       type: string
 *                       example: "/v1/videos/generations"
 *                     chat:
 *                       type: string
 *                       example: "/v1/chat/completions"
 *                     models:
 *                       type: string
 *                       example: "/v1/models"
 *                     health:
 *                       type: string
 *                       example: "/ping"
 *                     usage:
 *                       type: string
 *                       example: "/usage"
 *                     proxy:
 *                       type: string
 *                       example: "/proxy"
 *                     async:
 *                       type: string
 *                       example: "/v1/async"
 *                     docs:
 *                       type: string
 *                       example: "/docs"

 * /ping:
 *   get:
 *     tags:
 *       - Health
 *     summary: 健康检查
 *     description: 检查 API 服务的健康状态
 *     responses:
 *       200:
 *         description: 服务正常
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "pong"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-01-22T10:00:00.000Z"
 *                 uptime:
 *                   type: number
 *                   description: 服务运行时间（秒）
 *                   example: 3600
 *                 version:
 *                   type: string
 *                   example: "1.6.3"

 * /usage:
 *   get:
 *     tags:
 *       - Usage
 *     summary: 获取使用统计
 *     description: 获取当前用户的使用统计信息
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 获取使用统计成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_id:
 *                       type: string
 *                       description: 用户ID
 *                     period:
 *                       type: string
 *                       description: 统计周期
 *                       example: "daily"
 *                     image_generations:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           description: 总生成次数
 *                           example: 150
 *                         success:
 *                           type: integer
 *                           description: 成功次数
 *                           example: 145
 *                         failed:
 *                           type: integer
 *                           description: 失败次数
 *                           example: 5
 *                         tokens_used:
 *                           type: integer
 *                           description: 使用的tokens
 *                           example: 15000
 *                     video_generations:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 25
 *                         success:
 *                           type: integer
 *                           example: 23
 *                         failed:
 *                           type: integer
 *                           example: 2
 *                         duration_seconds:
 *                           type: integer
 *                           description: 总视频时长（秒）
 *                           example: 150
 *                     chat_completions:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 500
 *                         success:
 *                           type: integer
 *                           example: 498
 *                         failed:
 *                           type: integer
 *                           example: 2
 *                         total_tokens:
 *                           type: object
 *                           properties:
 *                             prompt:
 *                               type: integer
 *                               example: 25000
 *                             completion:
 *                               type: integer
 *                               example: 30000
 *                             total:
 *                               type: integer
 *                               example: 55000
 *                     api_calls:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 675
 *                         success_rate:
 *                           type: number
 *                           format: float
 *                           example: 0.98
 *                         average_response_time:
 *                           type: number
 *                           format: float
 *                           description: 平均响应时间（毫秒）
 *                           example: 2340
 *                     limits:
 *                       type: object
 *                       properties:
 *                         daily_limit:
 *                           type: integer
 *                           description: 每日限额
 *                           example: 1000
 *                         daily_usage:
 *                           type: integer
 *                           description: 今日使用量
 *                           example: 675
 *                         reset_time:
 *                           type: string
 *                           format: date-time
 *                           description: 重置时间
 *                           example: "2025-01-23T00:00:00.000Z"
 *       401:
 *         description: 认证失败
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'

 * /proxy:
 *   get:
 *     tags:
 *       - Proxy
 *     summary: 获取代理信息
 *     description: 获取当前配置的代理服务信息
 *     responses:
 *       200:
 *         description: 获取代理信息成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     proxy_enabled:
 *                       type: boolean
 *                       description: 是否启用代理
 *                       example: true
 *                     proxy_type:
 *                       type: string
 *                       description: 代理类型
 *                       enum: ["http", "https", "socks5", "mixed"]
 *                       example: "socks5"
 *                     proxy_host:
 *                       type: string
 *                       description: 代理主机
 *                       example: "127.0.0.1"
 *                     proxy_port:
 *                       type: integer
 *                       description: 代理端口
 *                       example: 10810
 *                     proxy_auth:
 *                       type: boolean
 *                       description: 是否需要认证
 *                       example: false
 *                     connection_status:
 *                       type: string
 *                       description: 连接状态
 *                       enum: ["connected", "disconnected", "error"]
 *                       example: "connected"
 *                     response_time:
 *                       type: number
 *                       description: 响应时间（毫秒）
 *                       example: 120
 *                     last_check:
 *                       type: string
 *                       format: date-time
 *                       description: 最后检查时间
 *                       example: "2025-01-22T10:00:00.000Z"