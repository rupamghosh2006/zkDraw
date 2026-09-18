import { createApp } from './app.js';
import { config } from './config/index.js';
import { escrowService } from './services/escrow.service.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`====================================================`);
  console.log(` zkDraw Backend Service running on port ${config.port} `);
  console.log(` Network: ${config.network} | Contract: ${config.contractAddress.slice(0, 10)}... `);
  console.log(` Health check: http://localhost:${config.port}/api/health `);
  console.log(`====================================================`);
});

const handleShutdown = (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  escrowService.cleanup();

  server.close(() => {
    console.log('HTTP server closed successfully.');
    process.exit(0);
  });

  // Force close after 5 seconds if lingering connections remain
  setTimeout(() => {
    console.warn('Forced shutdown after 5s timeout.');
    process.exit(1);
  }, 5000).unref();
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

