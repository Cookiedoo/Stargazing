import { Group } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export class AssetLoader {
  private gltfLoader: GLTFLoader;
  private cache: Map<string, Promise<Group>> = new Map();

  constructor() {
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(draco);
  }

  async loadGLB(url: string): Promise<Group> {
    let promise = this.cache.get(url);
    if (!promise) {
      promise = new Promise<Group>((resolve, reject) => {
        this.gltfLoader.load(
          url,
          (gltf) => resolve(gltf.scene),
          undefined,
          (err) => reject(err),
        );
      });
      this.cache.set(url, promise);
    }
    const original = await promise;
    return original.clone(true);
  }
}

export const assets = new AssetLoader();