import { createApp } from './app.js';
import { config } from './config/index.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`====================================================`);
  console.log(` zkDraw Backend Service running on port ${config.port} `);
  console.log(` Network: ${config.network} | Contract: ${config.contractAddress.slice(0, 10)}... `);
  console.log(` Health check: http://localhost:${config.port}/api/health `);
  console.log(`====================================================`);
});
