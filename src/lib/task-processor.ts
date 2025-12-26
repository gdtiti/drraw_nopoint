import logger from '@/lib/logger.ts';
import taskManager, { Task, TaskStatus, TaskType, TaskManager } from '@/lib/task-manager.ts';
import { generateImages } from '@/api/controllers/images.ts';
import { generateImageComposition } from '@/api/controllers/images.ts';
import { generateVideo } from '@/api/controllers/videos.ts';
import util from '@/lib/util.ts';

// 从环境变量读取最大并发任务数，默认10
const MAX_CONCURRENT_TASKS = parseInt(process.env.TASK_MAX_CONCURRENT || '10', 10);

/**
 * 任务处理器
 * 负责执行具体的异步任务
 */
export class TaskProcessor {
  private maxConcurrentTasks = MAX_CONCURRENT_TASKS;
  private runningTasks = new Set<string>();

  constructor() {
    this.startProcessing();
  }

  /**
   * 启动任务处理器
   */
  private startProcessing(): void {
    logger.info(`TaskProcessor 启动，最大并发数: ${this.maxConcurrentTasks} (环境变量: TASK_MAX_CONCURRENT)`);
    // 每1秒检查一次待处理任务
    setInterval(() => {
      this.processPendingTasks();
    }, 1000);
  }

  /**
   * 处理待执行任务
   */
  private async processPendingTasks(): Promise<void> {
    // 获取待执行任务
    const pendingTasks = taskManager.getPendingTasks();

    // 如果有待处理任务，记录日志
    if (pendingTasks.length > 0) {
      logger.debug(`TaskProcessor 发现 ${pendingTasks.length} 个待处理任务`);
    }

    // 如果已达到并发限制，跳过本次处理
    if (this.runningTasks.size >= this.maxConcurrentTasks) {
      if (pendingTasks.length > 0) {
        logger.debug(`TaskProcessor 已达到并发限制 (${this.runningTasks.size}/${this.maxConcurrentTasks})`);
      }
      return;
    }

    // 过滤出不在执行列表中的任务
    const availableTasks = pendingTasks.filter(
      task => !this.runningTasks.has(task.id)
    );

    if (availableTasks.length === 0) {
      return;
    }

    logger.info(`TaskProcessor 准备启动 ${availableTasks.length} 个任务`);

    // 计算可以启动的任务数
    const slotsAvailable = this.maxConcurrentTasks - this.runningTasks.size;
    const tasksToStart = availableTasks.slice(0, slotsAvailable);

    for (const task of tasksToStart) {
      this.runningTasks.add(task.id);
      logger.info(`TaskProcessor 将任务加入执行队列: ${task.id}`);
      this.executeTask(task).catch(error => {
        logger.error(`任务执行异常: ${task.id}, ${error.message}`);
      });
    }
  }

  /**
   * 执行具体任务
   */
  private async executeTask(task: Task): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info(`开始执行任务: ${task.id} (${task.type})`);

      // 更新任务状态为运行中
      taskManager.updateTaskStatus(task.id, TaskStatus.RUNNING);

      // 设置任务超时（图片生成15分钟，视频生成30分钟）
      const timeoutMs = task.type === TaskType.VIDEO_GENERATION ? 30 * 60 * 1000 : 15 * 60 * 1000;
      taskManager.setTaskTimeout(task.id, timeoutMs);

      let result: any;

      switch (task.type) {
        case TaskType.IMAGE_GENERATION:
          result = await this.processImageGeneration(task);
          break;

        case TaskType.IMAGE_COMPOSITION:
          result = await this.processImageComposition(task);
          break;

        case TaskType.VIDEO_GENERATION:
          result = await this.processVideoGeneration(task);
          break;

        default:
          throw new Error(`不支持的任务类型: ${task.type}`);
      }

      // 更新进度
      taskManager.updateTaskStatus(task.id, TaskStatus.RUNNING, { progress: 90 });

      // 任务完成
      const executionTime = Date.now() - startTime;
      logger.info(`任务执行完成: ${task.id}, 耗时: ${executionTime}ms`);

      taskManager.updateTaskStatus(task.id, TaskStatus.COMPLETED, { result });

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`任务执行失败: ${task.id}, 耗时: ${executionTime}ms, 错误: ${errorMessage}`);

      taskManager.updateTaskStatus(task.id, TaskStatus.FAILED, { error: errorMessage });

    } finally {
      // 从运行列表中移除
      this.runningTasks.delete(task.id);
    }
  }

  /**
   * 处理图片生成任务
   */
  private async processImageGeneration(task: Task): Promise<any> {
    const { model, prompt, negative_prompt, ratio, resolution, intelligent_ratio, sample_strength, response_format, token } = task.params;

    // 设置进度
    taskManager.updateTaskStatus(task.id, TaskStatus.RUNNING, { progress: 10 });

    const result = await generateImages(
      model,
      prompt,
      negative_prompt,
      ratio,
      resolution,
      intelligent_ratio,
      sample_strength,
      response_format,
      token,
      // 进度回调
      (progress) => {
        taskManager.updateTaskStatus(task.id, TaskStatus.RUNNING, { progress });
      }
    );

    return result;
  }

  /**
   * 处理图片合成任务
   */
  private async processImageComposition(task: Task): Promise<any> {
    const { model, prompt, images, ratio, resolution, sample_strength, token } = task.params;

    // 设置进度
    taskManager.updateTaskStatus(task.id, TaskStatus.RUNNING, { progress: 10 });

    const result = await generateImageComposition(
      model,
      prompt,
      images,
      {
        ratio: ratio || '1:1',
        resolution: resolution || '2k',
        sampleStrength: sample_strength || 0.5,
      },
      token,
      task.params.sessionId
    );

    return result;
  }

  /**
   * 处理视频生成任务
   */
  private async processVideoGeneration(task: Task): Promise<any> {
    const { model, prompt, filePaths, ratio, resolution, duration, token } = task.params;

    // 设置进度
    taskManager.updateTaskStatus(task.id, TaskStatus.RUNNING, { progress: 10 });

    const result = await generateVideo(
      model,
      prompt,
      filePaths || [],
      {
        ratio: ratio || '16:9',
        resolution: resolution || '1080p',
        duration: duration || 5,
      },
      token
    );

    return result;
  }

  /**
   * 获取处理器状态
   */
  getStatus(): { currentTasks: number; maxConcurrentTasks: number; runningTaskIds: string[] } {
    return {
      currentTasks: this.runningTasks.size,
      maxConcurrentTasks: this.maxConcurrentTasks,
      runningTaskIds: Array.from(this.runningTasks)
    };
  }

  /**
   * 设置最大并发任务数
   */
  setMaxConcurrentTasks(max: number): void {
    this.maxConcurrentTasks = Math.max(1, Math.min(10, max));
    logger.info(`设置最大并发任务数: ${this.maxConcurrentTasks}`);
  }
}

// 导出单例实例
// 注意：此模块被导入时会自动创建实例并启动任务处理器
export const taskProcessor = new TaskProcessor();

// 确保模块被加载时输出日志（用于调试）
logger.info('TaskProcessor 模块已加载');