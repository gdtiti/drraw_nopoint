/**
 * @swagger
 * /v1/async/images/generations:
 *   post:
 *     tags:
 *       - Async
 *     summary: 提交异步图片生成任务
 *     description: |
 *       异步提交图片生成任务，立即返回任务ID，后续可通过任务ID查询进度和结果。
 *
 *       ## 异步处理优势
 *       - 非阻塞处理，立即返回任务ID
 *       - 支持长时间运行的生成任务
 *       - 可实时查询任务进度
 *       - 支持任务取消和管理
 *
 *       ## 使用流程
 *       1. 提交任务获取 task_id
 *       2. 轮询 /v1/async/tasks/{task_id}/status 查询进度
 *       3. 完成后获取 /v1/async/tasks/{task_id}/result 结果
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ImageGenerationRequest'
 *           examples:
 *            风景生成任务:
 *              value:
 *                prompt: "壮丽的山间日出，晨雾缭绕"
 *                model: "jimeng-4.5"
 *                ratio: "16:9"
 *                resolution: "2k"
 *     responses:
 *       200:
 *         description: 任务提交成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AsyncTaskResponse'
 *             examples:
 *               成功提交:
 *                 value:
 *                   success: true
 *                   data:
 *                     task_id: "550e8400-e29b-41d4-a716-446655440000"
 *                     status: "pending"
 *                     created_at: "2025-01-22T10:00:00.000Z"
 *                     message: "任务已提交，请使用task_id查询进度和结果"

 * /v1/async/images/compositions:
 *   post:
 *     tags:
 *       - Async
 *     summary: 提交异步图片合成任务
 *     description: 异步提交图片合成任务
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ImageCompositionRequest'
 *     responses:
 *       200:
 *         description: 任务提交成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AsyncTaskResponse'

 * /v1/async/videos/generations:
 *   post:
 *     tags:
 *       - Async
 *     summary: 提交异步视频生成任务
 *     description: 异步提交视频生成任务，推荐用于长时间视频生成
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
 *                 enum: ['jimeng-video-3.5-pro', 'jimeng-video-3.5']
 *               prompt:
 *                 type: string
 *               file_paths:
 *                 type: string
 *               ratio:
 *                 type: string
 *                 enum: ['16:9', '9:16', '1:1']
 *               resolution:
 *                 type: string
 *                 enum: ['720p', '1080p']
 *               duration:
 *                 type: integer
 *                 enum: [5, 10]
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VideoGenerationRequest'
 *     responses:
 *       200:
 *         description: 任务提交成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AsyncTaskResponse'

 * /v1/async/tasks/{task_id}/status:
 *   get:
 *     tags:
 *       - Async
 *     summary: 查询任务状态
 *     description: |
 *       查询异步任务的执行状态和进度信息。
 *
 *       ## 状态说明
 *       - `pending`: 任务在队列中等待执行
 *       - `running`: 任务正在执行中
 *       - `completed`: 任务执行完成
 *       - `failed`: 任务执行失败
 *       - `cancelled`: 任务已被取消
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: task_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 任务ID
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: 任务状态查询成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/TaskStatusResponse'
 *             examples:
 *               运行中:
 *                 value:
 *                   success: true
 *                   data:
 *                     task_id: "550e8400-e29b-41d4-a716-446655440000"
 *                     type: "image_generation"
 *                     status: "running"
 *                     progress: 45
 *                     created_at: "2025-01-22T10:00:00.000Z"
 *                     updated_at: "2025-01-22T10:02:30.000Z"
 *                     started_at: "2025-01-22T10:00:05.000Z"
 *                     error: null
 *                     has_result: false
 *                     estimated_time_remaining: 180
 *               已完成:
 *                 value:
 *                   success: true
 *                   data:
 *                     task_id: "550e8400-e29b-41d4-a716-446655440000"
 *                     type: "image_generation"
 *                     status: "completed"
 *                     progress: 100
 *                     created_at: "2025-01-22T10:00:00.000Z"
 *                     updated_at: "2025-01-22T10:05:00.000Z"
 *                     has_result: true
 *       404:
 *         description: 任务不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "任务不存在"
 *               code: "TASK_NOT_FOUND"

 * /v1/async/tasks/{task_id}/result:
 *   get:
 *     tags:
 *       - Async
 *     summary: 获取任务结果
 *     description: 获取已完成的异步任务执行结果
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: task_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 任务ID
 *     responses:
 *       200:
 *         description: 获取任务结果成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       oneOf:
 *                         - $ref: '#/components/schemas/ImageResponse'
 *                         - $ref: '#/components/schemas/VideoResponse'
 *                       discriminator:
 *                         propertyName: type
 *                         mapping:
 *                           image_generation: ImageResponse
 *                           video_generation: VideoResponse
 *             examples:
 *               图片生成结果:
 *                 value:
 *                   success: true
 *                   data:
 *                     task_id: "550e8400-e29b-41d4-a716-446655440000"
 *                     status: "completed"
 *                     result:
 *                       created: 1705870400
 *                       data:
 *                         - url: "https://example.com/generated-image.jpg"
 *                     completed_at: "2025-01-22T10:05:00.000Z"
 *                     execution_time: 295000
 *       400:
 *         description: 任务尚未完成
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "任务尚未完成"
 *               code: "TASK_NOT_COMPLETED"

 * /v1/async/tasks:
 *   get:
 *     tags:
 *       - Async
 *     summary: 获取用户任务列表
 *     description: 获���当前用户的所有异步任务列表，支持状态过滤
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: ['pending', 'running', 'completed', 'failed', 'cancelled']
 *         description: 过滤特定状态的任务
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: 返回数量限制
 *     responses:
 *       200:
 *         description: 获取任务列表成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         tasks:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/TaskStatusResponse'
 *                         total:
 *                           type: integer
 *                           description: 总任务数

 * /v1/async/stats:
 *   get:
 *     tags:
 *       - Async
 *     summary: 获取系统统计信息
 *     description: 获取异步任务处理系统的统计信息
 *     responses:
 *       200:
 *         description: 获取统计信息成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         statistics:
 *                           type: object
 *                           properties:
 *                             pending:
 *                               type: integer
 *                               description: 等待中任务数
 *                             running:
 *                               type: integer
 *                               description: 运行中任务数
 *                             completed:
 *                               type: integer
 *                               description: 已完成任务数
 *                             failed:
 *                               type: integer
 *                               description: 失败任务数
 *                             cancelled:
 *                               type: integer
 *                               description: 已取消任务数
 *                         total:
 *                           type: integer
 *                           description: 总任务数
 *                         timestamp:
 *                           type: string
 *                           format: date-time
 *                           description: 统计时间戳

 * /v1/async/batch/submit:
 *   post:
 *     tags:
 *       - Async
 *     summary: 批量提交任务
 *     description: 批量提交多个异步任务，提高处理效率
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BatchSubmitRequest'
 *           examples:
 *            批量图片生成:
 *              value:
 *                tasks:
 *                  - type: "image_generation"
 *                    prompt: "风景1"
 *                    model: "jimeng-4.5"
 *                    ratio: "1:1"
 *                  - type: "image_generation"
 *                    prompt: "风景2"
 *                    model: "jimeng-4.0"
 *                    ratio: "16:9"
 *                  - type: "video_generation"
 *                    prompt: "动态视频"
 *                    duration: 5
 *     responses:
 *       200:
 *         description: 批量提交成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         submitted:
 *                           type: integer
 *                           description: 成功提交的任务数
 *                         failed:
 *                           type: integer
 *                           description: 提交失败的任务数
 *                         tasks:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               task_id:
 *                                 type: string
 *                                 description: 任务ID（成功时）
 *                               type:
 *                                 type: string
 *                                 description: 任务类型
 *                               status:
 *                                 type: string
 *                                 description: 任务状态
 *                               error:
 *                                 type: string
 *                                 description: 错误信息（失败时）

 * /v1/async/tasks/{task_id}/cancel:
 *   delete:
 *     tags:
 *       - Async
 *     summary: 取消任务
 *     description: 取消尚未执行完成的异步任务
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: task_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 任务ID
 *     responses:
 *       200:
 *         description: 任务取消成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'

 * /v1/async/tasks/{task_id}:
 *   delete:
 *     tags:
 *       - Async
 *     summary: 删除任务
 *     description: 删除已完成的任务记录
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: task_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 任务ID
 *     responses:
 *       200:
 *         description: 任务删除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'

 * /v1/async/batch/cancel:
 *   delete:
 *     tags:
 *       - Async
 *     summary: 批量取消任务
 *     description: 批量取消多个未完成的任务
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - task_ids
 *             properties:
 *               task_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: 要取消的任务ID列表
 *                 maxItems: 50
 *     responses:
 *       200:
 *         description: 批量取消结果
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         cancelled:
 *                           type: integer
 *                           description: 成功取消的任务数
 *                         failed:
 *                           type: integer
 *                           description: 取消失败的任务数
 *                         results:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               task_id:
 *                                 type: string
 *                               status:
 *                                 type: string
 *                                 enum: ['cancelled', 'failed']
 *                               error:
 *                                 type: string