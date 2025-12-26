/**
 * @swagger
 * /v1/videos/generations:
 *   post:
 *     tags:
 *       - Videos
 *     summary: 生成视频（图像转视频）
 *     description: |
 *       将静态图像转换为动态视频，支持多种视频风格和时长选项。
 *
 *       ## 视频生成特性
 *       - 支持图片生成动态视频
 *       - 可选择视频时长（5秒或10秒）
 *       - 多种视频比例和分辨率
 *       - 智能运动预测和生成
 *
 *       ## 输入要求
 *       - 支持多种图像格式：JPG, PNG, WebP
 *       - 图像大小建议不超过 10MB
 *       - 可传入 0-5 张参考图像
 *
 *       ## 使用限制
 *       - 视频生成需要较长时间，建议使用异步接口
 *       - 单次请求最多处理 5 张图像
 *       - 视频格式为 MP4
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               model:
 *                 type: string
 *                 description: 使用的模型
 *                 enum: ['jimeng-video-3.5-pro', 'jimeng-video-3.5']
 *                 default: 'jimeng-video-3.5-pro'
 *               prompt:
 *                 type: string
 *                 description: 视频生成提示词
 *                 example: "海浪缓缓拍打沙滩的动态场景"
 *               file_paths:
 *                 type: string
 *                 description: 参考图像路径列表（JSON 字符串）
 *                 example: '["image1.jpg", "image2.jpg"]'
 *               ratio:
 *                 type: string
 *                 description: 视频宽高比
 *                 enum: ['16:9', '9:16', '1:1']
 *                 default: '16:9'
 *               resolution:
 *                 type: string
 *                 description: 视频分辨率
 *                 enum: ['720p', '1080p']
 *                 default: '1080p'
 *               duration:
 *                 type: integer
 *                 description: 视频时长（秒）
 *                 enum: [5, 10]
 *                 default: 5
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/VideoGenerationRequest'
 *               - type: object
 *                 properties:
 *                   files:
 *                     type: array
 *                     items:
 *                       type: string
 *                       format: binary
 *                     description: 上传的图像文件
 *           examples:
 *            简单视频生成:
 *              value:
 *                prompt: "飘动的云朵在蓝天中缓慢移动"
 *                model: "jimeng-video-3.5-pro"
 *                ratio: "16:9"
 *                duration: 5
 *            基于图像的视频:
 *              value:
 *                prompt: "让静态的风景照片产生动态效果"
 *                model: "jimeng-video-3.5-pro"
 *                file_paths: ["landscape.jpg"]
 *                ratio: "16:9"
 *                duration: 10
 *     responses:
 *       200:
 *         description: 视频生成成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VideoResponse'
 *             examples:
 *               成功响应:
 *                 value:
 *                   created: 1705870400
 *                   data:
 *                     - video_url: "https://example.com/generated-video.mp4"
 *                       cover_url: "https://example.com/video-cover.jpg"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               提示词错误:
 *                 value:
 *                   success: false
 *                   error: "提示词不能为空"
 *                   code: "INVALID_PROMPT"
 *               文件格式错误:
 *                 value:
 *                   success: false
 *                   error: "不支持的文件格式"
 *                   code: "UNSUPPORTED_FILE_FORMAT"
 *               文件大小超限:
 *                 value:
 *                   success: false
 *                   error: "文件大小不能超过 10MB"
 *                   code: "FILE_TOO_LARGE"
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
 *               error: "视频生成请求过于频繁，请稍后再试"
 *               code: "RATE_LIMIT_EXCEEDED"
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "视频生成服务暂时不可用"
 *               code: "SERVICE_UNAVAILABLE"
 *       504:
 *         description: 请求超时
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "视频生成超时，请尝试使用异步接口"
 *               code: "REQUEST_TIMEOUT"