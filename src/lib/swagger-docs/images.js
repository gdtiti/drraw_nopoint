/**
 * @swagger
 * /v1/images/generations:
 *   post:
 *     tags:
 *       - Images
 *     summary: 生成图像（文本生成图像）
 *     description: |
 *       根据文本提示词生成图像。支持多种模型、分辨率和风格选项。
 *
 *       ## 特性说明
 *       - 支持多种 AI 模型选择
 *       - 自定义图像比例和分辨率
 *       - 负面提示词控制
 *       - 智能比例调整
 *       - 采样强度调节
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ImageGenerationRequest'
 *           examples:
 *             标准图像生成:
 *               value:
 *                 prompt: "美丽的日落风景"
 *                 model: "jimeng-4.5"
 *                 ratio: "16:9"
 *                 resolution: "1080p"
 *                 intelligent_ratio: false
 *                 sample_strength: 0.8
 *                 response_format: "url"
 *     responses:
 *       200:
 *         description: 图像生成成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ImageResponse'
 *             examples:
 *               成功响应:
 *                 value:
 *                   created: 1705870400
 *                   data:
 *                     - url: "https://example.com/generated-image.jpg"
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
 */

/**
 * @swagger
 * /v1/images/compositions:
 *   post:
 *     tags:
 *       - Images
 *     summary: 图像合成
 *     description: |
 *       将多张图像合成为一张新的图像。支持最多4张图像的智能合成。
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ImageCompositionRequest'
 *     responses:
 *       200:
 *         description: 图像合成成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ImageResponse'
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