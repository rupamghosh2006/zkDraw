import http from 'node:http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { escrowService } from './services/escrow.service.js';
import { wsServer } from './websocket/server.js';
import { lotteryService } from './services/lottery.service.js';

const app = createApp();
const server = http.createServer(app);

// Initialize WebSocket server on /ws sharing the HTTP server
wsServer.init(server, {
  getLotteries: (network) => lotteryService.getAllLotteries(network),
  getLotteryById: (id) => lotteryService.getLotteryById(id),
});

// Centralized background on-chain sync pushes updates to connected WS clients
lotteryService.startBackgroundSync(10_000);

server.listen(config.port, () => {
  console.log(`====================================================`);
  console.log(` zkDraw Backend Service running on port ${config.port} `);
  console.log(` Network: ${config.network} | Contract: ${config.contractAddress.slice(0, 10)}... `);
  console.log(` Health check: http://localhost:${config.port}/api/health `);
  console.log(` WebSocket:    ws://localhost:${config.port}/ws `);
  console.log(`====================================================`);
});

const handleShutdown = (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  lotteryService.stopBackgroundSync();
  wsServer.close();
  escrowService.cleanup();

  server.close(() => {
    console.log('HTTP & WebSocket server closed successfully.');
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
