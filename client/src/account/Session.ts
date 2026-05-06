import { authGuest, authLogin, authLogout, authRegister, type ApiAccount } from './AuthApi.js';

type Listener = (account: ApiAccount | null) => void;

class SessionManager {
  private account: ApiAccount | null = null;
  private listeners: Set<Listener> = new Set();
  private bootPromise: Promise<void> | null = null;

  boot(): Promise<void> {
    if (this.bootPromise) return this.bootPromise;
    this.bootPromise = (async () => {
      try {
        const { account } = await authGuest();
        this.set(account);
      } catch (err) {
        console.error('Session.boot failed:', err);
        this.set(null);
      }
    })();
    return this.bootPromise;
  }

  get current(): ApiAccount | null {
    return this.account;
  }

  get isAuthenticated(): boolean {
    return this.account !== null;
  }

  get isGuest(): boolean {
    return this.account?.isGuest === true;
  }

  get displayName(): string {
    if (!this.account) return 'Guest';
    return this.account.username ?? `Guest-${this.account.id.slice(0, 4)}`;
  }

  async register(username: string, password: string): Promise<void> {
    const { account } = await authRegister(username, password);
    this.set(account);
  }

  async login(username: string, password: string): Promise<void> {
    const { account } = await authLogin(username, password);
    this.set(account);
  }

  async logout(): Promise<void> {
    await authLogout();
    this.set(null);
    this.bootPromise = null;
    await this.boot();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.account);
    return () => this.listeners.delete(listener);
  }

  private set(account: ApiAccount | null): void {
    this.account = account;
    for (const l of this.listeners) l(account);
  }
}

export const session = new SessionManager();