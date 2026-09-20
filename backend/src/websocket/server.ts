import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'node:http';
import type { Lottery } from '../types/index.js';
import { randomUUID } from 'node:crypto';

export interface ClientSubscription {
  id: string;
  ws: WebSocket;
  isAlive: boolean;
  network?: string;
  subscribedAll: boolean;
  subscribedLotteries: Set<string>;
}

export type WsClientMessage =
  | { type: 'SUBSCRIBE_LOTTERIES'; network?: string }
  | { type: 'UNSUBSCRIBE_LOTTERIES' }
  | { type: 'SUBSCRIBE_LOTTERY'; lotteryId: string }
  | { type: 'UNSUBSCRIBE_LOTTERY'; lotteryId: string }
  | { type: 'PING' };

export type WsServerMessage =
  | { type: 'CONNECTED'; clientId: string }
  | { type: 'PONG' }
  | { type: 'LOTTERY_UPDATED'; lottery: Lottery }
  | { type: 'LOTTERIES_LIST'; network: string; lotteries: Lottery[] }
  | { type: 'ERROR'; message: string };

export class ZkDrawWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ClientSubscription> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private getLotteriesCallback?: (network?: string) => Promise<Lottery[]>;
  private getLotteryByIdCallback?: (id: string) => Promise<Lottery | null>;

  public init(
    httpServer: HttpServer,
    handlers?: {
      getLotteries?: (network?: string) => Promise<Lottery[]>;
      getLotteryById?: (id: string) => Promise<Lottery | null>;
    },
  ): WebSocketServer {
    if (handlers?.getLotteries) this.getLotteriesCallback = handlers.getLotteries;
    if (handlers?.getLotteryById) this.getLotteryByIdCallback = handlers.getLotteryById;

    this.wss = new WebSocketServer({
      server: httpServer,
      path: '/ws',
    });

    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    // 30-second ping/pong heartbeat to keep connections alive on Render / proxies
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, id) => {
        if (!client.isAlive) {
          client.ws.terminate();
          this.clients.delete(id);
          return;
        }
        client.isAlive = false;
        client.ws.ping();
      });
    }, 30_000);

    console.log('[WebSocket] Server initialized on path /ws');
    return this.wss;
  }

  private handleConnection(ws: WebSocket): void {
    const clientId = randomUUID();
    const subscription: ClientSubscription = {
      id: clientId,
      ws,
      isAlive: true,
      subscribedAll: false,
      subscribedLotteries: new Set(),
    };

    this.clients.set(clientId, subscription);

    ws.on('pong', () => {
      subscription.isAlive = true;
    });

    ws.on('message', async (data: string | Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as WsClientMessage;
        await this.handleMessage(subscription, msg);
      } catch (err) {
        this.send(subscription.ws, {
          type: 'ERROR',
          message: 'Invalid message format. Expected JSON.',
        });
      }
    });

    ws.on('close', () => {
      this.clients.delete(clientId);
    });

    ws.on('error', () => {
      this.clients.delete(clientId);
    });

    // Send initial handshake
    this.send(ws, { type: 'CONNECTED', clientId });
  }

  private async handleMessage(client: ClientSubscription, msg: WsClientMessage): Promise<void> {
    client.isAlive = true;

    switch (msg.type) {
      case 'PING': {
        this.send(client.ws, { type: 'PONG' });
        break;
      }

      case 'SUBSCRIBE_LOTTERIES': {
        client.subscribedAll = true;
        client.network = msg.network;

        // Immediately push current lotteries if handler is available
        if (this.getLotteriesCallback) {
          try {
            const list = await this.getLotteriesCallback(msg.network);
            this.send(client.ws, {
              type: 'LOTTERIES_LIST',
              network: msg.network || 'all',
              lotteries: list,
            });
          } catch {}
        }
        break;
      }

      case 'UNSUBSCRIBE_LOTTERIES': {
        client.subscribedAll = false;
        break;
      }

      case 'SUBSCRIBE_LOTTERY': {
        if (msg.lotteryId) {
          client.subscribedLotteries.add(msg.lotteryId.toLowerCase());

          // Immediately push current lottery state if handler is available
          if (this.getLotteryByIdCallback) {
            try {
              const lottery = await this.getLotteryByIdCallback(msg.lotteryId);
              if (lottery) {
                this.send(client.ws, {
                  type: 'LOTTERY_UPDATED',
                  lottery,
                });
              }
            } catch {}
          }
        }
        break;
      }

      case 'UNSUBSCRIBE_LOTTERY': {
        if (msg.lotteryId) {
          client.subscribedLotteries.delete(msg.lotteryId.toLowerCase());
        }
        break;
      }
    }
  }

  private send(ws: WebSocket, msg: WsServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  /**
   * Broadcast an updated lottery state to interested clients
   */
  public broadcastLotteryUpdated(lottery: Lottery): void {
    const lotteryId = lottery.id.toLowerCase();
    const contractAddr = lottery.contractAddress?.toLowerCase();
    const net = lottery.network;

    const payload: WsServerMessage = {
      type: 'LOTTERY_UPDATED',
      lottery,
    };

    const str = JSON.stringify(payload);

    this.clients.forEach((client) => {
      if (client.ws.readyState !== WebSocket.OPEN) return;

      const matchesLottery =
        client.subscribedLotteries.has(lotteryId) ||
        (contractAddr && client.subscribedLotteries.has(contractAddr));

      const matchesAll =
        client.subscribedAll && (!client.network || client.network === net);

      if (matchesLottery || matchesAll) {
        client.ws.send(str);
      }
    });
  }

  /**
   * Broadcast complete lotteries list to subscribers
   */
  public broadcastLotteryList(network: string, lotteries: Lottery[]): void {
    const payload: WsServerMessage = {
      type: 'LOTTERIES_LIST',
      network,
      lotteries,
    };
    const str = JSON.stringify(payload);

    this.clients.forEach((client) => {
      if (client.ws.readyState !== WebSocket.OPEN) return;
      if (client.subscribedAll && (!client.network || client.network === network)) {
        client.ws.send(str);
      }
    });
  }

  public getConnectedClientCount(): number {
    return this.clients.size;
  }

  public close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.clients.forEach((client) => {
      client.ws.close();
    });
    this.clients.clear();
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }
}

export const wsServer = new ZkDrawWebSocketServer();
