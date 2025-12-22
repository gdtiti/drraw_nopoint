-- 即梦API Session管理数据库初始化脚本
-- 用于D1数据库

-- 1. Sessions表 - 存储所有Session信息
CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,                    -- Session唯一标识
    server_url TEXT NOT NULL,                       -- 后端服务器URL
    status TEXT NOT NULL DEFAULT 'active',          -- 状态: active, inactive, unhealthy
    health_score INTEGER DEFAULT 100,               -- 健康分数 0-100
    created_at TEXT NOT NULL,                       -- 创建时间 ISO 8601
    last_used TEXT NOT NULL,                        -- 最后使用时间
    request_count INTEGER DEFAULT 0,                -- 总请求数
    metadata TEXT,                                  -- 元数据 JSON
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

    CHECK (status IN ('active', 'inactive', 'unhealthy')),
    CHECK (health_score >= 0 AND health_score <= 100)
);

-- 2. Session Usage表 - 记录Session每日使用情况
CREATE TABLE IF NOT EXISTS session_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,                       -- Session ID
    date TEXT NOT NULL,                             -- 日期 YYYY-MM-DD
    service_type TEXT NOT NULL,                     -- 服务类型: image, video, avatar
    usage_count INTEGER DEFAULT 0,                  -- 使用次数
    metadata TEXT,                                  -- 元数据 JSON
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
    CHECK (service_type IN ('image', 'video', 'avatar')),
    CHECK (usage_count >= 0),

    -- 确保每个session每天每种服务只有一条记录
    UNIQUE(session_id, date, service_type)
);

-- 3. Usage Logs表 - 详细的请求日志
CREATE TABLE IF NOT EXISTS usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,                       -- Session ID
    service_type TEXT NOT NULL,                     -- 服务类型
    timestamp TEXT NOT NULL,                        -- 请求时间
    request_id TEXT,                                -- 请求ID
    ip_address TEXT,                                -- 客户端IP
    user_agent TEXT,                                -- 用户代理
    response_time INTEGER,                          -- 响应时间(毫秒)
    status_code INTEGER,                            -- 响应状态码
    error_message TEXT,                             -- 错误信息
    metadata TEXT,                                  -- 额外的元数据 JSON

    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
    CHECK (service_type IN ('image', 'video', 'avatar'))
);

-- 4. Server Stats表 - 服务器统计信息
CREATE TABLE IF NOT EXISTS server_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_url TEXT NOT NULL,                       -- 服务器URL
    date TEXT NOT NULL,                             -- 日期
    total_requests INTEGER DEFAULT 0,               -- 总请求数
    successful_requests INTEGER DEFAULT 0,          -- 成功请求数
    failed_requests INTEGER DEFAULT 0,              -- 失败请求数
    avg_response_time INTEGER DEFAULT 0,            -- 平均响应时间
    min_response_time INTEGER DEFAULT 0,            -- 最小响应时间
    max_response_time INTEGER DEFAULT 0,            -- 最大响应时间
    active_sessions INTEGER DEFAULT 0,              -- 活跃Session数
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(server_url, date)
);

-- 5. Daily Stats表 - 每日全局统计
CREATE TABLE IF NOT EXISTS daily_stats (
    date TEXT PRIMARY KEY,                          -- 日期
    total_sessions INTEGER DEFAULT 0,               -- 总Session数
    active_sessions INTEGER DEFAULT 0,              -- 活跃Session数
    new_sessions INTEGER DEFAULT 0,                 -- 新建Session数
    total_requests INTEGER DEFAULT 0,               -- 总请求数
    total_images INTEGER DEFAULT 0,                 -- 总图像生成数
    total_videos INTEGER DEFAULT 0,                 -- 总视频生成数
    total_avatars INTEGER DEFAULT 0,                -- 总数字人生成数
    error_rate REAL DEFAULT 0,                      -- 错误率
    avg_response_time INTEGER DEFAULT 0,            -- 平均响应时间
    peak_concurrent INTEGER DEFAULT 0,              -- 峰值并发数
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

    CHECK (error_rate >= 0 AND error_rate <= 1),
    CHECK (total_requests >= 0),
    CHECK (total_sessions >= active_sessions)
);

-- 创建索引以提高查询性能

-- Sessions表索引
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_health_score ON sessions(health_score DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_last_used ON sessions(last_used DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_server_url ON sessions(server_url);

-- Session Usage表索引
CREATE INDEX IF NOT EXISTS idx_session_usage_session_date ON session_usage(session_id, date);
CREATE INDEX IF NOT EXISTS idx_session_usage_date ON session_usage(date);
CREATE INDEX IF NOT EXISTS idx_session_usage_service_type ON session_usage(service_type);
CREATE INDEX IF NOT EXISTS idx_session_usage_count ON session_usage(usage_count DESC);

-- Usage Logs表索引
CREATE INDEX IF NOT EXISTS idx_usage_logs_session_id ON usage_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_timestamp ON usage_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_service_type ON usage_logs(service_type);
CREATE INDEX IF NOT EXISTS idx_usage_logs_status_code ON usage_logs(status_code);

-- Server Stats表索引
CREATE INDEX IF NOT EXISTS idx_server_stats_server_date ON server_stats(server_url, date);
CREATE INDEX IF NOT EXISTS idx_server_stats_date ON server_stats(date);
CREATE INDEX IF NOT EXISTS idx_server_stats_requests ON server_stats(total_requests DESC);

-- 创建触发器以自动更新时间戳

-- Sessions表更新时间戳触发器
CREATE TRIGGER IF NOT EXISTS update_sessions_timestamp
AFTER UPDATE ON sessions
BEGIN
    UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE session_id = NEW.session_id;
END;

-- Session Usage表更新时间戳触发器
CREATE TRIGGER IF NOT EXISTS update_session_usage_timestamp
AFTER UPDATE ON session_usage
BEGIN
    UPDATE session_usage SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Server Stats表更新时间戳触发器
CREATE TRIGGER IF NOT EXISTS update_server_stats_timestamp
AFTER UPDATE ON server_stats
BEGIN
    UPDATE server_stats SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Daily Stats表更新时间戳触发器
CREATE TRIGGER IF NOT EXISTS update_daily_stats_timestamp
AFTER UPDATE ON daily_stats
BEGIN
    UPDATE daily_stats SET updated_at = CURRENT_TIMESTAMP WHERE date = NEW.date;
END;

-- 创建视图以简化常用查询

-- Session今日使用情况视图
CREATE VIEW IF NOT EXISTS v_session_today_usage AS
SELECT
    s.session_id,
    s.server_url,
    s.health_score,
    s.last_used,
    COALESCE(u.image_count, 0) as image_count,
    COALESCE(u.video_count, 0) as video_count,
    COALESCE(u.avatar_count, 0) as avatar_count,
    (SELECT
        COALESCE(image_count, 0) +
        COALESCE(video_count, 0) +
        COALESCE(avatar_count, 0)
    ) as total_usage
FROM sessions s
LEFT JOIN (
    SELECT
        session_id,
        SUM(CASE WHEN service_type = 'image' THEN usage_count ELSE 0 END) as image_count,
        SUM(CASE WHEN service_type = 'video' THEN usage_count ELSE 0 END) as video_count,
        SUM(CASE WHEN service_type = 'avatar' THEN usage_count ELSE 0 END) as avatar_count
    FROM session_usage
    WHERE date = DATE('now')
    GROUP BY session_id
) u ON s.session_id = u.session_id
WHERE s.status = 'active';

-- 服务器性能统计视图
CREATE VIEW IF NOT EXISTS v_server_performance AS
SELECT
    server_url,
    COUNT(*) as total_sessions,
    AVG(request_count) as avg_requests_per_session,
    SUM(CASE WHEN health_score > 80 THEN 1 ELSE 0 END) as healthy_sessions,
    SUM(CASE WHEN health_score <= 50 THEN 1 ELSE 0 END) as unhealthy_sessions,
    AVG(health_score) as avg_health_score
FROM sessions
WHERE status = 'active'
GROUP BY server_url;

-- 每日服务使用趋势视图
CREATE VIEW IF NOT EXISTS v_daily_usage_trend AS
SELECT
    date,
    SUM(CASE WHEN service_type = 'image' THEN usage_count ELSE 0 END) as daily_images,
    SUM(CASE WHEN service_type = 'video' THEN usage_count ELSE 0 END) as daily_videos,
    SUM(CASE WHEN service_type = 'avatar' THEN usage_count ELSE 0 END) as daily_avatars,
    COUNT(DISTINCT session_id) as active_sessions
FROM session_usage
GROUP BY date
ORDER BY date DESC;

-- 初始化一些基础数据（可选）

-- 创建配置表存储系统配置
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认配置
INSERT OR REPLACE INTO system_config (key, value, description) VALUES
('session_pool_min_size', '50', 'Session池最小大小'),
('session_pool_max_size', '500', 'Session池最大大小'),
('image_daily_limit', '10', '每日图像生成限制'),
('video_daily_limit', '2', '每日视频生成限制'),
('avatar_daily_limit', '1', '每日数字人生成限制'),
('health_check_interval', '300000', '健康检查间隔(毫秒)'),
('session_ttl', '86400000', 'Session过期时间(毫秒)'),
('cleanup_retention_days', '30', '数据保留天数');

-- 创建优化建议的存储过程

-- 获取Session使用率
CREATE VIEW IF NOT EXISTS v_session_utilization AS
SELECT
    s.session_id,
    s.last_used,
    CASE
        WHEN DATEDIFF('now', s.last_used) > 7 THEN 'stale'
        WHEN DATEDIFF('now', s.last_used) > 3 THEN 'idle'
        WHEN (SELECT SUM(usage_count) FROM session_usage
              WHERE session_id = s.session_id AND date = DATE('now')) >= 10 THEN 'overused'
        WHEN (SELECT COUNT(*) FROM session_usage
              WHERE session_id = s.session_id AND date = DATE('now')) >= 3 THEN 'active'
        ELSE 'light_use'
    END as utilization_level
FROM sessions s
WHERE s.status = 'active';