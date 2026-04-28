import type { Texture } from "three";

interface CachedAsset {
  // TODO Sprint 3: union type for GLB/Texture/AudioBuffer
  asset: Texture | unknown;
  refCount: number;
}

export class AssetLoader {
  private cache = new Map<string, CachedAsset>();

  // TODO Sprint 3: implement loadGLB with GLTFLoader + DRACOLoader.
  //   Pattern: return cached promise if already loading,
  //   return cached asset if loaded, otherwise kick off load.

  // TODO Sprint 3: implement loadTexture with TextureLoader.

  // TODO Sprint 5: implement loadAudio (Howler integration).

  release(key: string): void {
    const entry = this.cache.get(key);
    if (!entry) return;
    entry.refCount--;
    if (entry.refCount <= 0) {
      this.cache.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
  }
}
