/**
 * @swagger
 * /v1/chat/completions:
 *   post:
 *     tags:
 *       - Chat
 *     summary: 智能对话
 *     description: 兼容OpenAI格式的智能对话接口，支持流式和非流式响应。
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatCompletionRequest'
 *     responses:
 *       200:
 *         description: 对话完成
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatCompletionResponse'
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 未授权访问
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */