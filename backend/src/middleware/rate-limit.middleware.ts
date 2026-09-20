import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { config } from '../config/index.js';

const isHealthOrOptions = (req: Request): boolean => {
  if (req.method === 'OPTIONS') return true;
  const path = req.path || '';
  const originalUrl = req.originalUrl || '';
  return path === '/health' || path.endsWith('/health') || originalUrl.includes('/health');
};

/**
 * General read rate limiter (e.g. GET requests, queries).
 * Configurable via RATE_LIMIT_MAX (default: 3000 / 15m) and RATE_LIMIT_WINDOW_MS.
 */
export const readLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRead,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isHealthOrOptions,
  message: {
    error: 'Too many requests, please try again later.',
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests, please try again later.',
      retryAfter: res.getHeader('Retry-After') || Math.ceil(config.rateLimit.windowMs / 1000),
    });
  },
});

/**
 * Stricter rate limiter for write/mutation requests (e.g. POST, PUT, DELETE).
 * Configurable via RATE_LIMIT_MAX_WRITE (default: 120 / 15m).
 */
export const writeLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxWrite,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isHealthOrOptions,
  message: {
    error: 'Too many requests, please try again later.',
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests, please try again later.',
      retryAfter: res.getHeader('Retry-After') || Math.ceil(config.rateLimit.windowMs / 1000),
    });
  },
});

// Alias apiLimiter to readLimiter for backwards compatibility
export const apiLimiter = readLimiter;
