/**
 * @swagger
 * /v1/models:
 *   get:
 *     tags:
 *       - Models
 *     summary: 获取可用模型列表
 *     description: |
 *       获取当前支持的 AI 模型列表，包括图像生成、视频生成和对话模型。
 *
 *       ## 模型分类
 *       - **图像生成模型**: 用于文本生成图像
 *       - **视频生成模型**: 用于图像生成视频
 *       - **对话模型**: 用于智能对话和文本生成
 *
 *       ## 模型信息
 *       每个模型包含以下信息：
 *       - 模型ID和名称
 *       - 模型类型
 *       - 支持的功能特性
 *       - 性能描述
 *       - 使用限制
 *     responses:
 *       200:
 *         description: 获取模型列表成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 object:
 *                   type: string
 *                   example: "list"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: 模型唯一标识
 *                         example: "jimeng-4.5"
 *                       object:
 *                         type: string
 *                         description: 对象类型
 *                         example: "model"
 *                       created:
 *                         type: integer
 *                         description: 创建时间戳
 *                         example: 1677610602
 *                       owned_by:
 *                         type: string
 *                         description: 模型所有者
 *                         example: "jimeng"
 *                       permission:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               object:
 *                                 type: string
 *                               created:
 *                                 type: integer
 *                               allow_create_engine:
 *                                 type: boolean
 *                               allow_sampling:
 *                                 type: boolean
 *                               allow_logprobs:
 *                                 type: boolean
 *                               allow_search_indices:
 *                                 type: boolean
 *                               allow_view:
 *                                 type: boolean
 *                               allow_fine_tuning:
 *                                 type: boolean
 *                               organization:
 *                                 type: string
 *                               group:
 *                                 type: string
 *                               is_blocking:
 *                                 type: boolean
 *                       root:
 *                         type: string
 *                         description: 根模型
 *                         example: "jimeng-4.5"
 *                       parent:
 *                         type: string
 *                         description: 父模型
 *                         example: null
 *                       capabilities:
 *                         type: object
 *                         description: 模型能力
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: ["image_generation", "video_generation", "chat"]
 *                             description: 模型类型
 *                           features:
 *                             type: array
 *                             items:
 *                               type: string
 *                             description: 支持的功能特性
 *                           max_resolution:
 *                             type: string
 *                             description: 最大分辨率
 *                           supported_formats:
 *                             type: array
 *                             items:
 *                               type: string
 *                             description: 支持的输出格式
 *                           quality_score:
 *                             type: number
 *                             description: 质量评分
 *                           speed_score:
 *                             type: number
 *                             description: 速度评分
 *                           description:
 *                             type: string
 *                             description: 模型描述
 *                     example:
 *                       id: "jimeng-4.5"
 *                       object: "model"
 *                       created: 1677610602
 *                       owned_by: "jimeng"
 *                       root: "jimeng-4.5"
 *                       parent: null
 *                       capabilities:
 *                         type: "image_generation"
 *                         features: ["text_to_image", "high_resolution", "style_control"]
 *                         max_resolution: "4K"
 *                         supported_formats: ["url", "b64_json"]
 *                         quality_score: 9.5
 *                         speed_score: 7.8
 *                         description: "最新一代图像生成模型，支持高分辨率和精细控制"
 *             examples:
 *               成功响应:
 *                 value:
 *                   object: "list"
 *                   data:
 *                     - id: "jimeng-4.5"
 *                       object: "model"
 *                       created: 1677610602
 *                       owned_by: "jimeng"
 *                       root: "jimeng-4.5"
 *                       parent: null
 *                       capabilities:
 *                         type: "image_generation"
 *                         features: ["text_to_image", "high_resolution", "style_control"]
 *                         max_resolution: "4K"
 *                         supported_formats: ["url", "b64_json"]
 *                         quality_score: 9.5
 *                         speed_score: 7.8
 *                         description: "最新一代图像生成模型，支持高分辨率和精细控制"
 *                     - id: "jimeng-video-3.5-pro"
 *                       object: "model"
 *                       created: 1677610602
 *                       owned_by: "jimeng"
 *                       root: "jimeng-video-3.5-pro"
 *                       parent: null
 *                       capabilities:
 *                         type: "video_generation"
 *                         features: ["image_to_video", "motion_prediction", "high_quality"]
 *                         max_resolution: "1080p"
 *                         supported_formats: ["mp4"]
 *                         quality_score: 9.2
 *                         speed_score: 6.5
 *                         description: "专业级视频生成模型，支持高质量动态效果"
 *                     - id: "gpt-3.5-turbo"
 *                       object: "model"
 *                       created: 1677610602
 *                       owned_by: "openai-compatible"
 *                       root: "gpt-3.5-turbo"
 *                       parent: null
 *                       capabilities:
 *                         type: "chat"
 *                         features: ["conversation", "reasoning", "creativity"]
 *                         max_resolution: null
 *                         supported_formats: ["text"]
 *                         quality_score: 8.5
 *                         speed_score: 9.2
 *                         description: "兼容OpenAI格式的对话模型，支持多轮对话"