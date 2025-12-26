import crypto from "crypto";
import { RegionInfo, request } from "@/api/controllers/core.ts";
import { RegionUtils } from "@/lib/region-utils.ts";
import { createSignature } from "@/lib/aws-signature.ts";
import logger from "@/lib/logger.ts";
import util from "@/lib/util.ts";

/**
 * 统一的图片上传模块
 * 整合了images.ts和videos.ts中重复的上传逻辑
 */

/**
 * 上传图片Buffer到ImageX
 * @param imageBuffer 图片数据
 * @param refreshToken 刷新令牌
 * @param regionInfo 区域信息
 * @returns 图片URI
 */
export async function uploadImageBuffer(
  imageBuffer: ArrayBuffer | Buffer,
  refreshToken: string,
  regionInfo: RegionInfo
): Promise<string> {
  try {
    logger.info(`开始上传图片Buffer... (isInternational: ${regionInfo.isInternational})`);

    // 第一步：获取上传令牌
    const tokenResult = await request("post", "/mweb/v1/get_upload_token", refreshToken, {
      data: {
        scene: 2, // AIGC 图片上传场景
      },
    });

    const { access_key_id, secret_access_key, session_token } = tokenResult;
    const service_id = regionInfo.isInternational ? tokenResult.space_name : tokenResult.service_id;

    if (!access_key_id || !secret_access_key || !session_token) {
      throw new Error("获取上传令牌失败");
    }

    const actualServiceId = RegionUtils.getServiceId(regionInfo, service_id);
    logger.info(`获取上传令牌成功: service_id=${actualServiceId}`);

    // 准备文件信息
    const fileSize = imageBuffer.byteLength;
    const crc32 = util.calculateCRC32(imageBuffer);
    logger.info(`图片Buffer: 大小=${fileSize}字节, CRC32=${crc32}`);

    // 第二步：申请图片上传权限
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:\-]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const randomStr = Math.random().toString(36).substring(2, 12);

    const applyUrlHost = RegionUtils.getImageXUrl(regionInfo);
    const applyUrl = `${applyUrlHost}/?Action=ApplyImageUpload&Version=2018-08-01&ServiceId=${actualServiceId}&FileSize=${fileSize}&s=${randomStr}${regionInfo.isInternational ? '&device_platform=web' : ''}`;

    const awsRegion = RegionUtils.getAWSRegion(regionInfo);
    const origin = RegionUtils.getOrigin(regionInfo);

    const requestHeaders = {
      'x-amz-date': timestamp,
      'x-amz-security-token': session_token
    };

    const authorization = createSignature('GET', applyUrl, requestHeaders, access_key_id, secret_access_key, session_token, '', awsRegion);

    logger.info(`申请上传权限: ${applyUrl}`);

    let applyResponse;
    try {
      applyResponse = await fetch(applyUrl, {
        method: 'GET',
        headers: {
          'accept': '*/*',
          'accept-language': 'zh-CN,zh;q=0.9',
          'authorization': authorization,
          'origin': origin,
          'referer': `${origin}/ai-tool/generate`,
          'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'cross-site',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
          'x-amz-date': timestamp,
          'x-amz-security-token': session_token,
        },
      });
    } catch (fetchError: any) {
      logger.error(`Fetch请求失败，目标URL: ${applyUrl}`);
      logger.error(`错误详情: ${fetchError.message}`);
      throw new Error(`网络请求失败 (${applyUrlHost}): ${fetchError.message}. 请检查: 1) 网络连接是否正常 2) 是否需要配置代理 3) DNS是否能解析该域名`);
    }

    if (!applyResponse.ok) {
      const errorText = await applyResponse.text();
      throw new Error(`申请上传权限失败: ${applyResponse.status} - ${errorText}`);
    }

    const applyResult = await applyResponse.json();

    if (applyResult?.ResponseMetadata?.Error) {
      throw new Error(`申请上传权限失败: ${JSON.stringify(applyResult.ResponseMetadata.Error)}`);
    }

    logger.info(`申请上传权限成功`);

    // 解析上传信息
    const uploadAddress = applyResult?.Result?.UploadAddress;
    if (!uploadAddress || !uploadAddress.StoreInfos || !uploadAddress.UploadHosts) {
      throw new Error(`获取上传地址失败: ${JSON.stringify(applyResult)}`);
    }

    const storeInfo = uploadAddress.StoreInfos[0];
    const uploadHost = uploadAddress.UploadHosts[0];
    const auth = storeInfo.Auth;
    const uploadUrl = `https://${uploadHost}/upload/v1/${storeInfo.StoreUri}`;

    logger.info(`准备上传图片: uploadUrl=${uploadUrl}`);

    // 第三步：上传图片文件（带重试机制）
    let uploadResponse;
    const maxRetries = 3;
    let uploadAttempt = 0;

    while (uploadAttempt < maxRetries) {
      uploadAttempt++;
      try {
        logger.info(`尝试上传图片 (第${uploadAttempt}/${maxRetries}次): ${uploadHost}`);

        // 创建AbortController用于超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 30000); // 30秒超时

        uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Accept': '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Authorization': auth,
            'Connection': 'keep-alive',
            'Content-CRC32': crc32,
            'Content-Disposition': 'attachment; filename="undefined"',
            'Content-Type': 'application/octet-stream',
            'Origin': origin,
            'Referer': RegionUtils.getRefererPath(regionInfo),
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'cross-site',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
          },
          body: imageBuffer,
          signal: controller.signal,
        });

        // 清除超时定时器
        clearTimeout(timeoutId);

        // 如果成功，跳出重试循环
        break;

      } catch (fetchError: any) {
        logger.error(`图片文件上传失败 (第${uploadAttempt}/${maxRetries}次): ${fetchError.message}`);

        if (uploadAttempt >= maxRetries) {
          logger.error(`图片文件上传fetch请求失败，目标URL: ${uploadUrl}`);
          logger.error(`错误详情: ${fetchError.message}`);
          throw new Error(`图片上传网络请求失败 (${uploadHost}): ${fetchError.message}. 请检查网络连接`);
        }

        // 重试前等待
        logger.info(`等待 ${uploadAttempt * 2} 秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, uploadAttempt * 2000));
      }
    }

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`图片上传失败: ${uploadResponse.status} - ${errorText}`);
    }

    logger.info(`图片文件上传成功`);

    // 第四步：提交上传（带重试机制）
    const commitUrl = `${applyUrlHost}/?Action=CommitImageUpload&Version=2018-08-01&ServiceId=${actualServiceId}`;
    logger.info(`准备提交上传: ${commitUrl}`);

    let commitResponse;
    const maxCommitRetries = 3;
    let commitAttempt = 0;

    while (commitAttempt < maxCommitRetries) {
      commitAttempt++;

      try {
        logger.info(`尝试提交上传 (第${commitAttempt}/${maxCommitRetries}次): ${commitUrl}`);

        // 每次重试都需要重新生成签名和时间戳
        const commitTimestamp = new Date().toISOString().replace(/[:\-]/g, '').replace(/\.\d{3}Z$/, 'Z');
        const commitPayload = JSON.stringify({
          SessionKey: uploadAddress.SessionKey
        });

        const payloadHash = crypto.createHash('sha256').update(commitPayload, 'utf8').digest('hex');

        const commitRequestHeaders = {
          'x-amz-date': commitTimestamp,
          'x-amz-security-token': session_token,
          'x-amz-content-sha256': payloadHash
        };

        const commitAuthorization = createSignature('POST', commitUrl, commitRequestHeaders, access_key_id, secret_access_key, session_token, commitPayload, awsRegion);

        // 创建AbortController用于超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 30000); // 30秒超时

        commitResponse = await fetch(commitUrl, {
          method: 'POST',
          headers: {
            'accept': '*/*',
            'accept-language': 'zh-CN,zh;q=0.9',
            'authorization': commitAuthorization,
            'content-type': 'application/json',
            'origin': origin,
            'referer': RegionUtils.getRefererPath(regionInfo),
            'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'cross-site',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
            'x-amz-date': commitTimestamp,
            'x-amz-security-token': session_token,
            'x-amz-content-sha256': payloadHash,
          },
          body: commitPayload,
          signal: controller.signal,
        });

        // 清除超时定时器
        clearTimeout(timeoutId);

        // 如果成功，跳出重试循环
        if (commitResponse.ok) {
          logger.info(`提交上传成功: ${commitUrl}`);
          break;
        } else {
          // HTTP错误也重试
          const errorText = await commitResponse.text();
          logger.error(`提交上传HTTP错误 (第${commitAttempt}/${maxCommitRetries}次): ${commitResponse.status} - ${errorText}`);

          if (commitAttempt >= maxCommitRetries) {
            throw new Error(`提交上传失败: ${commitResponse.status} - ${errorText}`);
          }
        }

      } catch (fetchError: any) {
        logger.error(`提交上传fetch请求失败 (第${commitAttempt}/${maxCommitRetries}次): ${fetchError.message}`);
        logger.error(`目标URL: ${commitUrl}`);

        if (commitAttempt >= maxCommitRetries) {
          logger.error(`提交上传fetch请求最终失败，目标URL: ${commitUrl}`);
          logger.error(`错误详情: ${fetchError.message}`);
          throw new Error(`提交上传网络请求失败 (${applyUrlHost}): ${fetchError.message}. 请检查网络连接`);
        }

        // 检查是否为网络错误，增加更长的等待时间
        const isNetworkError = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'fetch failed'].some(err =>
          fetchError.message.includes(err) || fetchError.cause?.message?.includes(err)
        );

        if (isNetworkError) {
          logger.info(`检测到网络错误，将在 ${commitAttempt * 3} 秒后重试...`);
          await new Promise(resolve => setTimeout(resolve, commitAttempt * 3000));
        } else {
          logger.info(`等待 ${commitAttempt * 2} 秒后重试...`);
          await new Promise(resolve => setTimeout(resolve, commitAttempt * 2000));
        }
      }
    }

    if (!commitResponse.ok) {
      const errorText = await commitResponse.text();
      throw new Error(`提交上传失败: ${commitResponse.status} - ${errorText}`);
    }

    const commitResult = await commitResponse.json();

    if (commitResult?.ResponseMetadata?.Error) {
      throw new Error(`提交上传失败: ${JSON.stringify(commitResult.ResponseMetadata.Error)}`);
    }

    if (!commitResult?.Result?.Results || commitResult.Result.Results.length === 0) {
      throw new Error(`提交上传响应缺少结果: ${JSON.stringify(commitResult)}`);
    }

    const uploadResult = commitResult.Result.Results[0];
    if (uploadResult.UriStatus !== 2000) {
      throw new Error(`图片上传状态异常: UriStatus=${uploadResult.UriStatus}`);
    }

    const fullImageUri = uploadResult.Uri;
    logger.info(`图片上传完成: ${fullImageUri}`);

    return fullImageUri;
  } catch (error: any) {
    logger.error(`图片Buffer上传失败: ${error.message}`);
    throw error;
  }
}

/**
 * 从URL下载并上传图片
 * @param imageUrl 图片URL (支持 http://, https://, data:image/...;base64,...)
 * @param refreshToken 刷新令牌
 * @param regionInfo 区域信息
 * @returns 图片URI
 */
export async function uploadImageFromUrl(
  imageUrl: string,
  refreshToken: string,
  regionInfo: RegionInfo
): Promise<string> {
  try {
    // 处理 base64 格式的图片 (data:image/...;base64,...)
    if (util.isBASE64Data(imageUrl)) {
      logger.info(`检测到base64格式图片，直接转换`);

      const base64Data = util.removeBASE64DataHeader(imageUrl);
      const imageBuffer = Buffer.from(base64Data, 'base64');

      logger.info(`base64图片转换完成，大小: ${imageBuffer.length}字节`);

      return await uploadImageBuffer(imageBuffer, refreshToken, regionInfo);
    }

    // 处理普通URL图片
    logger.info(`开始从URL下载并上传图片: ${imageUrl}`);

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`下载图片失败: ${imageResponse.status}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    return await uploadImageBuffer(imageBuffer, refreshToken, regionInfo);
  } catch (error: any) {
    logger.error(`从URL上传图片失败: ${error.message}`);
    throw error;
  }
}
