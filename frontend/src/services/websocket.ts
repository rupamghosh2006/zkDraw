import type { Lottery, MidnightNetwork } from '../types/index.js';

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

export type LotteryUpdateListener = (lottery: Lottery) => void;
export type LotteriesListListener = (lotteries: Lottery[]) => void;
export type StatusChangeListener = (status: WsStatus) => void;

function getWsUrl(): string {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname.includes('vercel.app')) {
      return 'wss://zkdraw.onrender.com/ws';
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }
  return 'ws://localhost:3001/ws';
}

class ZkDrawWsClient {
  private ws: WebSocket | null = null;
  private status: WsStatus = 'disconnected';
  private reconnectTimer: any = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 15000;
  private isExplicitlyClosed = false;

  // Active subscriptions
  private lotteriesSubscribers: Map<string, { network?: string; onUpdate: LotteryUpdateListener; onList?: LotteriesListListener }> = new Map();
  private singleLotterySubscribers: Map<string, Set<LotteryUpdateListener>> = new Map();
  private statusListeners: Set<StatusChangeListener> = new Set();

  constructor() {
    // Automatically connect on client side
    if (typeof window !== 'undefined') {
      this.connect();
    }
  }

  public getStatus(): WsStatus {
    return this.status;
  }

  public isConnected(): boolean {
    return this.status === 'connected';
  }

  public onStatusChange(listener: StatusChangeListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private setStatus(newStatus: WsStatus): void {
    if (this.status === newStatus) return;
    this.status = newStatus;
    this.statusListeners.forEach((fn) => {
      try {
        fn(newStatus);
      } catch (err) {
        console.warn('[WS] Status listener error:', err);
      }
    });
  }

  public connect(): void {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;
    this.setStatus('connecting');

    try {
      const url = getWsUrl();
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.setStatus('connected');
        this.reconnectDelay = 1000; // Reset backoff

        // Re-establish all active subscriptions
        this.resubscribeAll();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (err) {
          console.warn('[WS] Received unparseable message:', err);
        }
      };

      this.ws.onclose = () => {
        this.setStatus('disconnected');
        this.ws = null;
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.setStatus('disconnected');
        if (this.ws) {
          try {
            this.ws.close();
          } catch {}
          this.ws = null;
        }
      };
    } catch (err) {
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
      this.connect();
    }, this.reconnectDelay);
  }

  private send(msg: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private resubscribeAll(): void {
    // 1. All lotteries subscribers
    if (this.lotteriesSubscribers.size > 0) {
      // Find networks requested
      const networks = new Set<string>();
      this.lotteriesSubscribers.forEach((sub) => {
        networks.add(sub.network || 'all');
      });
      networks.forEach((net) => {
        this.send({
          type: 'SUBSCRIBE_LOTTERIES',
          network: net === 'all' ? undefined : net,
        });
      });
    }

    // 2. Specific lotteries subscribers
    this.singleLotterySubscribers.forEach((listeners, lotteryId) => {
      if (listeners.size > 0) {
        this.send({
          type: 'SUBSCRIBE_LOTTERY',
          lotteryId,
        });
      }
    });
  }

  private handleServerMessage(msg: any): void {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'LOTTERY_UPDATED': {
        const lottery = msg.lottery as Lottery;
        if (!lottery || !lottery.id) return;

        const id = lottery.id.toLowerCase();
        const contractAddr = lottery.contractAddress?.toLowerCase();

        // Notify specific lottery listeners
        const idListeners = this.singleLotterySubscribers.get(id);
        if (idListeners) {
          idListeners.forEach((fn) => {
            try {
              fn(lottery);
            } catch (e) {
              console.warn('[WS] Error in single lottery update listener:', e);
            }
          });
        }

        if (contractAddr && contractAddr !== id) {
          const addrListeners = this.singleLotterySubscribers.get(contractAddr);
          if (addrListeners) {
            addrListeners.forEach((fn) => {
              try {
                fn(lottery);
              } catch (e) {
                console.warn('[WS] Error in contract address update listener:', e);
              }
            });
          }
        }

        // Notify general lottery list listeners
        this.lotteriesSubscribers.forEach((sub) => {
          if (!sub.network || sub.network === lottery.network) {
            try {
              sub.onUpdate(lottery);
            } catch (e) {
              console.warn('[WS] Error in lotteries list update listener:', e);
            }
          }
        });
        break;
      }

      case 'LOTTERIES_LIST': {
        const lotteries = (msg.lotteries || []) as Lottery[];
        const network = msg.network;

        this.lotteriesSubscribers.forEach((sub) => {
          if (sub.onList && (!sub.network || sub.network === network || network === 'all')) {
            try {
              sub.onList(lotteries);
            } catch (e) {
              console.warn('[WS] Error in lotteries list listener:', e);
            }
          }
        });
        break;
      }

      case 'CONNECTED': {
        // Connected handshake
        break;
      }

      case 'PONG': {
        break;
      }
    }
  }

  /**
   * Subscribe to live updates for all lotteries on a network
   */
  public subscribeToLotteries(
    network: MidnightNetwork | string,
    onUpdate: LotteryUpdateListener,
    onList?: LotteriesListListener,
  ): () => void {
    const subId = Math.random().toString(36).substring(2, 9);
    this.lotteriesSubscribers.set(subId, { network, onUpdate, onList });

    // Send subscribe message to server
    this.send({
      type: 'SUBSCRIBE_LOTTERIES',
      network: network || undefined,
    });

    return () => {
      this.lotteriesSubscribers.delete(subId);
      if (this.lotteriesSubscribers.size === 0) {
        this.send({ type: 'UNSUBSCRIBE_LOTTERIES' });
      }
    };
  }

  /**
   * Subscribe to live updates for a specific lottery draw
   */
  public subscribeToLottery(
    lotteryId: string,
    onUpdate: LotteryUpdateListener,
  ): () => void {
    const cleanId = lotteryId.toLowerCase();
    let listeners = this.singleLotterySubscribers.get(cleanId);
    if (!listeners) {
      listeners = new Set();
      this.singleLotterySubscribers.set(cleanId, listeners);
    }
    listeners.add(onUpdate);

    // Send subscribe message
    this.send({
      type: 'SUBSCRIBE_LOTTERY',
      lotteryId: cleanId,
    });

    return () => {
      const current = this.singleLotterySubscribers.get(cleanId);
      if (current) {
        current.delete(onUpdate);
        if (current.size === 0) {
          this.singleLotterySubscribers.delete(cleanId);
          this.send({
            type: 'UNSUBSCRIBE_LOTTERY',
            lotteryId: cleanId,
          });
        }
      }
    };
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.setStatus('disconnected');
  }
}

export const wsClient = new ZkDrawWsClient();
