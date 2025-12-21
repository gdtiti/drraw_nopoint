import Request from '@/lib/request/Request.ts';
import systemConfig from '@/lib/configs/system-config.ts';
import ProxyHelper from '@/utils/proxy-helper.ts';
import fs from 'fs-extra';
import path from 'path';
import yaml from 'yaml';

export default {
  prefix: '/proxy',

  get: {
    // 获取当前代理配置
    '/config': async (request: Request) => {
      const config = systemConfig.proxy;

      // 隐藏密码信息
      const safeConfig = {
        ...config,
        auth: {
          username: config.auth.username,
          password: config.auth.password ? '***' : ''
        }
      };

      return {
        success: true,
        data: safeConfig
      };
    }
  },

  post: {
    // 更新代理配置
    '/config': async (request: Request) => {
      const newConfig = request.body;

      // 验证必要字段
      if (newConfig.enabled) {
        if (!newConfig.host || !newConfig.port) {
          return {
            success: false,
            error: 'Proxy host and port are required when proxy is enabled',
            code: 'INVALID_PROXY_CONFIG'
          };
        }
      }

      // 更新内存中的配置
      systemConfig.proxy = { ...systemConfig.proxy, ...newConfig };

      // 更新ProxyHelper实例
      const proxyHelper = ProxyHelper.getInstance();
      proxyHelper.updateConfig(systemConfig.proxy);

      // 保存配置到文件
      const env = process.env.NODE_ENV || 'dev';
      const configPath = path.join(process.cwd(), 'configs', env, 'system.yml');

      if (await fs.pathExists(configPath)) {
        const configData = yaml.parse(await fs.readFile(configPath, 'utf-8'));
        configData.proxy = systemConfig.proxy;
        await fs.writeFile(configPath, yaml.stringify(configData));
      }

      return {
        success: true,
        message: 'Proxy configuration updated successfully',
        data: {
          enabled: systemConfig.proxy.enabled,
          host: systemConfig.proxy.host,
          port: systemConfig.proxy.port,
          type: systemConfig.proxy.type
        }
      };
    },

    // 测试代理连接
    '/test': async (request: Request) => {
      const { targetUrl } = request.body;
      const proxyHelper = ProxyHelper.getInstance();

      const result = await proxyHelper.testProxy(targetUrl);

      if (result.success) {
        return {
          success: true,
          message: 'Proxy connection successful',
          data: {
            connected: true,
            ip: result.ip || 'Unknown',
            targetUrl: targetUrl || 'https://httpbin.org/ip'
          }
        };
      } else {
        return {
          success: false,
          message: 'Proxy connection failed',
          data: {
            connected: false,
            error: result.error
          }
        };
      }
    },

    // 快速启用/禁用代理
    '/enable': async (request: Request) => {
      const { enabled } = request.body;

      if (typeof enabled !== 'boolean') {
        return {
          success: false,
          error: 'enabled field must be boolean',
          code: 'INVALID_ENABLE_VALUE'
        };
      }

      // 更新配置
      systemConfig.proxy.enabled = enabled;
      const proxyHelper = ProxyHelper.getInstance();
      proxyHelper.updateConfig(systemConfig.proxy);

      // 保存配置到文件
      const env = process.env.NODE_ENV || 'dev';
      const configPath = path.join(process.cwd(), 'configs', env, 'system.yml');

      if (await fs.pathExists(configPath)) {
        const configData = yaml.parse(await fs.readFile(configPath, 'utf-8'));
        configData.proxy = configData.proxy || {};
        configData.proxy.enabled = enabled;
        await fs.writeFile(configPath, yaml.stringify(configData));
      }

      return {
        success: true,
        message: enabled ? 'Proxy enabled' : 'Proxy disabled',
        data: {
          enabled
        }
      };
    }
  }
};