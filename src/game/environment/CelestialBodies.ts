import * as THREE from 'three';
import type { ICelestialBody } from './EnvironmentTypes';

export class SunBody implements ICelestialBody {
  public id = 'sun';
  public light: THREE.DirectionalLight;
  private orbitRadius = 80;
  private zOffset = 15;
  private shadowCameraSize = 64;
  private shadowMapSize = 2048;

  // Cached objects for zero-GC calculations
  private dummyCamera: THREE.OrthographicCamera;
  private lightRight = new THREE.Vector3();
  private lightUpActual = new THREE.Vector3();
  private tempDirection = new THREE.Vector3();
  private lightOffset = new THREE.Vector3();
  private targetPos = new THREE.Vector3();
  private lightPos = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.light = new THREE.DirectionalLight(0xffffff, 1.2);
    this.light.castShadow = true;

    // Shadow Map Configuration - High Resolution (covers ~4 chunks view distance)
    this.light.shadow.mapSize.width = this.shadowMapSize;
    this.light.shadow.mapSize.height = this.shadowMapSize;
    this.light.shadow.camera.near = 0.5;
    this.light.shadow.camera.far = 160;

    const d = this.shadowCameraSize;
    this.light.shadow.camera.left = -d;
    this.light.shadow.camera.right = d;
    this.light.shadow.camera.top = d;
    this.light.shadow.camera.bottom = -d;
    
    // Smooth shadows and bias settings to eliminate acne
    this.light.shadow.bias = -0.001;
    this.light.shadow.normalBias = 0.05;

    // Cache dummy camera to avoid re-allocating it in update() loop
    this.dummyCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    scene.add(this.light);
  }

  public update(timeRatio: number, playerPos: THREE.Vector3): void {
    const angle = timeRatio * Math.PI * 2;
    const sunAltitude = Math.cos(angle); // Noon at timeRatio = 0 or 1 depending on orbit

    // Calculate light offset relative to player
    const sx = Math.sin(angle) * this.orbitRadius;
    const sy = Math.cos(angle) * this.orbitRadius;
    const sz = this.zOffset;
    this.lightOffset.set(sx, sy, sz);

    // Update dummyCamera direction to extract projection basis vectors
    this.dummyCamera.position.copy(this.lightOffset);
    this.dummyCamera.lookAt(0, 0, 0);
    this.dummyCamera.updateMatrixWorld();

    // Extract right and up basis vectors from dummyCamera matrix
    this.dummyCamera.matrixWorld.extractBasis(this.lightRight, this.lightUpActual, this.tempDirection);

    // Calculate snapped offset to prevent shimmering
    const shadowWorldSize = this.shadowCameraSize * 2;
    const texelSize = shadowWorldSize / this.shadowMapSize;

    const px = playerPos.dot(this.lightRight);
    const py = playerPos.dot(this.lightUpActual);

    const snappedPx = Math.floor(px / texelSize) * texelSize;
    const snappedPy = Math.floor(py / texelSize) * texelSize;

    const dx = snappedPx - px;
    const dy = snappedPy - py;

    // Reconstruct snapped target and light positions
    this.targetPos.copy(playerPos)
      .addScaledVector(this.lightRight, dx)
      .addScaledVector(this.lightUpActual, dy);

    this.lightPos.addVectors(this.targetPos, this.lightOffset);

    // Apply snapped positions to light and target
    this.light.position.copy(this.lightPos);
    this.light.target.position.copy(this.targetPos);
    this.light.target.updateMatrixWorld();

    // Adjust shadow bias dynamically based on sun angle to prevent slope acne
    const dynamicBias = -0.001 - 0.002 * (1.0 - Math.max(0.1, sunAltitude));
    this.light.shadow.bias = dynamicBias;

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
    
    // Disable Moon shadow casting for massive performance savings
    this.light.castShadow = false;

    scene.add(this.light);
  }

  public update(timeRatio: number, playerPos: THREE.Vector3): void {
    // Moon is opposite to the Sun in the sky
    const angle = timeRatio * Math.PI * 2 + Math.PI;

    const x = playerPos.x + Math.sin(angle) * this.orbitRadius;
    const y = playerPos.y + Math.cos(angle) * this.orbitRadius;
    const z = playerPos.z + this.zOffset;

    this.light.position.set(x, y, z);
    this.light.target.position.copy(playerPos);
    this.light.target.updateMatrixWorld();

    // Moon shadows are permanently disabled for performance reasons
    this.light.castShadow = false;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.light);
    this.light.dispose();
  }
}
