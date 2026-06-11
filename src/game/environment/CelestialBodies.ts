import * as THREE from 'three';
import type { ICelestialBody } from './EnvironmentTypes';

export class SunBody implements ICelestialBody {
  public id = 'sun';
  public light: THREE.DirectionalLight;
  private orbitRadius = 80;
  private zOffset = 15;

  constructor(scene: THREE.Scene) {
    this.light = new THREE.DirectionalLight(0xffffff, 1.2);
    this.light.castShadow = true;

    // Shadow Map Configuration
    this.light.shadow.mapSize.width = 1024;
    this.light.shadow.mapSize.height = 1024;
    this.light.shadow.camera.near = 0.5;
    this.light.shadow.camera.far = 160;

    const d = 40;
    this.light.shadow.camera.left = -d;
    this.light.shadow.camera.right = d;
    this.light.shadow.camera.top = d;
    this.light.shadow.camera.bottom = -d;
    this.light.shadow.bias = -0.0005;

    scene.add(this.light);
  }

  public update(timeRatio: number, playerPos: THREE.Vector3): void {
    const angle = timeRatio * Math.PI * 2;
    const sunAltitude = Math.cos(angle); // Noon at timeRatio = 0 or 1 depending on orbit

    // Calculate position relative to player
    const x = playerPos.x + Math.sin(angle) * this.orbitRadius;
    const y = playerPos.y + Math.cos(angle) * this.orbitRadius;
    const z = playerPos.z + this.zOffset;

    this.light.position.set(x, y, z);
    
    // Look at player position to keep shadow map centered
    this.light.target.position.copy(playerPos);
    this.light.target.updateMatrixWorld();

    // Enable/disable shadow casting dynamically based on altitude to save performance
    this.light.castShadow = sunAltitude > -0.2;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.light);
    this.light.dispose();
  }
}

export class MoonBody implements ICelestialBody {
  public id = 'moon';
  public light: THREE.DirectionalLight;
  private orbitRadius = 80;
  private zOffset = 15;

  constructor(scene: THREE.Scene) {
    // Moonlight has a cool blue/white tone
    this.light = new THREE.DirectionalLight(0xaabbff, 0.4);
    this.light.castShadow = true;

    // Moon Shadow Map (can be lower res or similar)
    this.light.shadow.mapSize.width = 1024;
    this.light.shadow.mapSize.height = 1024;
    this.light.shadow.camera.near = 0.5;
    this.light.shadow.camera.far = 160;

    const d = 40;
    this.light.shadow.camera.left = -d;
    this.light.shadow.camera.right = d;
    this.light.shadow.camera.top = d;
    this.light.shadow.camera.bottom = -d;
    this.light.shadow.bias = -0.0005;

    scene.add(this.light);
  }

  public update(timeRatio: number, playerPos: THREE.Vector3): void {
    // Moon is opposite to the Sun in the sky
    const angle = timeRatio * Math.PI * 2 + Math.PI;
    const moonAltitude = Math.cos(angle);

    const x = playerPos.x + Math.sin(angle) * this.orbitRadius;
    const y = playerPos.y + Math.cos(angle) * this.orbitRadius;
    const z = playerPos.z + this.zOffset;

    this.light.position.set(x, y, z);
    this.light.target.position.copy(playerPos);
    this.light.target.updateMatrixWorld();

    // Enable shadows only when moon is above horizon
    this.light.castShadow = moonAltitude > -0.2;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.light);
    this.light.dispose();
  }
}
