import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { WebSocket } from 'ws';
import { createApp } from '../src/app.js';
import { wsServer } from '../src/websocket/server.js';
import { lotteryService } from '../src/services/lottery.service.js';
import type { Lottery } from '../src/types/index.js';

describe('zkDraw WebSocket Server', () => {
  let server: http.Server;
  let serverPort: number;

  beforeAll(async () => {
    const app = createApp();
    server = http.createServer(app);
    wsServer.init(server, {
      getLotteries: (network) => lotteryService.getAllLotteries(network),
      getLotteryById: (id) => lotteryService.getLotteryById(id),
    });

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          serverPort = addr.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    wsServer.close();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('connects and receives CONNECTED handshake', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws`);

    const message = await new Promise<any>((resolve, reject) => {
      ws.on('open', () => {});
      ws.on('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
      ws.on('error', reject);
    });

    expect(message.type).toBe('CONNECTED');
    expect(message.clientId).toBeDefined();
    ws.close();
  });

  it('handles PING/PONG heartbeat', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws`);

    await new Promise<void>((resolve) => {
      ws.on('open', () => resolve());
    });

    // Send ping
    ws.send(JSON.stringify({ type: 'PING' }));

    const pong = await new Promise<any>((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'PONG') resolve(msg);
      });
    });

    expect(pong.type).toBe('PONG');
    ws.close();
  });

  it('subscribes to lotteries and receives real-time broadcast when state changes', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws`);

    await new Promise<void>((resolve) => {
      ws.on('open', () => resolve());
    });

    // Subscribe
    ws.send(JSON.stringify({ type: 'SUBSCRIBE_LOTTERIES', network: 'preprod' }));

    // Wait for LOTTERIES_LIST
    const listMsg = await new Promise<any>((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'LOTTERIES_LIST') resolve(msg);
      });
    });

    expect(listMsg.type).toBe('LOTTERIES_LIST');
    expect(Array.isArray(listMsg.lotteries)).toBe(true);

    // Setup listener for broadcast
    const broadcastPromise = new Promise<any>((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'LOTTERY_UPDATED') resolve(msg);
      });
    });

    // Trigger broadcast via wsServer
    const mockLottery: Lottery = {
      id: 'ws-test-lottery',
      name: 'WS Test Pot',
      contractAddress: 'f735bb890f2f309372b2dfa37a22515003bf521a243648c3eff2b36721de8959',
      drawId: 0,
      network: 'preprod',
      status: 'OPEN',
      ticketPrice: '1000000',
      prizePool: '11000000',
      rangeMin: 1,
      rangeMax: 50,
      maxTickets: 10,
      ticketCount: 1,
      ticketCommitments: ['abc'],
      participants: [],
      adminKey: '00'.repeat(32),
      creatorAddress: '00'.repeat(32),
      drawCommitment: '00'.repeat(32),
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
    };

    wsServer.broadcastLotteryUpdated(mockLottery);

    const receivedBroadcast = await broadcastPromise;
    expect(receivedBroadcast.type).toBe('LOTTERY_UPDATED');
    expect(receivedBroadcast.lottery.id).toBe('ws-test-lottery');
    expect(receivedBroadcast.lottery.ticketCount).toBe(1);

    ws.close();
  });
});
