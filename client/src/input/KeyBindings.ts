export const KEY_BINDINGS = {
  THRUST:     ['Space'],
  BRAKE:      ['KeyB'],
  PITCH_UP:   ['KeyS'],
  PITCH_DOWN: ['KeyW'],
  YAW_LEFT:   ['KeyA', 'ArrowLeft'],
  YAW_RIGHT:  ['KeyD', 'ArrowRight'],
  INTERACT:   ['KeyE'],
  BOOST:      ['ShiftLeft', 'ShiftRight'],
  FIRE_ALT:   ['KeyP'],
} as const;

export type ActionName = keyof typeof KEY_BINDINGS;