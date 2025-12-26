import { v4 as uuidv4 } from 'uuid';
import logger from '@/lib/logger.ts';

/**
 * 任务类型枚举
 */
export enum TaskType {
  IMAGE_GENERATION = 'image_generation',
  IMAGE_COMPOSITION = 'image_composition',
  VIDEO_GENERATION = 'video_generation'
}

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  PENDING = 'pending',      // 等待中
  RUNNING = 'running',      // 运行中
  COMPLETED = 'completed',  // 已完成
  FAILED = 'failed',        // 失败
  CANCELLED = 'cancelled'   // 已取消
}

/**
 * 任务优先级
 */
export enum TaskPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 10
}

/**
 * 任务接口
 */
export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  params: any;
  result?: any;
  error?: string;
  progress?: number;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  userId?: string;
  token?: string;
}

/**
 * 任务管理器
 * 负责任务的创建、更新、查询和清理
 */
export class TaskManager {
  private tasks = new Map<string, Task>();
  private taskTimeouts = new Map<string, NodeJS.Timeout>();
  private static instance: TaskManager;

  constructor() {
    // 启动任务清理定时器
    setInterval(() => {
      this.cleanupExpiredTasks();
    }, 5 * 60 * 1000); // 每5分钟清理一次
  }

  static getInstance(): TaskManager {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager();
    }
    return TaskManager.instance;
  }

  /**
   * 创建新任务
   */
  createTask(type: TaskType, params: any, priority: TaskPriority = TaskPriority.NORMAL): Task {
    const task: Task = {
      id: uuidv4(),
      type,
      status: TaskStatus.PENDING,
      priority,
      params,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.tasks.set(task.id, task);
    logger.info(`创建任务: ${task.id} (类型: ${type}, 优先级: ${priority})`);

    return task;
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 更新任务状态
   */
  updateTaskStatus(taskId: string, status: TaskStatus, extra?: { result?: any; error?: string; progress?: number }): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      logger.warn(`任务不存在: ${taskId}`);
      return false;
    }

    task.status = status;
    task.updatedAt = new Date();

    if (extra?.result) task.result = extra.result;
    if (extra?.error) task.error = extra.error;
    if (extra?.progress !== undefined) task.progress = extra.progress;

    // 状态变更时间记录
    if (status === TaskStatus.RUNNING && !task.startedAt) {
      task.startedAt = new Date();
    }
    if (status === TaskStatus.COMPLETED || status === TaskStatus.FAILED) {
      task.completedAt = new Date();
      // 清除超时定时器
      const timeout = this.taskTimeouts.get(taskId);
      if (timeout) {
        clearTimeout(timeout);
        this.taskTimeouts.delete(taskId);
      }
    }

    logger.info(`任务状态更新: ${taskId} -> ${status}`);
    return true;
  }

  /**
   * 获取用户的任务列表
   */
  getUserTasks(userId?: string, status?: TaskStatus, limit = 50): Task[] {
    let tasks = Array.from(this.tasks.values());

    if (userId) {
      tasks = tasks.filter(task => task.userId === userId);
    }

    if (status) {
      tasks = tasks.filter(task => task.status === status);
    }

    // 按创建时间倒序排列
    tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return tasks.slice(0, limit);
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) {
      return false; // 已完成的任务无法取消
    }

    return this.updateTaskStatus(taskId, TaskStatus.CANCELLED);
  }

  /**
   * 设置任务超时
   */
  setTaskTimeout(taskId: string, timeoutMs: number): void {
    const timeout = setTimeout(() => {
      this.updateTaskStatus(taskId, TaskStatus.FAILED, { error: '任务执行超时' });
    }, timeoutMs);

    this.taskTimeouts.set(taskId, timeout);
  }

  /**
   * 获取待执行的任务（按优先级排序）
   */
  getPendingTasks(): Task[] {
    return Array.from(this.tasks.values())
      .filter(task => task.status === TaskStatus.PENDING)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * 获取任务统计信息
   */
  getTaskStats(): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const status of Object.values(TaskStatus)) {
      stats[status] = 0;
    }

    for (const task of this.tasks.values()) {
      stats[task.status] = (stats[task.status] || 0) + 1;
    }

    return stats;
  }

  /**
   * 清理过期任务（保留最近24小时的已完成/失败任务）
   */
  private cleanupExpiredTasks(): void {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [taskId, task] of this.tasks.entries()) {
      // 清理24小时前的已完成/失败任务
      if (
        (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED || task.status === TaskStatus.CANCELLED) &&
        task.updatedAt < oneDayAgo
      ) {
        this.tasks.delete(taskId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`清理过期任务: ${cleanedCount} 个`);
    }
  }

  /**
   * 删除任务
   */
  deleteTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    // 清理超时定时器
    const timeout = this.taskTimeouts.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      this.taskTimeouts.delete(taskId);
    }

    this.tasks.delete(taskId);
    logger.info(`删除任务: ${taskId}`);
    return true;
  }
}

// 导出单例实例
export default TaskManager.getInstance();