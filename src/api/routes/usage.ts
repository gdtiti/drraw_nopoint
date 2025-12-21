import Request from '@/lib/request/Request.ts';
import { sessionUsageDB } from '@/lib/database/session-usage-memory';

export default {
  prefix: '/usage',

  get: {
    // 获取每日使用统计
    '/stats': async (request: Request) => {
      const date = request.query.date as string;
      const stats = await sessionUsageDB.getDailyStats(date);

      return {
        success: true,
        data: stats,
        date: date || new Date().toISOString().split('T')[0]
      };
    },

    // 获取特定session的使用情况
    '/session/:sessionId': async (request: Request, params: any) => {
      const { sessionId } = params;
      const date = request.query.date as string;

      const usage = await sessionUsageDB.getUsage(sessionId, date);

      if (!usage) {
        return {
          success: true,
          data: {
            session_id: sessionId,
            date: date || new Date().toISOString().split('T')[0],
            image_count: 0,
            video_count: 0,
            avatar_count: 0,
            remaining_images: 10,
            remaining_videos: 2,
            remaining_avatars: 1
          }
        };
      }

      // Add remaining counts
      const data = {
        ...usage,
        remaining_images: Math.max(0, 10 - usage.image_count),
        remaining_videos: Math.max(0, 2 - usage.video_count),
        remaining_avatars: Math.max(0, 1 - usage.avatar_count)
      };

      return {
        success: true,
        data
      };
    },

    // 获取session使用历史
    '/session/:sessionId/history': async (request: Request, params: any) => {
      const { sessionId } = params;
      const days = parseInt(request.query.days as string) || 7;

      const history = await sessionUsageDB.getSessionUsageHistory(sessionId, days);

      // Add remaining counts to each record
      const historyWithRemaining = history.map(record => ({
        ...record,
        remaining_images: Math.max(0, 10 - record.image_count),
        remaining_videos: Math.max(0, 2 - record.video_count),
        remaining_avatars: Math.max(0, 1 - record.avatar_count)
      }));

      return {
        success: true,
        data: {
          session_id: sessionId,
          days,
          history: historyWithRemaining
        }
      };
    },

    // 获取日期范围统计
    '/range': async (request: Request) => {
      const { start, end } = request.query;

      if (!start || !end) {
        throw new Error('Start and end dates are required');
      }

      const stats = await sessionUsageDB.getRangeStats(
        start as string,
        end as string
      );

      return {
        success: true,
        data: {
          start_date: start,
          end_date: end,
          daily_stats: stats
        }
      };
    },

    // 导出CSV
    '/export': async (request: Request) => {
      const { start, end } = request.query;
      const today = new Date().toISOString().split('T')[0];
      const startDate = start as string || today;
      const endDate = end as string || today;

      const stats = await sessionUsageDB.getRangeStats(startDate, endDate);

      // Generate CSV
      let csv = 'Date,Active Sessions,Total Images,Total Videos,Total Avatars,Avg Images per Session,Avg Videos per Session,Avg Avatars per Session\n';

      stats.forEach((row: any) => {
        csv += `${row.date},${row.active_sessions},${row.total_images},${row.total_videos},${row.total_avatars},${row.avg_images || 0},${row.avg_videos || 0},${row.avg_avatars || 0}\n`;
      });

      // Return CSV data (note: in a real implementation, you might want to set proper headers)
      return {
        success: true,
        data: {
          filename: `usage_stats_${startDate}_to_${endDate}.csv`,
          content: csv
        }
      };
    }
  },

  post: {
    // 清理旧记录
    '/cleanup': async (request: Request) => {
      const { days_to_keep = 30 } = request.body;

      const deletedRecords = await sessionUsageDB.cleanupOldRecords(days_to_keep);

      return {
        success: true,
        data: {
          deleted_records: deletedRecords,
          days_kept: days_to_keep
        }
      };
    }
  }
};