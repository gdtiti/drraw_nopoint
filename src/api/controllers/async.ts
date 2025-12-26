import _ from 'lodash';
import taskManager, { TaskType, TaskStatus, TaskPriority } from '@/lib/task-manager.ts';
import { tokenSplit } from '@/api/controllers/core.ts';
import logger from '@/lib/logger.ts';
import APIException from '@/lib/exceptions/APIException.ts';
import EX from '@/api/consts/exceptions.ts';

/**
 * 提交异步图片生成任务
 */
export async function submitImageGenerationTask(request: any) {
  const {
    model,
    prompt,
    negative_prompt,
    ratio,
    resolution,
    intelligent_ratio,
    sample_strength,
    response_format
  } = request.body;

  // 提取用户标识（从token中）
  const tokens = tokenSplit(request.headers.authorization);
  const token = _.sample(tokens);

  // 创建任务
  const task = taskManager.createTask(
    TaskType.IMAGE_GENERATION,
    {
      model,
      prompt,
      negative_prompt,
      ratio,
      resolution,
      intelligent_ratio,
      sample_strength,
      response_format,
      token
    },
    TaskPriority.NORMAL
  );

  // 保存用户信息（可选）
  task.userId = request.body.user_id || request.headers['x-user-id'];
  task.token = token;

  logger.info(`提交异步图片生成任务: ${task.id}`);

  return {
    task_id: task.id,
    status: task.status,
    created_at: task.createdAt.toISOString(),
    message: '任务已提交，请使用task_id查询进度和结果'
  };
}

/**
 * 提交异步图片合成任务
 */
export async function submitImageCompositionTask(request: any) {
  const {
    model,
    prompt,
    images,
    ratio,
    resolution,
    sample_strength,
    response_format
  } = request.body;

  const tokens = tokenSplit(request.headers.authorization);
  const token = _.sample(tokens);

  const task = taskManager.createTask(
    TaskType.IMAGE_COMPOSITION,
    {
      model,
      prompt,
      images,
      ratio,
      resolution,
      sample_strength,
      response_format,
      token
    },
    TaskPriority.NORMAL
  );

  task.userId = request.body.user_id || request.headers['x-user-id'];
  task.token = token;

  logger.info(`提交异步图片合成任务: ${task.id}`);

  return {
    task_id: task.id,
    status: task.status,
    created_at: task.createdAt.toISOString(),
    message: '任务已提交，请使用task_id查询进度和结果'
  };
}

/**
 * 提交异步视频生成任务
 */
export async function submitVideoGenerationTask(request: any) {
  const {
    model,
    prompt,
    file_paths,
    ratio,
    resolution,
    duration
  } = request.body;

  const tokens = tokenSplit(request.headers.authorization);
  const token = _.sample(tokens);

  // 视频生成任务优先级较高
  const task = taskManager.createTask(
    TaskType.VIDEO_GENERATION,
    {
      model,
      prompt,
      filePaths: file_paths,
      ratio,
      resolution,
      duration,
      token
    },
    TaskPriority.HIGH
  );

  task.userId = request.body.user_id || request.headers['x-user-id'];
  task.token = token;

  logger.info(`提交异步视频生成任务: ${task.id}`);

  return {
    task_id: task.id,
    status: task.status,
    created_at: task.createdAt.toISOString(),
    message: '任务已提交，请使用task_id查询进度和结果'
  };
}

/**
 * 获取任务状态
 */
export async function getTaskStatus(request: any) {
  const { task_id } = request.params;

  if (!task_id) {
    throw new APIException(EX.API_REQUEST_PARAMS_INVALID, 'task_id 参数是必需的');
  }

  const task = taskManager.getTask(task_id);
  if (!task) {
    throw new APIException(EX.API_TASK_NOT_FOUND, `任务不存在: ${task_id}`);
  }

  return {
    task_id: task.id,
    type: task.type,
    status: task.status,
    progress: task.progress || 0,
    created_at: task.createdAt.toISOString(),
    updated_at: task.updatedAt.toISOString(),
    started_at: task.startedAt?.toISOString(),
    completed_at: task.completedAt?.toISOString(),
    error: task.error,
    // 任务完成时返回结果预览（不包含实际数据）
    has_result: !!task.result,
    estimated_time_remaining: estimateTimeRemaining(task)
  };
}

/**
 * 获取任务结果
 */
export async function getTaskResult(request: any) {
  const { task_id } = request.params;

  if (!task_id) {
    throw new APIException(EX.API_REQUEST_PARAMS_INVALID, 'task_id 参数是必需的');
  }

  const task = taskManager.getTask(task_id);
  if (!task) {
    throw new APIException(EX.API_TASK_NOT_FOUND, `任务不存在: ${task_id}`);
  }

  if (task.status === TaskStatus.PENDING || task.status === TaskStatus.RUNNING) {
    throw new APIException(EX.API_TASK_NOT_COMPLETED, `任务尚未完成，当前状态: ${task.status}`);
  }

  if (task.status === TaskStatus.FAILED) {
    return {
      task_id: task.id,
      status: task.status,
      error: task.error,
      completed_at: task.completedAt?.toISOString()
    };
  }

  return {
    task_id: task.id,
    status: task.status,
    result: task.result,
    completed_at: task.completedAt?.toISOString(),
    execution_time: task.completedAt && task.startedAt
      ? task.completedAt.getTime() - task.startedAt.getTime()
      : null
  };
}

/**
 * 取消任务
 */
export async function cancelTask(request: any) {
  const { task_id } = request.params;

  if (!task_id) {
    throw new APIException(EX.API_REQUEST_PARAMS_INVALID, 'task_id 参数是必需的');
  }

  const task = taskManager.getTask(task_id);
  if (!task) {
    throw new APIException(EX.API_TASK_NOT_FOUND, `任务不存在: ${task_id}`);
  }

  if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) {
    throw new APIException(EX.API_TASK_CANCEL_FAILED, `任务已完成，无法取消，当前状态: ${task.status}`);
  }

  const success = taskManager.cancelTask(task_id);
  if (!success) {
    throw new APIException(EX.API_TASK_CANCEL_FAILED, `无法取消任务: ${task_id}`);
  }

  logger.info(`取消任务: ${task_id}`);

  return {
    task_id: task.id,
    status: task.status,
    message: '任务已取消'
  };
}

/**
 * 获取用户任务列表
 */
export async function getUserTasks(request: any) {
  const { status, limit = 20 } = request.query;
  const userId = request.body.user_id || request.headers['x-user-id'];

  const tasks = taskManager.getUserTasks(
    userId,
    status as TaskStatus,
    parseInt(limit as string)
  );

  return {
    tasks: tasks.map(task => ({
      task_id: task.id,
      type: task.type,
      status: task.status,
      progress: task.progress || 0,
      created_at: task.createdAt.toISOString(),
      updated_at: task.updatedAt.toISOString(),
      has_result: !!task.result,
      error: task.error
    })),
    total: tasks.length,
    status
  };
}

/**
 * 获取系统任务统计
 */
export async function getTaskStats() {
  const stats = taskManager.getTaskStats();

  return {
    statistics: stats,
    total: Object.values(stats).reduce((sum, count) => sum + count, 0),
    timestamp: new Date().toISOString()
  };
}

/**
 * 删除任务
 */
export async function deleteTask(request: any) {
  const { task_id } = request.params;

  if (!task_id) {
    throw new APIException(EX.API_REQUEST_PARAMS_INVALID, 'task_id 参数是必需的');
  }

  const task = taskManager.getTask(task_id);
  if (!task) {
    throw new APIException(EX.API_TASK_NOT_FOUND, `任务不存在: ${task_id}`);
  }

  // 只有已完成、失败或取消的任务可以删除
  if (task.status === TaskStatus.PENDING || task.status === TaskStatus.RUNNING) {
    throw new APIException(EX.API_TASK_DELETE_FAILED, `运行中的任务无法删除，请先取消任务，当前状态: ${task.status}`);
  }

  const success = taskManager.deleteTask(task_id);
  if (!success) {
    throw new APIException(EX.API_TASK_DELETE_FAILED, `无法删除任务: ${task_id}`);
  }

  logger.info(`删除任务: ${task_id}`);

  return {
    task_id: task.id,
    message: '任务已删除'
  };
}

/**
 * 估算剩余时间（简单估算）
 */
function estimateTimeRemaining(task: any): number | null {
  if (task.status !== TaskStatus.RUNNING || !task.startedAt) {
    return null;
  }

  const elapsed = Date.now() - task.startedAt.getTime();
  const progress = task.progress || 0;

  if (progress <= 0) {
    return null;
  }

  // 简单的线性估算
  const estimatedTotal = elapsed / (progress / 100);
  const remaining = Math.max(0, estimatedTotal - elapsed);

  return Math.round(remaining / 1000); // 返回秒数
}