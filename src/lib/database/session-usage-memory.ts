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

class MemoryUsageDB {
  private data: Map<string, SessionUsage> = new Map();
  private dataDir: string;
  private dataFile: string;
  private readonly DAILY_LIMITS = {
    image: 50,
    video: 10,
    avatar: 5
  };

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.join(process.cwd(), 'data');
    this.dataFile = path.join(this.dataDir, 'session_usage.json');
    this.loadData();
  }

  private async loadData(): Promise<void> {
    try {
      const dataStr = await fs.readFile(this.dataFile, 'utf-8');
      const data = JSON.parse(dataStr);
      this.data = new Map(Object.entries(data));
    } catch (error) {
      // File doesn't exist or is invalid, start with empty data
      console.log('No existing usage data found, starting fresh');
    }
  }

  private async saveData(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      const data = Object.fromEntries(this.data);
      await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save usage data:', error);
    }
  }

  async checkUsageLimit(sessionId: string, type: 'image' | 'video' | 'avatar'): Promise<{
    allowed: boolean;
    remaining: number;
    current: number;
    limit: number;
  }> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const key = `${sessionId}_${today}`;

    // Get or create usage record for today
    let usage = this.data.get(key);

    if (!usage) {
      usage = {
        session_id: sessionId,
        date: today,
        image_count: 0,
        video_count: 0,
        avatar_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.data.set(key, usage);
      await this.saveData();
    }
    
    // console.log(`[SessionUsage] Check ${type}: sessionId=${sessionId}, key=${key}, current=${this.getCurrentCount(usage, type)}, limit=${this.DAILY_LIMITS[type]}`);

    const currentCount = this.getCurrentCount(usage, type);
    const limit = this.DAILY_LIMITS[type];
    const remaining = Math.max(0, limit - currentCount);

    return {
      allowed: currentCount < limit,
      remaining,
      current: currentCount,
      limit
    };
  }

  async incrementUsage(sessionId: string, type: 'image' | 'video' | 'avatar'): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const key = `${sessionId}_${today}`;

    // Check if increment is allowed
    const check = await this.checkUsageLimit(sessionId, type);
    if (!check.allowed) {
      throw new Error(
        `Daily limit exceeded for ${type}. Current: ${check.current}, Limit: ${this.DAILY_LIMITS[type]}`
      );
    }

    // Increment the count
    const usage = this.data.get(key);
    if (usage) {
      (usage as any)[`${type}_count`] += 1;
      usage.updated_at = new Date().toISOString();
      await this.saveData();
    }
  }

  async getUsage(sessionId: string, date: string): Promise<SessionUsage | null> {
    const key = `${sessionId}_${date}`;
    return this.data.get(key) || null;
  }

  async getSessionUsageHistory(sessionId: string, days: number = 7): Promise<SessionUsage[]> {
    const history: SessionUsage[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const key = `${sessionId}_${dateStr}`;
      const usage = this.data.get(key);
      if (usage) {
        history.push(usage);
      }
    }

    return history;
  }

  async getDailyStats(date?: string): Promise<UsageStats> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const todayUsages: SessionUsage[] = [];

    // Collect all usages for the target date
    for (const [key, usage] of this.data) {
      if (usage.date === targetDate) {
        todayUsages.push(usage);
      }
    }

    // Calculate stats
    const totalSessions = this.data.size;
    const activeSessionsToday = todayUsages.length;
    const totalImagesToday = todayUsages.reduce((sum, u) => sum + u.image_count, 0);
    const totalVideosToday = todayUsages.reduce((sum, u) => sum + u.video_count, 0);
    const totalAvatarsToday = todayUsages.reduce((sum, u) => sum + u.avatar_count, 0);

    const avgImages = activeSessionsToday > 0 ? totalImagesToday / activeSessionsToday : 0;
    const avgVideos = activeSessionsToday > 0 ? totalVideosToday / activeSessionsToday : 0;
    const avgAvatars = activeSessionsToday > 0 ? totalAvatarsToday / activeSessionsToday : 0;

    return {
      total_sessions: totalSessions,
      active_sessions_today: activeSessionsToday,
      total_images_today: totalImagesToday,
      total_videos_today: totalVideosToday,
      total_avatars_today: totalAvatarsToday,
      avg_images_per_session: avgImages,
      avg_videos_per_session: avgVideos,
      avg_avatars_per_session: avgAvatars
    };
  }

  async getRangeStats(startDate: string, endDate: string): Promise<any[]> {
    const statsMap = new Map<string, any>();

    // Collect usages for each date in range
    for (const [key, usage] of this.data) {
      if (usage.date >= startDate && usage.date <= endDate) {
        if (!statsMap.has(usage.date)) {
          statsMap.set(usage.date, {
            date: usage.date,
            active_sessions: 0,
            total_images: 0,
            total_videos: 0,
            total_avatars: 0,
            avg_images: 0,
            avg_videos: 0,
            avg_avatars: 0,
            sessions: []
          });
        }

        const stats = statsMap.get(usage.date);
        stats.active_sessions++;
        stats.total_images += usage.image_count;
        stats.total_videos += usage.video_count;
        stats.total_avatars += usage.avatar_count;
        stats.sessions.push(usage);
      }
    }

    // Calculate averages and convert to array
    const stats = Array.from(statsMap.values());
    stats.forEach(s => {
      s.avg_images = s.active_sessions > 0 ? s.total_images / s.active_sessions : 0;
      s.avg_videos = s.active_sessions > 0 ? s.total_videos / s.active_sessions : 0;
      s.avg_avatars = s.active_sessions > 0 ? s.total_avatars / s.active_sessions : 0;
      delete s.sessions; // Remove temporary sessions array
    });

    return stats.sort((a, b) => b.date.localeCompare(a.date));
  }

  async cleanupOldRecords(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    let deletedCount = 0;
    const keysToDelete: string[] = [];

    for (const [key, usage] of this.data) {
      if (usage.date < cutoffDateStr) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.data.delete(key);
      deletedCount++;
    });

    if (deletedCount > 0) {
      await this.saveData();
    }

    return deletedCount;
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
    await this.saveData();
  }
}

// Singleton instance
export const sessionUsageDB = new MemoryUsageDB();