const isDev = import.meta.env.DEV;

export const SERVER_HTTP = isDev
  ? 'http://localhost:8787'
  : 'https://stargaze-server.bstrongbcookie.workers.dev';

export const SERVER_WS = isDev
  ? 'ws://localhost:8787'
  : 'wss://stargaze-server.bstrongbcookie.workers.dev';