import _ from "lodash";

import APIException from "@/lib/exceptions/APIException.ts";
import EX from "@/api/consts/exceptions.ts";
import util from "@/lib/util.ts";
import { request, parseRegionFromToken, getAssistantId, RegionInfo } from "./core.ts";
import logger from "@/lib/logger.ts";
import { SmartPoller, PollingStatus } from "@/lib/smart-poller.ts";
import { DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_MODEL_US, IMAGE_MODEL_MAP, IMAGE_MODEL_MAP_US } from "@/api/consts/common.ts";
import { uploadImageFromUrl, uploadImageBuffer } from "@/lib/image-uploader.ts";
import { extractImageUrls } from "@/lib/image-utils.ts";
import {
  resolveResolution,
  getBenefitCount,
  buildCoreParam,
  buildMetricsExtra,
  buildDraftContent,
  buildGenerateRequest,
  buildBlendAbilityList,
  buildPromptPlaceholderList,
  ResolutionResult,
} from "@/api/builders/payload-builder.ts";
import { sessionUsageDB } from "@/lib/database/session-usage-memory.ts";
import crypto from "crypto";

export const DEFAULT_MODEL = DEFAULT_IMAGE_MODEL;
export const DEFAULT_MODEL_US = DEFAULT_IMAGE_MODEL_US;

export interface ModelResult {
  model: string;
  userModel: string;
}

/**
 * Create a consistent session_id from refresh_token
 */
function createSessionIdFromToken(token: string): string {
  // 使用 MD5 确保哈希唯一性，避免不同 token 碰撞导致 session_id 相同
  const hash = crypto.createHash('md5').update(token).digest('hex');
  return `session_${hash.substring(0, 16)}`;
}

/**
 * 获取模型映射
 * - 国际站不支持的模型会抛出错误
 * - 但如果传入的是国内站默认模型，国际站会自动回退到国际站默认模型
 */
export function getModel(model: string, isInternational: boolean): ModelResult {
  const modelMap = isInternational ? IMAGE_MODEL_MAP_US : IMAGE_MODEL_MAP;
  const defaultModel = isInternational ? DEFAULT_MODEL_US : DEFAULT_MODEL;

  if (isInternational && !modelMap[model]) {
    // 如果传入的是国内站默认模型，回退到国际站默认模型
    if (model === DEFAULT_MODEL) {
      logger.info(`国际站不支持默认模型 "${model}"，回退到 "${defaultModel}"`);
      return { model: modelMap[defaultModel], userModel: defaultModel };
    }
    const supportedModels = Object.keys(modelMap).join(', ');
    throw new Error(`国际版不支持模型 "${model}"。支持的模型: ${supportedModels}`);
  }

  const effectiveUserModel = modelMap[model] ? model : defaultModel;
  return { model: modelMap[effectiveUserModel], userModel: effectiveUserModel };
}

/**
 * 记录分辨率信息
 */
function logResolutionInfo(userModel: string, resolution: ResolutionResult, regionInfo: RegionInfo) {
  if (!resolution.isForced) return;
/*
  if (userModel === 'nanobanana') {
    if (regionInfo.isUS) {
      logger.warn('美区 nanobanana 模型固定使用1024x1024分辨率和2k的清晰度，比例固定为1:1。');
    } else if (regionInfo.isHK || regionInfo.isJP || regionInfo.isSG) {
      const regionName = regionInfo.isHK ? '香港' : regionInfo.isJP ? '日本' : '新加坡';
      logger.warn(`${regionName}站 nanobanana 模型固定使用1k清晰度。`);
    }
  }
    */
}

/**
 * 图生图
 */
export async function generateImageComposition(
  _model: string,
  prompt: string,
  images: (string | Buffer)[],
  {
    ratio = '1:1',
    resolution = '2k',
    sampleStrength = 0.5,
    negativePrompt = "",
    intelligentRatio = false,
  }: {
    ratio?: string;
    resolution?: string;
    sampleStrength?: number;
    negativePrompt?: string;
    intelligentRatio?: boolean;
  },
  refreshToken: string,
  sessionId?: string
) {
  if (typeof prompt !== 'string') {
    logger.error(`图生图提示词类型错误: ${typeof prompt}, 期望string类型`);
    throw new APIException(EX.API_REQUEST_PARAMS_INVALID, "提示词必须是字符串类型");
  }

  if (!images || images.length === 0) {
    logger.error('图生图缺少输入图片');
    throw new APIException(EX.API_REQUEST_PARAMS_INVALID, "图生图至少需要1张输入图片");
  }

  const regionInfo = parseRegionFromToken(refreshToken);
  const { model, userModel } = getModel(_model, regionInfo.isInternational);

  // 生成session_id（如果未提供）
  const effectiveSessionId = sessionId || createSessionIdFromToken(refreshToken);

  // 检查每日使用限制
  const usageCheck = await sessionUsageDB.checkUsageLimit(effectiveSessionId, 'image');
  if (!usageCheck.allowed) {
    throw new APIException(EX.API_IMAGE_GENERATION_FAILED,
      `今日图片生成次数已达上限 (${usageCheck.current}/${usageCheck.limit})。请明天再试。`);
  }

  // 使用 payload-builder 处理分辨率
  const resolutionResult = resolveResolution(userModel, regionInfo, resolution, ratio);
  logResolutionInfo(userModel, resolutionResult, regionInfo);

  const imageCount = images.length;
  logger.info(`使用模型: ${userModel} 映射模型: ${model} 图生图功能 ${imageCount}张图片 ${resolutionResult.width}x${resolutionResult.height} 精细度: ${sampleStrength}`);

  // 积分系统已移除，改为基于sessionID的使用次数限制

  // 上传图片
  const uploadedImageIds: string[] = [];
  for (let i = 0; i < images.length; i++) {
    try {
      const image = images[i];
      let imageId: string;
      if (typeof image === 'string') {
        logger.info(`正在处理第 ${i + 1}/${imageCount} 张图片 (URL)...`);
        imageId = await uploadImageFromUrl(image, refreshToken, regionInfo);
      } else {
        logger.info(`正在处理第 ${i + 1}/${imageCount} 张图片 (Buffer)...`);
        imageId = await uploadImageBuffer(image, refreshToken, regionInfo);
      }
      uploadedImageIds.push(imageId);
      logger.info(`图片 ${i + 1}/${imageCount} 上传成功: ${imageId}`);

      // 多图片上传时添加间隔，避免服务器压力
      if (i < imageCount - 1) {
        logger.info(`等待 2 秒后上传下一张图片...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      logger.error(`图片 ${i + 1}/${imageCount} 上传失败: ${error.message}`);
      throw new APIException(EX.API_IMAGE_GENERATION_FAILED, `图片上传失败: ${error.message}`);
    }
  }

  logger.info(`所有图片上传完成，开始图生图: ${uploadedImageIds.join(', ')}`);

  const componentId = util.uuid();
  const submitId = util.uuid();

  // 使用 payload-builder 构建 core_param
  const coreParam = buildCoreParam({
    userModel,
    model,
    prompt,
    imageCount,
    sampleStrength,
    resolution: resolutionResult,
    intelligentRatio,
    mode: "img2img",
  });

  // 构建 metrics_extra 中的 abilityList
  const metricsAbilityList = uploadedImageIds.map(() => ({
    abilityName: "byte_edit",
    strength: sampleStrength,
    source: {
      imageUrl: `blob:https://dreamina.capcut.com/${util.uuid()}`
    }
  }));

  // 使用 payload-builder 构建 metrics_extra
  const metricsExtra = buildMetricsExtra({
    userModel,
    regionInfo,
    submitId,
    scene: "ImageBasicGenerate",
    resolutionType: resolutionResult.resolutionType,
    abilityList: metricsAbilityList,
  });

  // 使用 payload-builder 构建 draft_content
  const abilityList = buildBlendAbilityList(uploadedImageIds, sampleStrength);
  const promptPlaceholderInfoList = buildPromptPlaceholderList(uploadedImageIds.length);
  const posteditParam = {
    type: "",
    id: util.uuid(),
    generate_type: 0
  };

  const draftContent = buildDraftContent({
    componentId,
    generateType: "blend",
    coreParam,
    abilityList,
    promptPlaceholderInfoList,
    posteditParam,
    imageCount,
  });

  // 使用 payload-builder 构建完整请求
  const requestData = buildGenerateRequest({
    model,
    regionInfo,
    submitId,
    draftContent,
    metricsExtra,
  });

  const { aigc_data } = await request(
    "post",
    "/mweb/v1/aigc_draft/generate",
    refreshToken,
    { data: requestData }
  );

  const historyId = aigc_data?.history_record_id;
  if (!historyId)
    throw new APIException(EX.API_IMAGE_GENERATION_FAILED, "记录ID不存在");

  logger.info(`图生图任务已提交，history_id: ${historyId}，等待生成完成...`);

  // 轮询结果
  const poller = new SmartPoller({
    maxPollCount: 900,
    expectedItemCount: 1,
    type: 'image'
  });

  const { result: pollingResult, data: finalTaskInfo } = await poller.poll(async () => {
    const response = await request("post", "/mweb/v1/get_history_by_ids", refreshToken, {
      data: {
        history_ids: [historyId],
        image_info: {
          width: 2048,
          height: 2048,
          format: "webp",
          image_scene_list: [
            { scene: "smart_crop", width: 360, height: 360, uniq_key: "smart_crop-w:360-h:360", format: "webp" },
            { scene: "smart_crop", width: 480, height: 480, uniq_key: "smart_crop-w:480-h:480", format: "webp" },
            { scene: "smart_crop", width: 720, height: 720, uniq_key: "smart_crop-w:720-h:720", format: "webp" },
            { scene: "smart_crop", width: 720, height: 480, uniq_key: "smart_crop-w:720-h:480", format: "webp" },
            { scene: "normal", width: 2400, height: 2400, uniq_key: "2400", format: "webp" },
            { scene: "normal", width: 1080, height: 1080, uniq_key: "1080", format: "webp" },
            { scene: "normal", width: 720, height: 720, uniq_key: "720", format: "webp" },
            { scene: "normal", width: 480, height: 480, uniq_key: "480", format: "webp" },
            { scene: "normal", width: 360, height: 360, uniq_key: "360", format: "webp" }
          ]
        }
      }
    });

    if (!response[historyId]) {
      logger.error(`历史记录不存在: historyId=${historyId}`);
      throw new APIException(EX.API_IMAGE_GENERATION_FAILED, "记录不存在");
    }

    const taskInfo = response[historyId];
    return {
      status: {
        status: taskInfo.status,
        failCode: taskInfo.fail_code,
        itemCount: (taskInfo.item_list || []).length,
        finishTime: taskInfo.task?.finish_time || 0,
        historyId
      } as PollingStatus,
      data: taskInfo
    };
  }, historyId);

  const item_list = finalTaskInfo.item_list || [];
  const resultImageUrls = extractImageUrls(item_list);

  if (resultImageUrls.length === 0 && item_list.length > 0) {
    throw new APIException(EX.API_IMAGE_GENERATION_FAILED, `图生图失败: item_list有 ${item_list.length} 个项目，但无法提取任何图片URL`);
  }

  logger.info(`图生图结果: 成功生成 ${resultImageUrls.length} 张图片，总耗时 ${pollingResult.elapsedTime} 秒，最终状态: ${pollingResult.status}`);

  // 如果生成成功，增加使用计数
  try {
    await sessionUsageDB.incrementUsage(effectiveSessionId, 'image');
    logger.info(`Session ${effectiveSessionId} 图生图成功，剩余次数: ${usageCheck.remaining - 1}`);
  } catch (error) {
    logger.error('Failed to increment usage:', error);
  }

  return resultImageUrls;
}

/**
 * 文生图入口
 */
export async function generateImages(
  _model: string,
  prompt: string,
  {
    ratio = '1:1',
    resolution = '2k',
    sampleStrength = 0.5,
    negativePrompt = "",
    intelligentRatio = false,
  }: {
    ratio?: string;
    resolution?: string;
    sampleStrength?: number;
    negativePrompt?: string;
    intelligentRatio?: boolean;
  },
  refreshToken: string,
  sessionId?: string,
  progressCallback?: (progress: number) => void
) {
  const regionInfo = parseRegionFromToken(refreshToken);
  const { model, userModel } = getModel(_model, regionInfo.isInternational);
  logger.info(`使用模型: ${userModel} 映射模型: ${model} 分辨率: ${resolution} 比例: ${ratio} 精细度: ${sampleStrength} 智能比例: ${intelligentRatio}`);

  // 生成session_id（如果未提供）
  const effectiveSessionId = sessionId || createSessionIdFromToken(refreshToken);

  // 检查每日使用限制
  const usageCheck = await sessionUsageDB.checkUsageLimit(effectiveSessionId, 'image');
  if (!usageCheck.allowed) {
    throw new APIException(EX.API_IMAGE_GENERATION_FAILED,
      `今日图片生成次数已达上限 (${usageCheck.current}/${usageCheck.limit})。请明天再试。`);
  }

  // 执行图片��成
  const result = await generateImagesInternal(userModel, prompt, { ratio, resolution, sampleStrength, negativePrompt, intelligentRatio }, refreshToken, progressCallback);

  // 如果生成成功，增加使用计数
  try {
    await sessionUsageDB.incrementUsage(effectiveSessionId, 'image');
    logger.info(`Session ${effectiveSessionId} 图片生成成功，剩余次数: ${usageCheck.remaining - 1}`);
  } catch (error) {
    logger.error('Failed to increment usage:', error);
  }

  return result;
}

/**
 * 文生图内部实现
 */
async function generateImagesInternal(
  _model: string,
  prompt: string,
  {
    ratio,
    resolution,
    sampleStrength = 0.5,
    negativePrompt = "",
    intelligentRatio = false,
  }: {
    ratio: string;
    resolution: string;
    sampleStrength?: number;
    negativePrompt?: string;
    intelligentRatio?: boolean;
  },
  refreshToken: string,
  progressCallback?: (progress: number) => void
) {
  if (typeof prompt !== 'string') {
    logger.error(`提示词类型错误: ${typeof prompt}, 期望string类型`);
    throw new APIException(EX.API_REQUEST_PARAMS_INVALID, "提示词必须是字符串类型，如需使用图片请使用图生图接口");
  }

  const regionInfo = parseRegionFromToken(refreshToken);
  const { model, userModel } = getModel(_model, regionInfo.isInternational);

  // 使用 payload-builder 处理分辨率
  const resolutionResult = resolveResolution(userModel, regionInfo, resolution, ratio);
  logResolutionInfo(userModel, resolutionResult, regionInfo);

  // 积分系统已移除，改为基于sessionID的使用次数限制

  // 检查是否为多图生成模式 (jimeng-4.0/jimeng-4.1/jimeng-4.5 支持)
  const isJimeng4xMultiImage = ['jimeng-4.0', 'jimeng-4.1', 'jimeng-4.5'].includes(userModel) && (
    prompt.includes("连续") ||
    prompt.includes("绘本") ||
    prompt.includes("故事") ||
    /\d+张/.test(prompt)
  );

  if (isJimeng4xMultiImage) {
    return await generateJimeng4xMultiImages(userModel, prompt, { ratio, resolution, sampleStrength, negativePrompt, intelligentRatio }, refreshToken);
  }

  const componentId = util.uuid();
  const submitId = util.uuid();

  // 使用 payload-builder 构建 core_param
  const coreParam = buildCoreParam({
    userModel,
    model,
    prompt,
    negativePrompt,
    seed: Math.floor(Math.random() * 100000000) + 2500000000,
    sampleStrength,
    resolution: resolutionResult,
    intelligentRatio,
    mode: "text2img",
  });

  // 使用 payload-builder 构建 metrics_extra
  const metricsExtra = buildMetricsExtra({
    userModel,
    regionInfo,
    submitId,
    scene: "ImageBasicGenerate",
    resolutionType: resolutionResult.resolutionType,
    abilityList: [],
  });

  // 使用 payload-builder 构建 draft_content
  const draftContent = buildDraftContent({
    componentId,
    generateType: "generate",
    coreParam,
  });

  // 使用 payload-builder 构建完整请求
  const requestData = buildGenerateRequest({
    model,
    regionInfo,
    submitId,
    draftContent,
    metricsExtra,
  });

  const { aigc_data } = await request(
    "post",
    "/mweb/v1/aigc_draft/generate",
    refreshToken,
    { data: requestData }
  );

  const historyId = aigc_data.history_record_id;
  if (!historyId)
    throw new APIException(EX.API_IMAGE_GENERATION_FAILED, "记录ID不存在");

  // 轮询结果
  const poller = new SmartPoller({
    maxPollCount: 900,
    expectedItemCount: 4,
    type: 'image'
  });

  const { result: pollingResult, data: finalTaskInfo } = await poller.poll(async () => {
    const response = await request("post", "/mweb/v1/get_history_by_ids", refreshToken, {
      data: {
        history_ids: [historyId],
        image_info: {
          width: 2048,
          height: 2048,
          format: "webp",
          image_scene_list: [
            { scene: "smart_crop", width: 360, height: 360, uniq_key: "smart_crop-w:360-h:360", format: "webp" },
            { scene: "smart_crop", width: 480, height: 480, uniq_key: "smart_crop-w:480-h:480", format: "webp" },
            { scene: "smart_crop", width: 720, height: 720, uniq_key: "smart_crop-w:720-h:720", format: "webp" },
            { scene: "smart_crop", width: 720, height: 480, uniq_key: "smart_crop-w:720-h:480", format: "webp" },
            { scene: "smart_crop", width: 360, height: 240, uniq_key: "smart_crop-w:360-h:240", format: "webp" },
            { scene: "smart_crop", width: 240, height: 320, uniq_key: "smart_crop-w:240-h:320", format: "webp" },
            { scene: "smart_crop", width: 480, height: 640, uniq_key: "smart_crop-w:480-h:640", format: "webp" },
            { scene: "normal", width: 2400, height: 2400, uniq_key: "2400", format: "webp" },
            { scene: "normal", width: 1080, height: 1080, uniq_key: "1080", format: "webp" },
            { scene: "normal", width: 720, height: 720, uniq_key: "720", format: "webp" },
            { scene: "normal", width: 480, height: 480, uniq_key: "480", format: "webp" },
            { scene: "normal", width: 360, height: 360, uniq_key: "360", format: "webp" },
          ],
        }
      },
    });

    if (!response[historyId]) {
      logger.error(`历史记录不存在: historyId=${historyId}`);
      throw new APIException(EX.API_IMAGE_GENERATION_FAILED, "记录不存在");
    }

    const taskInfo = response[historyId];
    return {
      status: {
        status: taskInfo.status,
        failCode: taskInfo.fail_code,
        itemCount: (taskInfo.item_list || []).length,
        finishTime: taskInfo.task?.finish_time || 0,
        historyId
      } as PollingStatus,
      data: taskInfo
    };
  }, historyId);

  const item_list = finalTaskInfo.item_list || [];
  const imageUrls = extractImageUrls(item_list);

  if (imageUrls.length === 0 && item_list.length > 0) {
    throw new APIException(EX.API_IMAGE_GENERATION_FAILED, `图像生成失败: item_list有 ${item_list.length} 个项目，但无法提取任何图片URL`);
  }

  logger.info(`图像生成完成: 成功生成 ${imageUrls.length} 张图片，总耗时 ${pollingResult.elapsedTime} 秒，最终状态: ${pollingResult.status}`);

  return imageUrls;
}

/**
 * jimeng-4.0/jimeng-4.1/jimeng-4.5 多图生成
 */
async function generateJimeng4xMultiImages(
  _model: string,
  prompt: string,
  {
    ratio = '1:1',
    resolution = '2k',
    sampleStrength = 0.5,
    negativePrompt = "",
    intelligentRatio = false,
  }: {
    ratio?: string;
    resolution?: string;
    sampleStrength?: number;
    negativePrompt?: string;
    intelligentRatio?: boolean;
  },
  refreshToken: string
) {
  const regionInfo = parseRegionFromToken(refreshToken);
  const { model, userModel } = getModel(_model, regionInfo.isInternational);

  // 使用 payload-builder 处理分辨率
  const resolutionResult = resolveResolution(userModel, regionInfo, resolution, ratio);

  const targetImageCount = prompt.match(/(\d+)张/) ? parseInt(prompt.match(/(\d+)张/)[1]) : 4;

  logger.info(`使用 多图生成: ${targetImageCount}张图片 ${resolutionResult.width}x${resolutionResult.height} 精细度: ${sampleStrength}`);

  const componentId = util.uuid();
  const submitId = util.uuid();

  // 使用 payload-builder 构建 core_param
  const coreParam = buildCoreParam({
    userModel,
    model,
    prompt,
    negativePrompt,
    seed: Math.floor(Math.random() * 100000000) + 2500000000,
    sampleStrength,
    resolution: resolutionResult,
    intelligentRatio,
    mode: "text2img",
  });

  // 使用 payload-builder 构建 metrics_extra (多图模式)
  const metricsExtra = buildMetricsExtra({
    userModel,
    regionInfo,
    submitId,
    scene: "ImageMultiGenerate",
    resolutionType: resolutionResult.resolutionType,
    abilityList: [],
    isMultiImage: true,
  });

  // 使用 payload-builder 构建 draft_content
  const draftContent = buildDraftContent({
    componentId,
    generateType: "generate",
    coreParam,
  });

  // 使用 payload-builder 构建完整请求
  const requestData = buildGenerateRequest({
    model,
    regionInfo,
    submitId,
    draftContent,
    metricsExtra,
  });

  const { aigc_data } = await request(
    "post",
    "/mweb/v1/aigc_draft/generate",
    refreshToken,
    { data: requestData }
  );

  const historyId = aigc_data?.history_record_id;
  if (!historyId)
    throw new APIException(EX.API_IMAGE_GENERATION_FAILED, "记录ID不存在");

  logger.info(`多图生成任务已提交，submit_id: ${submitId}, history_id: ${historyId}，等待生成 ${targetImageCount} 张图片...`);

  // 轮询结果
  const poller = new SmartPoller({
    maxPollCount: 600,
    expectedItemCount: targetImageCount,
    type: 'image'
  });

  const { result: pollingResult, data: finalTaskInfo } = await poller.poll(async () => {
    const result = await request("post", "/mweb/v1/get_history_by_ids", refreshToken, {
      data: {
        history_ids: [historyId],
        image_info: {
          width: 2048,
          height: 2048,
          format: "webp",
          image_scene_list: [
            { scene: "smart_crop", width: 360, height: 360, uniq_key: "smart_crop-w:360-h:360", format: "webp" },
            { scene: "smart_crop", width: 480, height: 480, uniq_key: "smart_crop-w:480-h:480", format: "webp" },
            { scene: "smart_crop", width: 720, height: 720, uniq_key: "smart_crop-w:720-h:720", format: "webp" },
            { scene: "smart_crop", width: 720, height: 480, uniq_key: "smart_crop-w:720-h:480", format: "webp" },
            { scene: "normal", width: 2400, height: 2400, uniq_key: "2400", format: "webp" },
            { scene: "normal", width: 1080, height: 1080, uniq_key: "1080", format: "webp" },
            { scene: "normal", width: 720, height: 720, uniq_key: "720", format: "webp" },
            { scene: "normal", width: 480, height: 480, uniq_key: "480", format: "webp" },
            { scene: "normal", width: 360, height: 360, uniq_key: "360", format: "webp" },
          ],
        },
      },
    });

    if (!result[historyId])
      throw new APIException(EX.API_IMAGE_GENERATION_FAILED, "记录不存在");

    const taskInfo = result[historyId];
    return {
      status: {
        status: taskInfo.status,
        failCode: taskInfo.fail_code,
        itemCount: (taskInfo.item_list || []).length,
        finishTime: taskInfo.task?.finish_time || 0,
        historyId
      } as PollingStatus,
      data: taskInfo
    };
  }, historyId);

  const item_list = finalTaskInfo.item_list || [];
  const imageUrls = extractImageUrls(item_list);

  if (imageUrls.length === 0 && item_list.length > 0) {
    throw new APIException(EX.API_IMAGE_GENERATION_FAILED, `多图生成失败: item_list有 ${item_list.length} 个项目，但无法提取任何图片URL`);
  }

  logger.info(`多图生成结果: 成功生成 ${imageUrls.length} 张图片，总耗时 ${pollingResult.elapsedTime} 秒，最终状态: ${pollingResult.status}`);
  return imageUrls;
}


export default {
  generateImages,
  generateImageComposition,
};
