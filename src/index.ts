"use strict";

import environment from "@/lib/environment.ts";
import config from "@/lib/config.ts";
import "@/lib/initialize.ts";
import server from "@/lib/server.ts";
import routes from "@/api/routes/index.ts";
import logger from "@/lib/logger.ts";
import { taskProcessor } from "@/lib/task-processor.ts";

// 确保taskProcessor被实际初始化（防止tree-shaking移除）
const _taskProcessor = taskProcessor;

const startupTime = performance.now();

(async () => {
  logger.header();

  logger.info("<<<< jimeng-api >>>>");
  logger.info("Version:", environment.package.version);
  logger.info("Process id:", process.pid);
  logger.info("Environment:", environment.env);
  logger.info("Service name:", config.service.name);

  // 显示镜像配置状态
  const mirrorUrls = {
    'DREAMINA_US_MIRROR': process.env.DREAMINA_US_MIRROR,
    'IMAGEX_US_MIRROR': process.env.IMAGEX_US_MIRROR,
    'DREAMINA_HK_MIRROR': process.env.DREAMINA_HK_MIRROR,
    'IMAGEX_HK_MIRROR': process.env.IMAGEX_HK_MIRROR,
    'JIMENG_CN_MIRROR': process.env.JIMENG_CN_MIRROR,
    'IMAGEX_CN_MIRROR': process.env.IMAGEX_CN_MIRROR,
    'COMMERCE_US_MIRROR': process.env.COMMERCE_US_MIRROR,
    'COMMERCE_HK_MIRROR': process.env.COMMERCE_HK_MIRROR,
    'DREAMINA_HK_API_MIRROR': process.env.DREAMINA_HK_API_MIRROR
  };

  const activeMirrors = Object.entries(mirrorUrls).filter(([_, url]) => url);
  if (activeMirrors.length > 0) {
    logger.info(`🚀 已启用 ${activeMirrors.length} 个镜像加速配置:`);
    activeMirrors.forEach(([name, url]) => {
      logger.info(`  - ${name}: ${url}`);
    });
    logger.info("💡 使用环境变量配置镜像，参考 .env.example");
  } else {
    logger.info("ℹ️ 未检测到镜像配置，使用官方API地址");
    logger.info("💡 复制 .env.example 为 .env 并配置镜像URL以启用加速");
  }

  // 检查 .env 文件是否存在
  const fs = await import('fs-extra');
  const path = await import('path');
  const envPath = path.join(path.resolve(), '.env');
  const envExamplePath = path.join(path.resolve(), '.env.example');

  if (await fs.pathExists(envExamplePath) && !await fs.pathExists(envPath)) {
    logger.info("📝 发现 .env.example 文件，但未找到 .env 文件");
    logger.info("💡 运行 'cp .env.example .env' 创建环境配置文件");
  }

  server.attachRoutes(routes);
  await server.listen();

  config.service.bindAddress &&
    logger.success("Service bind address:", config.service.bindAddress);
})()
  .then(() =>
    logger.success(
      `Service startup completed (${Math.floor(performance.now() - startupTime)}ms)`
    )
  )
  .catch((err) => console.error(err));
