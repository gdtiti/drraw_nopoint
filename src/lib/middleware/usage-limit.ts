import { Request, Response, NextFunction } from 'express';
import { sessionUsageDB } from '../database/session-usage-memory';

export interface UsageLimitResponse {
  allowed: boolean;
  remaining: number;
  current: number;
  limit: number;
  type: 'image' | 'video' | 'avatar';
}

export const DAILY_LIMITS = {
  image: 10,
  video: 2,
  avatar: 1
};

/**
 * Middleware to check daily usage limits for a session
 * @param type The type of content being generated
 * @returns Middleware function
 */
export function checkDailyUsageLimit(type: 'image' | 'video' | 'avatar') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get session_id from request headers, query params, or body
      const sessionId = getSessionId(req);

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'session_id is required',
          code: 'SESSION_ID_MISSING'
        });
      }

      // Check current usage
      const usage = await sessionUsageDB.checkUsageLimit(sessionId, type);

      // Add usage info to response headers
      res.set({
        'X-Usage-Type': type,
        'X-Usage-Limit': DAILY_LIMITS[type].toString(),
        'X-Usage-Current': usage.current.toString(),
        'X-Usage-Remaining': usage.remaining.toString(),
        'X-Session-ID': sessionId
      });

      if (!usage.allowed) {
        return res.status(429).json({
          success: false,
          error: `Daily limit exceeded for ${type} generation`,
          code: 'DAILY_LIMIT_EXCEEDED',
          data: {
            type,
            limit: DAILY_LIMITS[type],
            current: usage.current,
            remaining: usage.remaining
          }
        });
      }

      // Add usage info to request for later use
      (req as any).usageInfo = {
        type,
        sessionId,
        ...usage
      };

      next();
    } catch (error) {
      console.error('Error checking usage limit:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to check usage limit',
        code: 'USAGE_CHECK_ERROR'
      });
    }
  };
}

/**
 * Middleware to increment usage count after successful generation
 */
export function incrementUsage() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original send function
    const originalSend = res.send;

    // Override send to intercept response
    res.send = function(data: any) {
      // Only increment if response is successful
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const usageInfo = (req as any).usageInfo;
        if (usageInfo) {
          // Increment usage asynchronously
          sessionUsageDB.incrementUsage(usageInfo.sessionId, usageInfo.type)
            .catch(error => {
              console.error('Error incrementing usage:', error);
              // Don't fail the response, just log the error
            });
        }
      }

      // Call original send
      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Extract session_id from various sources
 */
function getSessionId(req: Request): string | null {
  // Try to get from header first
  const sessionIdFromHeader = req.headers['x-session-id'] as string;
  if (sessionIdFromHeader) {
    return sessionIdFromHeader;
  }

  // Try to get from query parameter
  const sessionIdFromQuery = req.query.session_id as string;
  if (sessionIdFromQuery) {
    return sessionIdFromQuery;
  }

  // Try to get from request body
  const sessionIdFromBody = req.body?.session_id;
  if (sessionIdFromBody) {
    return sessionIdFromBody;
  }

  // Try to get from refresh_token (create a hash as session_id)
  const refreshToken = req.body?.refresh_token;
  if (refreshToken) {
    // Create a simple hash from refresh_token to use as session_id
    // This ensures same refresh_token gets same session_id
    return createSessionIdFromToken(refreshToken);
  }

  return null;
}

/**
 * Create a consistent session_id from refresh_token
 */
function createSessionIdFromToken(token: string): string {
  // Simple hash function - in production, you might want to use crypto
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `session_${Math.abs(hash)}`;
}

/**
 * Get current usage for a session
 */
export async function getSessionUsage(sessionId: string, date?: string) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  return await sessionUsageDB.getUsage(sessionId, targetDate);
}

/**
 * Get usage statistics for API response
 */
export async function getUsageStats(date?: string) {
  return await sessionUsageDB.getDailyStats(date);
}

/**
 * Get usage history for a session
 */
export async function getSessionHistory(sessionId: string, days: number = 7) {
  return await sessionUsageDB.getSessionUsageHistory(sessionId, days);
}