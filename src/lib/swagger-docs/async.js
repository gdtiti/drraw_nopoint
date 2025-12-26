/**
 * @swagger
 * /v1/async/images/generations:
 *   post:
 *     tags:
 *       - Async
 *     summary: 异步图像生成任务
 *     description: |
 *       提交异步图像生成任务，适用于大批量或长时间处理场景。
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ImageGenerationRequest'
 *     responses:
 *       200:
 *         description: 任务提交成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AsyncTaskResponse'
 */

/**
 * @swagger
 * /v1/async/videos/generations:
 *   post:
 *     tags:
 *       - Async
 *     summary: 异步视频生成任务
 *     description: |
 *       提交异步视频生成任务，适用于大批量或长时间处理场景。
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VideoGenerationRequest'
 *     responses:
 *       200:
 *         description: 任务提交成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AsyncTaskResponse'
 */

/**
 * @swagger
 * /v1/async/tasks/{task_id}/status:
 *   get:
 *     tags:
 *       - Async
 *     summary: 查询异步任务状态
 *     description: |
 *       根据任务ID查询异步任务的执行状态和进度。
 *     parameters:
 *       - in: path
 *         name: task_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 任务ID
 *         example: "uuid-string"
 *     responses:
 *       200:
 *         description: 任务状态查询成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TaskStatusResponse'
 *       404:
 *         description: 任务不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /v1/async/tasks/{task_id}/result:
 *   get:
 *     tags:
 *       - Async
 *     summary: 获取异步任务结果
 *     description: |
 *       根据任务ID获取已完成的异步任务结果。
 *     parameters:
 *       - in: path
 *         name: task_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 任务ID
 *         example: "uuid-string"
 *     responses:
 *       200:
 *         description: 任务结果获取成功
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/ImageResponse'
 *                 - $ref: '#/components/schemas/VideoResponse'
 *       404:
 *         description: 任务不存在或未完成
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /v1/async/batch/submit:
 *   post:
 *     tags:
 *       - Async
 *     summary: 批量提交异步任务
 *     description: |
 *       一次性提交多个异步任务，支持批量处理以提高效率。
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BatchSubmitRequest'
 *     responses:
 *       200:
 *         description: 批量任务提交成功
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
 *                     task_count:
 *                       type: integer
 *                       example: 10
 *                     task_ids:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["uuid-1", "uuid-2", "uuid-3"]
 */