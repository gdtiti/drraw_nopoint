import { createConnection, Connection, ResultSetHeader } from 'mysql2/promise';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

export interface SessionUsage {
  session_id: string;
  date: string; // YYYY-MM-DD format
  image_count: number;
  video_count: number;
  avatar_count: number;
  created_at: string;
  updated_at: string;
}

export interface UsageStats {
  total_sessions: number;
  active_sessions_today: number;
  total_images_today: number;
  total_videos_today: number;
  total_avatars_today: number;
  avg_images_per_session: number;
  avg_videos_per_session: number;
  avg_avatars_per_session: number;
}

export class SessionUsageDB {
  private db: Database | null = null;
  private readonly dbPath: string;
  private readonly DAILY_LIMITS = {
    image: 10,
    video: 2,
    avatar: 1
  };

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'session_usage.db');
  }

  async initialize(): Promise<void> {
    // Ensure data directory exists
    const dataDir = path.dirname(this.dbPath);
    await fs.mkdir(dataDir, { recursive: true });

    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database
    });

    // Create table if not exists
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_usage (
        session_id TEXT NOT NULL,
        date TEXT NOT NULL,
        image_count INTEGER DEFAULT 0,
        video_count INTEGER DEFAULT 0,
        avatar_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (session_id, date)
      );

      CREATE INDEX IF NOT EXISTS idx_session_usage_date ON session_usage(date);
      CREATE INDEX IF NOT EXISTS idx_session_usage_session_id ON session_usage(session_id);
    `);
  }

  async checkUsageLimit(sessionId: string, type: 'image' | 'video' | 'avatar'): Promise<{
    allowed: boolean;
    remaining: number;
    current: number;
  }> {
    if (!this.db) await this.initialize();

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Get or create usage record for today
    let usage = await this.getUsage(sessionId, today);

    if (!usage) {
      await this.createUsageRecord(sessionId, today);
      usage = await this.getUsage(sessionId, today);
    }

    if (!usage) {
      throw new Error('Failed to create usage record');
    }

    const currentCount = this.getCurrentCount(usage, type);
    const limit = this.DAILY_LIMITS[type];
    const remaining = Math.max(0, limit - currentCount);

    return {
      allowed: currentCount < limit,
      remaining,
      current: currentCount
    };
  }

  async incrementUsage(sessionId: string, type: 'image' | 'video' | 'avatar'): Promise<void> {
    if (!this.db) await this.initialize();

    const today = new Date().toISOString().split('T')[0];

    // Check if increment is allowed
    const check = await this.checkUsageLimit(sessionId, type);
    if (!check.allowed) {
      throw new Error(
        `Daily limit exceeded for ${type}. Current: ${check.current}, Limit: ${this.DAILY_LIMITS[type]}`
      );
    }

    // Increment the count
    const field = `${type}_count`;
    await this.db.run(
      `UPDATE session_usage
       SET ${field} = ${field} + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE session_id = ? AND date = ?`,
      [sessionId, today]
    );
  }

  async getUsage(sessionId: string, date: string): Promise<SessionUsage | null> {
    if (!this.db) await this.initialize();

    const row = await this.db.get(
      `SELECT session_id, date, image_count, video_count, avatar_count,
              created_at, updated_at
       FROM session_usage
       WHERE session_id = ? AND date = ?`,
      [sessionId, date]
    );

    return row || null;
  }

  async getSessionUsageHistory(sessionId: string, days: number = 7): Promise<SessionUsage[]> {
    if (!this.db) await this.initialize();

    const rows = await this.db.all(
      `SELECT session_id, date, image_count, video_count, avatar_count,
              created_at, updated_at
       FROM session_usage
       WHERE session_id = ? AND date >= date('now', '-${days} days')
       ORDER BY date DESC`,
      [sessionId]
    );

    return rows;
  }

  async getDailyStats(date?: string): Promise<UsageStats> {
    if (!this.db) await this.initialize();

    const targetDate = date || new Date().toISOString().split('T')[0];

    // Get total sessions
    const totalSessionsResult = await this.db.get(
      `SELECT COUNT(DISTINCT session_id) as count FROM session_usage`
    );

    // Get active sessions today
    const activeSessionsResult = await this.db.get(
      `SELECT COUNT(DISTINCT session_id) as count FROM session_usage WHERE date = ?`,
      [targetDate]
    );

    // Get totals for today
    const totalsResult = await this.db.get(
      `SELECT
        SUM(image_count) as total_images,
        SUM(video_count) as total_videos,
        SUM(avatar_count) as total_avatars,
        AVG(image_count) as avg_images,
        AVG(video_count) as avg_videos,
        AVG(avatar_count) as avg_avatars
       FROM session_usage
       WHERE date = ?`,
      [targetDate]
    );

    return {
      total_sessions: totalSessionsResult?.count || 0,
      active_sessions_today: activeSessionsResult?.count || 0,
      total_images_today: totalsResult?.total_images || 0,
      total_videos_today: totalsResult?.total_videos || 0,
      total_avatars_today: totalsResult?.total_avatars || 0,
      avg_images_per_session: parseFloat(totalsResult?.avg_images || '0'),
      avg_videos_per_session: parseFloat(totalsResult?.avg_videos || '0'),
      avg_avatars_per_session: parseFloat(totalsResult?.avg_avatars || '0')
    };
  }

  async getRangeStats(startDate: string, endDate: string): Promise<any> {
    if (!this.db) await this.initialize();

    const rows = await this.db.all(
      `SELECT
        date,
        COUNT(DISTINCT session_id) as active_sessions,
        SUM(image_count) as total_images,
        SUM(video_count) as total_videos,
        SUM(avatar_count) as total_avatars,
        AVG(image_count) as avg_images,
        AVG(video_count) as avg_videos,
        AVG(avatar_count) as avg_avatars
       FROM session_usage
       WHERE date BETWEEN ? AND ?
       GROUP BY date
       ORDER BY date DESC`,
      [startDate, endDate]
    );

    return rows;
  }

  async cleanupOldRecords(daysToKeep: number = 30): Promise<number> {
    if (!this.db) await this.initialize();

    const result = await this.db.run(
      `DELETE FROM session_usage
       WHERE date < date('now', '-${daysToKeep} days')`
    );

    return result.changes || 0;
  }

  private async createUsageRecord(sessionId: string, date: string): Promise<void> {
    if (!this.db) await this.initialize();

    await this.db.run(
      `INSERT INTO session_usage (session_id, date, image_count, video_count, avatar_count)
       VALUES (?, ?, 0, 0, 0)`,
      [sessionId, date]
    );
  }

  private getCurrentCount(usage: SessionUsage, type: 'image' | 'video' | 'avatar'): number {
    switch (type) {
      case 'image': return usage.image_count;
      case 'video': return usage.video_count;
      case 'avatar': return usage.avatar_count;
      default: return 0;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}

// Singleton instance
export const sessionUsageDB = new SessionUsageDB();