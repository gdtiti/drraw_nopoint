/**
 * @swagger
 * /:
 *   get:
 *     tags:
 *       - System
 *     summary: 系统信息
 *     description: |
 *       获取API服务的基本信息和状态。
 *     responses:
 *       200:
 *         description: 系统信息获取成功
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
 *                   example: "免费的AI图像和视频生成API服务"
 *                 documentation:
 *                   type: string
 *                   example: "https://github.com/iptag/jimeng-api"
 *                 endpoints:
 *                   type: object
 *                   properties:
 *                     images:
 *                       type: string
 *                       example: "/v1/images/generations"
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
 *                     docs:
 *                       type: string
 *                       example: "/docs"
 */

/**
 * @swagger
 * /ping:
 *   get:
 *     tags:
 *       - Health
 *     summary: 健康检查
 *     description: |
 *       检查API服务的健康状态。
 *     responses:
 *       200:
 *         description: 服务正常运行
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ok"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-01-22T10:00:00.000Z"
 *                 uptime:
 *                   type: number
 *                   example: 3600
 */

/**
 * @swagger
 * /v1/models:
 *   get:
 *     tags:
 *       - Models
 *     summary: 获取模型列表
 *     description: |
 *       获取所有可用的AI模型列表及其能力信息。
 *     responses:
 *       200:
 *         description: 模型列表获取成功
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
 *                     object:
 *                       type: string
 *                       example: "list"
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "jimeng-4.5"
 *                           object:
 *                             type: string
 *                             example: "model"
 *                           created:
 *                             type: integer
 *                             example: 1705870400
 *                           owned_by:
 *                             type: string
 *                             example: "jimeng"
 *                           capabilities:
 *                             type: object
 *                             properties:
 *                               text_generation:
 *                                 type: boolean
 *                                 example: true
 *                               image_generation:
 *                                 type: boolean
 *                                 example: true
 *                               video_generation:
 *                                 type: boolean
 *                                 example: false
 */

/**
 * @swagger
 * /usage:
 *   get:
 *     tags:
 *       - Usage
 *     summary: 获取使用统计
 *     description: |
 *       获取API使用统计信息，需要认证。
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 使用统计获取成功
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
 *                     period:
 *                       type: string
 *                       example: "2025-01"
 *                     total_requests:
 *                       type: integer
 *                       example: 1000
 *                     image_generations:
 *                       type: integer
 *                       example: 600
 *                     video_generations:
 *                       type: integer
 *                       example: 300
 *                     chat_completions:
 *                       type: integer
 *                       example: 100
 *                     tokens_used:
 *                       type: integer
 *                       example: 50000
 *       401:
 *         description: 未授权访问
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /proxy:
 *   get:
 *     tags:
 *       - Proxy
 *     summary: 获取代理信息
 *     description: |
 *       获取代理服务配置信息。
 *     responses:
 *       200:
 *         description: 代理信息获取成功
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
 *                       example: true
 *                     proxy_host:
 *                       type: string
 *                       example: "127.0.0.1"
 *                     proxy_port:
 *                       type: integer
 *                       example: 10808
 *                     proxy_type:
 *                       type: string
 *                       example: "socks5"
 */