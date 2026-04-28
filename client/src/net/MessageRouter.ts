import type { ServerMessage } from '@stargazing/shared';

type Handler<T extends ServerMessage['type']> = (
  payload: Extract<ServerMessage, { type: T }>['payload'],
) => void;

// Each message type can have one handler. Add more flexibility (multi-handler,
// middleware, etc.) only when you actually need it.
export class MessageRouter {
  private handlers = new Map<string, (payload: unknown) => void>();

  on<T extends ServerMessage['type']>(type: T, handler: Handler<T>): void {
    this.handlers.set(type, handler as (payload: unknown) => void);
  }

  dispatch(msg: ServerMessage): void {
    const handler = this.handlers.get(msg.type);
    if (handler) handler(msg.payload);
  }
}