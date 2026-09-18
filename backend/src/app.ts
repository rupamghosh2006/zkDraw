import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import routes from './routes/index.js';
import { errorHandler } from './middleware/error.middleware.js';
import { apiLimiter } from './middleware/rate-limit.middleware.js';
import { config } from './config/index.js';

export const createApp = () => {
  const app = express();

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

  // Global rate limiter
  app.use('/api', apiLimiter);

  // Mount API router
  app.use('/api', routes);

  // Root landing info
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'zkDraw Confidential Lottery API',
      status: 'active',
      docs: '/api/health',
      network: config.network,
    });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
};
