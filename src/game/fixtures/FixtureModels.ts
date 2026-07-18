import * as THREE from 'three';
import type { FixtureDefinition } from './FixtureTypes';

const DEFAULT_COLOR = 0x777777;
const DEFAULT_SIZE = 0.9;

interface BoxViewConfig {
  readonly color: number;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly metalness?: number;
  readonly roughness?: number;
}

function resolveBoxView(definition: FixtureDefinition): BoxViewConfig {
  const view = definition.view;
  return {
    color: view?.color ?? DEFAULT_COLOR,
    width: view?.width ?? DEFAULT_SIZE,
    height: view?.height ?? DEFAULT_SIZE,
    depth: view?.depth ?? DEFAULT_SIZE,
    metalness: definition.id === 'cloudcraft:furnace' ? 0.22 : 0.05,
    roughness: 0.82,
  };
}

function createStandardMaterial(
  color: number,
  options?: { roughness?: number; metalness?: number },
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options?.roughness ?? 0.78,
    metalness: options?.metalness ?? 0.05,
  });
}

function addBox(
  parent: THREE.Object3D,
  geometry: THREE.BoxGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/**
 * 简易木箱：箱体 + 箱盖 + 金属箍带 + 前锁扣。
 * 局部原点在底面中心，+Y 向上，+Z 为正面（锁扣朝向）。
 */
export function createChestModel(_definition: FixtureDefinition): THREE.Group {
  const root = new THREE.Group();
  root.name = 'fixture-model:chest';

  const wood = createStandardMaterial(0x8b5a2b, { roughness: 0.86, metalness: 0.02 });
  const woodDark = createStandardMaterial(0x5c3a18, { roughness: 0.9, metalness: 0.02 });
  const woodLight = createStandardMaterial(0xa66b2e, { roughness: 0.8, metalness: 0.02 });
  const metal = createStandardMaterial(0xb8b8b8, { roughness: 0.42, metalness: 0.72 });
  const metalDark = createStandardMaterial(0x6e6e6e, { roughness: 0.48, metalness: 0.65 });
  const brass = createStandardMaterial(0xd4af37, { roughness: 0.38, metalness: 0.78 });

  const bodyW = 0.88;
  const bodyH = 0.52;
  const bodyD = 0.88;
  const lidH = 0.28;
  const lidOverhang = 0.02;

  // 箱体
  addBox(root, new THREE.BoxGeometry(bodyW, bodyH, bodyD), wood, 0, bodyH / 2, 0);

  // 箱盖（略宽，坐落在箱体上）
  addBox(
    root,
    new THREE.BoxGeometry(bodyW + lidOverhang * 2, lidH, bodyD + lidOverhang * 2),
    woodLight,
    0,
    bodyH + lidH / 2,
    0,
  );

  // 箱盖前缘装饰条
  addBox(
    root,
    new THREE.BoxGeometry(bodyW + lidOverhang * 2, 0.04, 0.05),
    woodDark,
    0,
    bodyH + 0.02,
    bodyD / 2 + lidOverhang + 0.005,
  );

  // 箱体中部金属箍
  addBox(
    root,
    new THREE.BoxGeometry(bodyW + 0.01, 0.06, bodyD + 0.01),
    metalDark,
    0,
    bodyH * 0.48,
    0,
  );

  // 箱盖金属箍
  addBox(
    root,
    new THREE.BoxGeometry(bodyW + lidOverhang * 2 + 0.01, 0.05, bodyD + lidOverhang * 2 + 0.01),
    metal,
    0,
    bodyH + lidH * 0.45,
    0,
  );

  // 前脸锁扣底板
  addBox(
    root,
    new THREE.BoxGeometry(0.14, 0.2, 0.04),
    metal,
    0,
    bodyH + 0.02,
    bodyD / 2 + 0.02,
  );

  // 黄铜锁芯
  addBox(
    root,
    new THREE.BoxGeometry(0.07, 0.09, 0.05),
    brass,
    0,
    bodyH + 0.01,
    bodyD / 2 + 0.045,
  );

  // 四角木脚
  const foot = new THREE.BoxGeometry(0.1, 0.06, 0.1);
  const footY = 0.03;
  const footOffset = bodyW / 2 - 0.1;
  const footZ = bodyD / 2 - 0.1;
  for (const [fx, fz] of [
    [-footOffset, -footZ],
    [footOffset, -footZ],
    [-footOffset, footZ],
    [footOffset, footZ],
  ] as const) {
    addBox(root, foot, woodDark, fx, footY, fz);
  }

  return root;
}

export function createBoxModel(definition: FixtureDefinition): THREE.Group {
  const config = resolveBoxView(definition);
  const root = new THREE.Group();
  root.name = `fixture-model:box:${definition.id}`;
  const material = createStandardMaterial(config.color, {
    roughness: config.roughness,
    metalness: config.metalness,
  });
  addBox(
    root,
    new THREE.BoxGeometry(config.width, config.height, config.depth),
    material,
    0,
    config.height / 2,
    0,
  );
  return root;
}

/** 按设施定义构建可克隆的原型模型（局部原点在底面中心）。 */
export function createFixtureModelPrototype(definition: FixtureDefinition): THREE.Object3D {
  const model = definition.view?.model ?? 'box';
  if (model === 'chest') {
    return createChestModel(definition);
  }
  return createBoxModel(definition);
}

/** 释放模型树中的 geometry / material（去重后一次释放）。 */
export function disposeFixtureModelTree(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object.geometry) {
      geometries.add(object.geometry);
    }
    const meshMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of meshMaterials) {
      if (material) materials.add(material);
    }
  });

  for (const geometry of geometries) {
    geometry.dispose();
  }
  for (const material of materials) {
    material.dispose();
  }
}
