import type { ShipInput } from "@stargazing/shared";

interface BufferedInput {
  clientTick: number;
  input: ShipInput;
  dt: number;
}

export class InputBuffer {
  private entries: BufferedInput[] = [];

  push(clientTick: number, input: ShipInput, dt: number): void {
    this.entries.push({ clientTick, input, dt });

    if (this.entries.length > 240) this.entries.shift();
  }

  ackUpTo(clientTick: number): void {
    let i = 0;
    while (
      i < this.entries.length &&
      this.entries[i].clientTick <= clientTick
    ) {
      i++;
    }
    if (i > 0) this.entries.splice(0, i);
  }

  all(): readonly BufferedInput[] {
    return this.entries;
  }

  clear(): void {
    this.entries.length = 0;
  }
}
