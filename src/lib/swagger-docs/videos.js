/**
 * @swagger
 * /v1/videos/generations:
 *   post:
 *     tags:
 *       - Videos
 *     summary: 生成视频（图像生成视频）
 *     description: |
 *       根据静态图像生成动态视频。支持多种视频时长和分辨率选项。
 *
 *       ## 特性说明
 *       - 支持图像转视频功能
 *       - 多种视频时长选择（5秒/10秒）
 *       - 自定义视频分辨率
 *       - 智能动态效果生成
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VideoGenerationRequest'
 *           examples:
 *             标准视频生成:
 *               value:
 *                 prompt: "动态的海浪拍打沙滩"
 *                 model: "jimeng-video-3.5-pro"
 *                 file_paths: ["https://example.com/image.jpg"]
 *                 ratio: "16:9"
 *                 resolution: "1080p"
 *                 duration: 5
 *     responses:
 *       200:
 *         description: 视频生成成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VideoResponse'
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