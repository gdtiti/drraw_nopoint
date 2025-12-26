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
 *
 *       ## 使用限制
 *       - 提示词长度：1-1000 字符
 *       - 每次请求最多生成 1 张图像
 *       - 支���的格式：URL 或 Base64 JSON
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ImageGenerationRequest'
 *           examples:
 *            简单风景生成:
 *              value:
 *                prompt: "美丽的日落风景，山峦起伏，晚霞满天"
 *                model: "jimeng-4.5"
 *                ratio: "16:9"
 *                resolution: "1080p"
 *            角色设计:
 *              value:
 *                prompt: "可爱的卡通猫咪角色，大眼睛，橙色毛发，简约风格"
 *                model: "jimeng-4.5"
 *                ratio: "1:1"
 *                negative_prompt: "模糊, 复杂背景, 多余细节"
 *                intelligent_ratio: true
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
 *             examples:
 *               参数错误:
 *                 value:
 *                   success: false
 *                   error: "提示词不能为空"
 *                   code: "INVALID_PROMPT"
 *               不支持的模型:
 *                 value:
 *                   success: false
 *                   error: "不支持的模型: invalid-model"
 *                   code: "UNSUPPORTED_MODEL"
 *       401:
 *         description: 认证失败
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "无效的认证令牌"
 *               code: "INVALID_TOKEN"
 *       429:
 *         description: 请求频率过高
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "请求过于频繁，请稍后再试"
 *               code: "RATE_LIMIT_EXCEEDED"
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "图像生成服务暂时不可用"
 *               code: "SERVICE_UNAVAILABLE"

 * /v1/images/compositions:
 *   post:
 *     tags:
 *       - Images
 *     summary: 图像合成（多图合一）
 *     description: |
 *       将多张图像合成为一张新的图像，支持自定义合成规则和效果。
 *
 *       ## 合成特性
 *       - 支持 1-4 张图像输入
 *       - 智能图像融合
 *       - 风格统一处理
 *       - 自定义合成效果
 *
 *       ## 使用场景
 *       - 多元素组合创作
 *       - 风格迁移应用
 *       - 图像拼接融合
 *       - 艺术创作辅助
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ImageCompositionRequest'
 *           examples:
 *            多图合成:
 *              value:
 *                prompt: "将风景和人物合成一幅艺术画作"
 *                images: ["data:image/jpeg;base64,/9j/4AAQSkZJRg...", "data:image/png;base64,iVBORw0KGgo..."]
 *                model: "jimeng-4.5"
 *                ratio: "16:9"
 *                sample_strength: 0.8
 *            风格融合:
 *              value:
 *                prompt: "保持人物主体，融合油画风格背景"
 *                images: ["data:image/jpeg;base64,/9j/4AAQSkZJRg...", "data:image/jpeg;base64,/9j/4AAQSkZJRg..."]
 *                model: "jimeng-4.5"
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
 *             examples:
 *               图像数量错误:
 *                 value:
 *                   success: false
 *                   error: "图像数量必须在 1-4 张之间"
 *                   code: "INVALID_IMAGE_COUNT"
 *               无效图像格式:
 *                 value:
 *                   success: false
 *                   error: "不支持的图像格式"
 *                   code: "INVALID_IMAGE_FORMAT"
 *       401:
 *         description: 认证失败
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