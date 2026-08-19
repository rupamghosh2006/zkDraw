import type { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  console.error('[Error Middleware]:', err.message);

  const status = err.message.includes('not found') ? 404 : 400;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
};
