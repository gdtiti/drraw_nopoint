/**
 * @swagger
 * /token:
 *   post:
 *     tags:
 *       - Token
 *     summary: 刷新认证令牌
 *     description: |
 *       刷新或获取新的认证令牌，用于访问其他需要认证的API接口。
 *
 *       ## 令牌管理
 *       - 支持令牌自动刷新
 *       - 令牌具有有效期限制
 *       - 支持多令牌负载均衡
 *       - 自动验证令牌有效性
 *
 *       ## 使用建议
 *       - 定期刷新令牌以避免过期
 *       - 缓存有效令牌以提高性能
 *       - 处理令牌刷新失败的错误情况
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refresh_token
 *             properties:
 *               refresh_token:
 *                 type: string
 *                 description: 刷新令牌
 *                 example: "refresh_token_string_here"
 *               grant_type:
 *                 type: string
 *                 description: 授权类型
 *                 enum: ["refresh_token"]
 *                 default: "refresh_token"
 *           examples:
 *            刷新令牌:
 *              value:
 *                refresh_token: "refresh_token_string_here"
 *                grant_type: "refresh_token"
 *     responses:
 *       200:
 *         description: 令牌刷新成功
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
 *                     access_token:
 *                       type: string
 *                       description: 新的访问令牌
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                     token_type:
 *                       type: string
 *                       example: "Bearer"
 *                     expires_in:
 *                       type: integer
 *                       description: 令牌有效期（秒）
 *                       example: 3600
 *                     refresh_token:
 *                       type: string
 *                       description: 新的刷新令牌
 *                       example: "new_refresh_token_string"
 *                     scope:
 *                       type: string
 *                       description: 令牌权限范围
 *                       example: "read write"
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       description: 令牌创建时间
 *                       example: "2025-01-22T10:00:00.000Z"
 *             examples:
 *               成功响应:
 *                 value:
 *                   success: true
 *                   data:
 *                     access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                     token_type: "Bearer"
 *                     expires_in: 3600
 *                     refresh_token: "new_refresh_token_string"
 *                     scope: "read write"
 *                     created_at: "2025-01-22T10:00:00.000Z"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               无效令牌:
 *                 value:
 *                   success: false
 *                   error: "无效的刷新令牌"
 *                   code: "INVALID_REFRESH_TOKEN"
 *               令牌过期:
 *                 value:
 *                   success: false
 *                   error: "刷新令牌已过期"
 *                   code: "REFRESH_TOKEN_EXPIRED"
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
 *             example:
 *               success: false
 *               error: "令牌刷新过于频繁，请稍后再试"
 *               code: "RATE_LIMIT_EXCEEDED"
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "令牌服务暂时不可用"
 *               code: "SERVICE_UNAVAILABLE"
 *
 *   get:
 *     tags:
 *       - Token
 *     summary: 获取令牌信息
 *     description: 获取当前令牌的详细信息，包括有效期和权限
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 获取令牌信息成功
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
 *                     token_info:
 *                       type: object
 *                       properties:
 *                         token_id:
 *                           type: string
 *                           description: 令牌ID
 *                         user_id:
 *                           type: string
 *                           description: 用户ID
 *                         permissions:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: 权限列表
 *                           example: ["image:generate", "video:generate", "chat:complete"]
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                           description: 创建时间
 *                         expires_at:
 *                           type: string
 *                           format: date-time
 *                           description: 过期时间
 *                         is_active:
 *                           type: boolean
 *                           description: 是否激活
 *                         usage_count:
 *                           type: integer
 *                           description: 使用次数
 *                         last_used:
 *                           type: string
 *                           format: date-time
 *                           description: 最后使用时间
 *       401:
 *         description: 令牌无效或已过期
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'