
import * as THREE from 'three';
import { Animal } from './Animal';
import { World } from '@game/world/World';

export class Pig extends Animal {
  public width = 0.9;
  public height = 0.9;
  public depth = 0.9;

  protected walkSpeed = 1.8;
  protected panicSpeed = 5.2;
  protected jumpSpeed = 6.2;

  public hurtSound = 'playPigHurt';
  public deathSound = 'playPigDeath';

  // Static cached textures
  private static pinkTexture: THREE.Texture;
  private static headFrontTexture: THREE.Texture;
  private static snoutFrontTexture: THREE.Texture;
  private static legBottomTexture: THREE.Texture;

  // Leg references for animation
  private frontLeftLeg!: THREE.Mesh;
  private frontRightLeg!: THREE.Mesh;
  private backLeftLeg!: THREE.Mesh;
  private backRightLeg!: THREE.Mesh;

  constructor(id: string, spawnPos: THREE.Vector3, world: World) {
    super(id, spawnPos, world, 10); // 10 Health (5 Hearts)
    this.lootTableId = 'minicraft:entities/pig';
    this.initMesh();
  }

  private static createPixelTexture(drawFn: (ctx: CanvasRenderingContext2D) => void): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    drawFn(ctx);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
  }

  private static initTextures() {
    if (this.pinkTexture) return;

    // 1. Pink Base Texture with noise
    this.pinkTexture = this.createPixelTexture((ctx) => {
      ctx.fillStyle = '#f08ca0';
      ctx.fillRect(0, 0, 16, 16);
      for (let y = 0; y < 16; y += 2) {
        for (let x = 0; x < 16; x += 2) {
          const n = (Math.random() - 0.5) * 15;
          ctx.fillStyle = `rgb(${Math.min(255, Math.max(0, 240 + n))}, ${Math.min(255, Math.max(0, 140 + n))}, ${Math.min(255, Math.max(0, 160 + n))})`;
          ctx.fillRect(x, y, 2, 2);
        }
      }
    });

    // 2. Head Front Texture with Eyes
    this.headFrontTexture = this.createPixelTexture((ctx) => {
      // Base pink noise
      ctx.fillStyle = '#f08ca0';
      ctx.fillRect(0, 0, 16, 16);
      for (let y = 0; y < 16; y += 2) {
        for (let x = 0; x < 16; x += 2) {
          const n = (Math.random() - 0.5) * 15;
          ctx.fillStyle = `rgb(${Math.min(255, Math.max(0, 240 + n))}, ${Math.min(255, Math.max(0, 140 + n))}, ${Math.min(255, Math.max(0, 160 + n))})`;
          ctx.fillRect(x, y, 2, 2);
        }
      }

      // Left Eye
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 8, 4, 3);
      ctx.fillStyle = '#000000';
      ctx.fillRect(2, 8, 2, 3);

      // Right Eye
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(12, 8, 4, 3);
      ctx.fillStyle = '#000000';
      ctx.fillRect(12, 8, 2, 3);
    });

    // 3. Snout Front Texture
    this.snoutFrontTexture = this.createPixelTexture((ctx) => {
      ctx.fillStyle = '#e87890';
      ctx.fillRect(0, 0, 16, 16);
      for (let y = 0; y < 16; y += 2) {
        for (let x = 0; x < 16; x += 2) {
          const n = (Math.random() - 0.5) * 10;
          ctx.fillStyle = `rgb(${Math.min(255, Math.max(0, 232 + n))}, ${Math.min(255, Math.max(0, 120 + n))}, ${Math.min(255, Math.max(0, 144 + n))})`;
          ctx.fillRect(x, y, 2, 2);
        }
      }
      // Nostrils
      ctx.fillStyle = '#b03858';
      ctx.fillRect(2, 6, 3, 4);
      ctx.fillRect(11, 6, 3, 4);
    });

    // 4. Leg Bottom / Hoof Texture
    this.legBottomTexture = this.createPixelTexture((ctx) => {
      ctx.fillStyle = '#f08ca0';
      ctx.fillRect(0, 0, 16, 16);
      for (let y = 0; y < 16; y += 2) {
        for (let x = 0; x < 16; x += 2) {
          const n = (Math.random() - 0.5) * 15;
          ctx.fillStyle = `rgb(${Math.min(255, Math.max(0, 240 + n))}, ${Math.min(255, Math.max(0, 140 + n))}, ${Math.min(255, Math.max(0, 160 + n))})`;
          ctx.fillRect(x, y, 2, 2);
        }
      }
      // Hoof bottom
      ctx.fillStyle = '#603842';
      ctx.fillRect(0, 12, 16, 4);
    });
  }

  public initMesh() {
    Pig.initTextures();

    // Create unique materials for this instance (cloned so we can flash emissive red separately)
    const pinkMat = new THREE.MeshStandardMaterial({ map: Pig.pinkTexture, roughness: 0.9, metalness: 0.1 });
    const headFrontMat = new THREE.MeshStandardMaterial({ map: Pig.headFrontTexture, roughness: 0.9, metalness: 0.1 });
    const snoutFrontMat = new THREE.MeshStandardMaterial({ map: Pig.snoutFrontTexture, roughness: 0.9, metalness: 0.1 });
    const legBottomMat = new THREE.MeshStandardMaterial({ map: Pig.legBottomTexture, roughness: 0.9, metalness: 0.1 });

    // 1. Build Pig Body (Length: 1.0, Height: 0.5, Width: 0.6)
    const bodyGeo = new THREE.BoxGeometry(0.6, 0.5, 1.0);
    const bodyMesh = new THREE.Mesh(bodyGeo, pinkMat);
    bodyMesh.position.set(0, 0.45, 0); // elevated from floor
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.mesh.add(bodyMesh);

    // 2. Build Head (Width: 0.45, Height: 0.45, Depth: 0.45)
    // Order: Right (+X), Left (-X), Top (+Y), Bottom (-Y), Front (+Z), Back (-Z)
    // Since pig faces -Z forward:
    // Index 4 is +Z (back of head), Index 5 is -Z (front of head)
    const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
    const headMats = [
      pinkMat, // +X
      pinkMat, // -X
      pinkMat, // +Y
      pinkMat, // -Y
      pinkMat, // +Z (Back)
      headFrontMat, // -Z (Front)
    ];
    const headMesh = new THREE.Mesh(headGeo, headMats);
    headMesh.position.set(0, 0.65, -0.45); // forward and up
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    this.mesh.add(headMesh);

    // 3. Build Snout (Nose) (Width: 0.25, Height: 0.15, Depth: 0.1)
    const snoutGeo = new THREE.BoxGeometry(0.25, 0.15, 0.1);
    const snoutMats = [
      pinkMat, // +X
      pinkMat, // -X
      pinkMat, // +Y
      pinkMat, // -Y
      pinkMat, // +Z (Back)
      snoutFrontMat, // -Z (Front)
    ];
    const snoutMesh = new THREE.Mesh(snoutGeo, snoutMats);
    snoutMesh.position.set(0, 0.53, -0.7); // in front of the head
    snoutMesh.castShadow = true;
    snoutMesh.receiveShadow = true;
    this.mesh.add(snoutMesh);

    // 4. Build Legs (Width: 0.16, Height: 0.35, Depth: 0.16)
    // Leg bottom texture is mapped to bottom face (Index 3: -Y)
    const legGeo = new THREE.BoxGeometry(0.16, 0.35, 0.16);
    // Center geometry so pivot is at top of leg (makes rotation swing nice)
    legGeo.translate(0, -0.175, 0);

    const legMats = [
      pinkMat, // +X
      pinkMat, // -X
      pinkMat, // +Y
      legBottomMat, // -Y (Bottom hoof)
      pinkMat, // +Z
      pinkMat, // -Z
    ];

    // Front Left Leg
    this.frontLeftLeg = new THREE.Mesh(legGeo, legMats);
    this.frontLeftLeg.position.set(0.18, 0.35, -0.32);
    this.frontLeftLeg.castShadow = true;
    this.frontLeftLeg.receiveShadow = true;
    this.mesh.add(this.frontLeftLeg);

    // Front Right Leg
    this.frontRightLeg = new THREE.Mesh(legGeo, legMats);
    this.frontRightLeg.position.set(-0.18, 0.35, -0.32);
    this.frontRightLeg.castShadow = true;
    this.frontRightLeg.receiveShadow = true;
    this.mesh.add(this.frontRightLeg);

    // Back Left Leg
    this.backLeftLeg = new THREE.Mesh(legGeo, legMats);
    this.backLeftLeg.position.set(0.18, 0.35, 0.32);
    this.backLeftLeg.castShadow = true;
    this.backLeftLeg.receiveShadow = true;
    this.mesh.add(this.backLeftLeg);

    // Back Right Leg
    this.backRightLeg = new THREE.Mesh(legGeo, legMats);
    this.backRightLeg.position.set(-0.18, 0.35, 0.32);
    this.backRightLeg.castShadow = true;
    this.backRightLeg.receiveShadow = true;
    this.mesh.add(this.backRightLeg);
  }

  public update(dt: number) {
    super.update(dt);

    // Legs swing micro-animation when moving
    const speed2D = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
    if (speed2D > 0.05 && this.state.onGround) {
      const swingSpeed = this.aiState === 'panicked' ? 20.0 : 9.0;
      const angle = Math.sin(performance.now() * 0.001 * swingSpeed) * 0.65;
      
      this.frontLeftLeg.rotation.x = angle;
      this.frontRightLeg.rotation.x = -angle;
      this.backLeftLeg.rotation.x = -angle;
      this.backRightLeg.rotation.x = angle;
    } else {
      // Smoothly reset leg rotations to zero
      this.frontLeftLeg.rotation.x *= Math.max(0, 1 - 10 * dt);
      this.frontRightLeg.rotation.x *= Math.max(0, 1 - 10 * dt);
      this.backLeftLeg.rotation.x *= Math.max(0, 1 - 10 * dt);
      this.backRightLeg.rotation.x *= Math.max(0, 1 - 10 * dt);
    }
  }

}
