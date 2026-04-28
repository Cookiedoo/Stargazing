export interface Screen {
  enter(root: HTMLElement): void | Promise<void>;
  exit(): void | Promise<void>;
}

export class ScreenManager {
  private root: HTMLElement;
  private current: Screen | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async go(next: Screen): Promise<void> {
    if (this.current) {
      await this.current.exit();
    }
    this.root.innerHTML = ''; // TODO Sprint 5: animated transitions
    this.current = next;
    await next.enter(this.root);
  }
}