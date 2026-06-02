export class FPSCounter {
  private lastTime = performance.now();
  private frames = 0;
  private fps = 60; // Initial fallback

  public update() {
    this.frames++;
    const now = performance.now();
    if (now >= this.lastTime + 1000) {
      this.fps = Math.round((this.frames * 1000) / (now - this.lastTime));
      this.frames = 0;
      this.lastTime = now;
    }
  }

  public getFPS(): number {
    return this.fps;
  }
}
