import { ProxyConfig } from '@/lib/configs/system-config';
import { AxiosRequestConfig } from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import _ from 'lodash';

/**
 * 代理助手类
 */
export class ProxyHelper {
    private static instance: ProxyHelper;
    private config: ProxyConfig;
    private static socksAgent: any = null;

    private constructor(config: ProxyConfig) {
        this.config = config;
    }

    /**
     * 获取单例实例
     */
    static getInstance(config?: ProxyConfig): ProxyHelper {
        if (!ProxyHelper.instance) {
            if (!config) {
                throw new Error('Proxy config is required for first initialization');
            }
            ProxyHelper.instance = new ProxyHelper(config);
        }
        return ProxyHelper.instance;
    }

    /**
     * 检查URL是否应该绕过代理
     */
    private shouldBypass(url: string): boolean {
        if (!this.config.bypass || this.config.bypass.length === 0) {
            return false;
        }

        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;

            for (const pattern of this.config.bypass) {
                // 简单的通配符匹配
                const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
                if (regex.test(hostname) || regex.test(url)) {
                    console.log(`Bypassing proxy for: ${hostname}`);
                    return true;
                }
            }
        } catch (error) {
            // 如果URL解析失败，不绕过代理
            console.warn(`Failed to parse URL for bypass check: ${url}`);
        }

        return false;
    }

    /**
     * 为axios请求配置代理
     */
    public getAxiosProxyConfig(requestUrl?: string): Partial<AxiosRequestConfig> {
        // 如果代理未启用，返回空配置
        if (!this.config.enabled || !this.config.host || this.config.port <= 0) {
            return {};
        }

        // 检查是否需要绕过代理
        if (requestUrl && this.shouldBypass(requestUrl)) {
            return {};
        }

        console.log(`Using proxy: ${this.config.type}://${this.config.host}:${this.config.port}`);

        // 创建或复用SOCKS5代理agent
        if (this.config.type === 'socks5') {
            // SOCKS5代理
            const proxyOptions = `socks5://${this.config.auth.username && this.config.auth.password ?
                `${this.config.auth.username}:${this.config.auth.password}@` : ''}${this.config.host}:${this.config.port}`;

            // 复用agent以提高性能
            if (!ProxyHelper.socksAgent || ProxyHelper.socksAgent.proxyOptions !== proxyOptions) {
                try {
                    ProxyHelper.socksAgent = new SocksProxyAgent(proxyOptions, {
                        keepAlive: true,
                        keepAliveMsecs: 30000, // 30秒保持连接
                        maxSockets: 10,
                        maxFreeSockets: 5
                    });
                    ProxyHelper.socksAgent.proxyOptions = proxyOptions;
                    console.log(`Created new SOCKS5 agent: ${this.config.host}:${this.config.port}`);
                } catch (error) {
                    console.error(`Failed to create SOCKS5 agent: ${error.message}`);
                    return {};
                }
            } else {
                console.log(`Reusing SOCKS5 agent: ${this.config.host}:${this.config.port}`);
            }

            return {
                httpsAgent: ProxyHelper.socksAgent,
                timeout: this.config.timeout
            };
        } else {
            console.error(`Unsupported proxy type: ${this.config.type}. Only SOCKS5 is supported.`);
            return {};
        }
    }

    /**
     * 更新代理配置
     */
    public updateConfig(newConfig: ProxyConfig): void {
        this.config = newConfig;
        // 重置agent以便使用新配置
        ProxyHelper.socksAgent = null;
    }

    /**
     * 获取当前代理配置
     */
    public getConfig(): ProxyConfig {
        return { ...this.config };
    }

    /**
     * 测试代理连接（通过简单的HTTP请求）
     */
    public async testProxy(targetUrl: string = 'https://httpbin.org/ip'): Promise<{ success: boolean; error?: string; ip?: string }> {
        if (!this.config.enabled || !this.config.host || this.config.port <= 0) {
            return { success: false, error: 'Proxy is disabled or not configured' };
        }

        try {
            // 使用Node.js内置的https模块进行测试
            const https = require('https');
            const http = require('http');

            // 根据目标URL选择模块
            const url = new URL(targetUrl);
            const client = url.protocol === 'https:' ? https : http;

            const options = {
                hostname: this.config.host,
                port: this.config.port,
                path: targetUrl,
                method: 'GET',
                headers: {
                    'Host': url.hostname,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: this.config.timeout || 10000
            };

            // 添加认证
            if (this.config.auth.username && this.config.auth.password) {
                const auth = Buffer.from(`${this.config.auth.username}:${this.config.auth.password}`).toString('base64');
                options.headers['Proxy-Authorization'] = `Basic ${auth}`;
            }

            return new Promise((resolve) => {
                const req = client.request(options, (res: any) => {
                    let data = '';
                    res.on('data', (chunk: any) => data += chunk);
                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            try {
                                const result = JSON.parse(data);
                                resolve({
                                    success: true,
                                    ip: result.origin || 'Unknown'
                                });
                            } catch (e) {
                                resolve({ success: true });
                            }
                        } else {
                            resolve({
                                success: false,
                                error: `HTTP ${res.statusCode}`
                            });
                        }
                    });
                });

                req.on('error', (error: any) => {
                    resolve({
                        success: false,
                        error: error.message
                    });
                });

                req.on('timeout', () => {
                    req.destroy();
                    resolve({
                        success: false,
                        error: 'Request timeout'
                    });
                });

                req.end();
            });
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 销毁实例
     */
    public destroy(): void {
        ProxyHelper.instance = null as any;
    }
}

export default ProxyHelper;