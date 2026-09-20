import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import routes from './routes/index.js';
import { errorHandler } from './middleware/error.middleware.js';
import { apiLimiter, writeLimiter } from './middleware/rate-limit.middleware.js';
import { config } from './config/index.js';

export const createApp = () => {
  const app = express();

  // Reverse proxy support (prevents IP collapsing on Render, Railway, Fly, Nginx, Cloudflare)
  app.set('trust proxy', config.trustProxy);

  // Response compression (gzip/deflate)
  app.use(compression());

  // Security & standard headers
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigin === '*' ? true : config.corsOrigin,
      credentials: true,
    }),
  );

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Separate read vs write rate limiting
  // Write methods (POST, PUT, DELETE, PATCH) get writeLimiter
  app.use('/api', (req, res, next) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      return writeLimiter(req, res, next);
    }
    return apiLimiter(req, res, next);
  });

  // Mount API router
  app.use('/api', routes);

  // Root landing info
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'zkDraw Confidential Lottery API',
      status: 'active',
      docs: '/api/health',
      ws: '/ws',
      network: config.network,
    });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
};
