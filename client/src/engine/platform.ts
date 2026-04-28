export type GpuTier = "low" | "medium" | "high";

export interface PlatformInfo {
  isMobile: boolean;
  isTouch: boolean;
  pixelRatio: number;
  gpuTier: GpuTier;
}

export function detectPlatform(): PlatformInfo {
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const gpuTier: GpuTier = isMobile ? "low" : "medium";
  return { isMobile, isTouch, pixelRatio, gpuTier };
}
