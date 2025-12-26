import _ from 'lodash';
import Request from '@/lib/request/Request.ts';
import logger from '@/lib/logger.ts';
import {
  submitImageGenerationTask,
  submitImageCompositionTask,
  submitVideoGenerationTask,
  getTaskStatus,
  getTaskResult,
  cancelTask,
  getUserTasks,
  getTaskStats,
  deleteTask
} from '@/api/controllers/async.ts';
import { taskProcessor } from '@/lib/task-processor.ts';

export default {
  prefix: '/v1/async',

  post: {
    // 异步图片生成
    '/images/generations': async (request: Request) => {
      // 参数验证
      request
        .validate('body.model', v => _.isUndefined(v) || _.isString(v))
        .validate('body.prompt', _.isString)
        .validate('body.negative_prompt', v => _.isUndefined(v) || _.isString(v))
        .validate('body.ratio', v => _.isUndefined(v) || _.isString(v))
        .validate('body.resolution', v => _.isUndefined(v) || _.isString(v))
        .validate('body.intelligent_ratio', v => _.isUndefined(v) || _.isBoolean(v))
        .validate('body.sample_strength', v => _.isUndefined(v) || _.isFinite(v))
        .validate('body.response_format', v => _.isUndefined(v) || _.isString(v))
        .validate('headers.authorization', _.isString);

      logger.info(`[Async] 收到图片生成任务请求`);

      const result = await submitImageGenerationTask(request);

      return {
        success: true,
        data: result
      };
    },

    // 异步图片合成
    '/images/compositions': async (request: Request) => {
      const contentType = request.headers['content-type'] || '';
      const isMultiPart = contentType.startsWith('multipart/form-data');

      // 处理 multipart 数据中的 images（可能是JSON字符串）
      let images = request.body.images;
      if (isMultiPart && typeof images === 'string') {
        try {
          images = JSON.parse(images);
        } catch (e) {
          logger.error(`解析images JSON字符串失败: ${e.message}`);
        }
      }

      request
        .validate('body.model', v => _.isUndefined(v) || _.isString(v))
        .validate('body.prompt', _.isString)
        .validate('body.images', v => {
          // 支持数组和JSON字符串格式
          if (isMultiPart && typeof v === 'string') {
            try {
              const parsed = JSON.parse(v);
              return _.isArray(parsed) && parsed.length > 0;
            } catch (e) {
              return false;
            }
          }
          return _.isArray(v) && v.length > 0;
        })
        .validate('body.ratio', v => _.isUndefined(v) || _.isString(v))
        .validate('body.resolution', v => _.isUndefined(v) || _.isString(v))
        .validate('body.sample_strength', v => _.isUndefined(v) || _.isFinite(v))
        .validate('body.response_format', v => _.isUndefined(v) || _.isString(v))
        .validate('headers.authorization', _.isString);

      // 创建处理后的请求对象，确保images是数组格式
      const processedRequest = {
        ...request,
        body: {
          ...request.body,
          images: images
        }
      };

      logger.info(`[Async] 收到图片合成任务请求，图片数量: ${images?.length || 0}`);

      const result = await submitImageCompositionTask(processedRequest);

      return {
        success: true,
        data: result
      };
    },

    // 异步视频生成
    '/videos/generations': async (request: Request) => {
      const contentType = request.headers['content-type'] || '';
      const isMultiPart = contentType.startsWith('multipart/form-data');

      request
        .validate('body.model', v => _.isUndefined(v) || _.isString(v))
        .validate('body.prompt', _.isString)
        .validate('body.file_paths', v => {
          if (_.isUndefined(v)) return true;
          if (isMultiPart && typeof v === 'string') {
            return JSON.parse(v).length >= 0;
          }
          return _.isArray(v) && v.length >= 0;
        })
        .validate('body.ratio', v => _.isUndefined(v) || _.isString(v))
        .validate('body.resolution', v => _.isUndefined(v) || _.isString(v))
        .validate('body.duration', v => {
          if (_.isUndefined(v)) return true;
          if (isMultiPart && typeof v === 'string') {
            const num = parseInt(v);
            return num === 5 || num === 10;
          }
          return v === 5 || v === 10;
        })
        .validate('headers.authorization', _.isString);

      // 处理 multipart 数据中的 file_paths
      let filePaths = request.body.file_paths;
      if (isMultiPart && typeof filePaths === 'string') {
        filePaths = JSON.parse(filePaths);
      }

      const processedRequest = {
        ...request,
        body: {
          ...request.body,
          file_paths: filePaths
        }
      };

      logger.info(`[Async] 收到视频生成任务请求，文件路径数量: ${filePaths?.length || 0}`);

      const result = await submitVideoGenerationTask(processedRequest);

      return {
        success: true,
        data: result
      };
    },

    // 批量任务提交
    '/batch/submit': async (request: Request) => {
      request
        .validate('body.tasks', v => _.isArray(v) && v.length > 0)
        .validate('body.tasks.*.type', v => ['image_generation', 'image_composition', 'video_generation'].includes(v))
        .validate('headers.authorization', _.isString);

      const { tasks } = request.body;
      const submittedTasks = [];

      logger.info(`[Async] 收到批量任务提交请求，任务数量: ${tasks.length}`);

      for (const taskRequest of tasks) {
        try {
          let result;

          switch (taskRequest.type) {
            case 'image_generation':
              result = await submitImageGenerationTask({ ...request, body: taskRequest });
              break;
            case 'image_composition':
              result = await submitImageCompositionTask({ ...request, body: taskRequest });
              break;
            case 'video_generation':
              result = await submitVideoGenerationTask({ ...request, body: taskRequest });
              break;
          }

          submittedTasks.push({
            task_id: result.task_id,
            type: taskRequest.type,
            status: result.status
          });

        } catch (error) {
          submittedTasks.push({
            type: taskRequest.type,
            error: error instanceof Error ? error.message : '提交失败'
          });
        }
      }

      return {
        success: true,
        data: {
          submitted: submittedTasks.filter(t => !t.error).length,
          failed: submittedTasks.filter(t => t.error).length,
          tasks: submittedTasks
        }
      };
    }
  },

  get: {
    // 获取任务状态
    '/tasks/:task_id/status': async (request: Request) => {
      const result = await getTaskStatus(request);

      return {
        success: true,
        data: result
      };
    },

    // 获取任务结果
    '/tasks/:task_id/result': async (request: Request) => {
      const result = await getTaskResult(request);

      return {
        success: true,
        data: result
      };
    },

    // 获取用户任务列表
    '/tasks': async (request: Request) => {
      const result = await getUserTasks(request);

      return {
        success: true,
        data: result
      };
    },

    // 获取系统统计
    '/stats': async () => {
      const result = await getTaskStats();

      return {
        success: true,
        data: result
      };
    },

    // 获取处理器状态（调试用）
    '/processor/status': async () => {
      const processorStatus = taskProcessor.getStatus();

      return {
        success: true,
        data: processorStatus
      };
    }
  },

  delete: {
    // 取消任务
    '/tasks/:task_id/cancel': async (request: Request) => {
      const result = await cancelTask(request);

      return {
        success: true,
        data: result
      };
    },

    // 删除任务
    '/tasks/:task_id': async (request: Request) => {
      const result = await deleteTask(request);

      return {
        success: true,
        data: result
      };
    },

    // 批量取消任务
    '/batch/cancel': async (request: Request) => {
      request
        .validate('body.task_ids', v => _.isArray(v) && v.length > 0);

      const { task_ids } = request.body;
      const results = [];

      for (const taskId of task_ids) {
        try {
          await cancelTask({ ...request, params: { task_id: taskId } });
          results.push({ task_id: taskId, status: 'cancelled' });
        } catch (error) {
          results.push({
            task_id: taskId,
            status: 'failed',
            error: error instanceof Error ? error.message : '取消失败'
          });
        }
      }

      return {
        success: true,
        data: {
          cancelled: results.filter(r => r.status === 'cancelled').length,
          failed: results.filter(r => r.status === 'failed').length,
          results
        }
      };
    }
  }
};