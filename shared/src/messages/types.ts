// Every message on the wire has this envelope.
export interface Envelope<T extends string, P> {
  type: T;
  payload: P;
}

export type HelloMessage = Envelope<"hello", { text: string; from: string }>;
export type WelcomeMessage = Envelope<
  "welcome",
  { yourId: string; roomCode: string; players: string[] }
>;
export type PlayerJoinedMessage = Envelope<"player_joined", { id: string }>;
export type PlayerLeftMessage = Envelope<"player_left", { id: string }>;

export type InputMessage = Envelope<
  "input",
  {
    thrust: number;
    brake: number;
    strafe: number;
    pitch: number;
    boost: boolean;
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
  heading: number;
  pitch: number;
  bank: number;
  thrustLevel: number;
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
