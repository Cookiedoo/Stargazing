import { SERVER_WS } from '../config.js';
import type { ClientMessage, ServerMessage } from '@stargazing/shared';

type MessageHandler = (msg: ServerMessage) => void;

export class SocketClient {
  private ws: WebSocket | null = null;
  private handlers = new Set<MessageHandler>();
  private code: string;

  constructor(code: string) {
    this.code = code;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${SERVER_WS}/room/${this.code}/join`);

      this.ws.addEventListener('open', () => resolve());
      this.ws.addEventListener('error', (e) => reject(e));

      this.ws.addEventListener('message', (event) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        for (const h of this.handlers) h(msg);
      });

      this.ws.addEventListener('close', () => {
        // TODO Sprint 3: reconnect with exponential backoff,
        //   replay buffered inputs, request snapshot.
      });
    });
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(msg));
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.handlers.clear();
  }
}