// Every message on the wire has this envelope.
export interface Envelope<T extends string, P> {
  type: T;
  payload: P;
}

// --- Sprint 1: presence + chat ---
export type HelloMessage = Envelope<"hello", { text: string; from: string }>;
export type WelcomeMessage = Envelope<
  "welcome",
  { yourId: string; roomCode: string; players: string[] }
>;
export type PlayerJoinedMessage = Envelope<"player_joined", { id: string }>;
export type PlayerLeftMessage = Envelope<"player_left", { id: string }>;

// --- Sprint 2.5: simulation ---
// Client tells the server its current input each frame. Server validates.
export type InputMessage = Envelope<
  "input",
  {
    thrust: number;
    strafe: number;
    // Client tick when this input was generated. Used Sprint 3 for reconciliation.
    clientTick: number;
  }
>;

export interface ShipSnapshotWire {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  lastInputTick: number;
}
export type SnapshotMessage = Envelope<
  "snapshot",
  {
    tick: number;
    ships: ShipSnapshotWire[];
  }
>;

export type ServerMessage =
  | WelcomeMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | HelloMessage
  | SnapshotMessage;

export type ClientMessage = HelloMessage | InputMessage;

export const MSG = {
  HELLO: "hello",
  WELCOME: "welcome",
  PLAYER_JOINED: "player_joined",
  PLAYER_LEFT: "player_left",
  INPUT: "input",
  SNAPSHOT: "snapshot",
} as const;
