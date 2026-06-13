import type { BlockProperties } from '../BlockConfig';

export interface BlockModelRenderContext {
  x: number;
  y: number;
  z: number;
  wx: number;
  wy: number;
  wz: number;
  orientation: number;

  solid: { positions: number[]; normals: number[]; uvs: number[]; atlasOffsets: number[]; valLights: number[]; aos: number[] };
  trans: { positions: number[]; normals: number[]; uvs: number[]; atlasOffsets: number[]; valLights: number[]; aos: number[] };
  cutout: { positions: number[]; normals: number[]; uvs: number[]; atlasOffsets: number[]; valLights: number[]; aos: number[] };

  getNeighbor: (lx: number, ly: number, lz: number) => number;
  isTransparent: (blockId: number) => boolean;
  getLightAt?: (lx: number, ly: number, lz: number) => number;
}

export interface BlockModel {
  /** Whether the block participates in standard Greedy Face Merging */
  readonly useGreedyMesh: boolean;

  /** Compilation logic for non-greedy custom models */
  renderCustom?(ctx: BlockModelRenderContext, props: BlockProperties): void;
}

// ─── 1. Cube Block Model ───
export class CubeBlockModel implements BlockModel {
  public readonly useGreedyMesh = true;
  public readonly renderAdjacentSameType: boolean;
  public readonly renderInternalCross: boolean;

  constructor(
    renderAdjacentSameType: boolean = false,
    renderInternalCross: boolean = false
  ) {
    this.renderAdjacentSameType = renderAdjacentSameType;
    this.renderInternalCross = renderInternalCross;
  }
}

// ─── 2. Cross Diagonal Block Model ───
const SQRT1_2 = 0.7071067811865476;

export class CrossBlockModel implements BlockModel {
  public readonly useGreedyMesh = false;
  public readonly scaleW: number;
  public readonly scaleH: number;
  public readonly enableOffset: boolean;

  constructor(
    scaleW: number = 1.0,
    scaleH: number = 1.0,
    enableOffset: boolean = false
  ) {
    this.scaleW = scaleW;
    this.scaleH = scaleH;
    this.enableOffset = enableOffset;
  }

  public renderCustom(ctx: BlockModelRenderContext, props: BlockProperties): void {
    const atlasIndex = props.textureFaces?.side ?? 3;
    const tx = atlasIndex % 8;
    const ty = 7 - Math.floor(atlasIndex / 8);
    const uMin = tx * 0.125;
    const vMin = ty * 0.125;

    const uv0 = [0, 0];
    const uv1 = [0, 1];
    const uv2 = [1, 1];
    const uv3 = [1, 0];

    let dx = 0, dz = 0;
    const hw = 0.5 * this.scaleW;
    const h = this.scaleH;

    if (this.enableOffset) {
      const sinX = Math.sin(ctx.wx * 12.9898 + ctx.wz * 78.233) * 43758.5453123;
      const sinZ = Math.sin(ctx.wx * 26.543 + ctx.wz * 19.854) * 43758.5453123;
      dx = (sinX - Math.floor(sinX)) * 0.3 - 0.15;
      dz = (sinZ - Math.floor(sinZ)) * 0.3 - 0.15;
    }

    const cxStr = ctx.wx + 0.5;
    const czStr = ctx.wz + 0.5;

    const lightVal = ctx.getLightAt ? ctx.getLightAt(ctx.x, ctx.y, ctx.z) : 240;
    const sky = (lightVal >> 4) & 0x0F;
    const block = lightVal & 0x0F;

    // First diagonal plane
    const p1_0 = [cxStr - hw + dx, ctx.wy, czStr - hw + dz];
    const p1_1 = [cxStr - hw + dx, ctx.wy + h, czStr - hw + dz];
    const p1_2 = [cxStr + hw + dx, ctx.wy + h, czStr + hw + dz];
    const p1_3 = [cxStr + hw + dx, ctx.wy, czStr + hw + dz];

    ctx.cutout.positions.push(...p1_0, ...p1_1, ...p1_2, ...p1_0, ...p1_2, ...p1_3);
    ctx.cutout.uvs.push(...uv0, ...uv1, ...uv2, ...uv0, ...uv2, ...uv3);
    for (let i = 0; i < 6; i++) {
      ctx.cutout.normals.push(-SQRT1_2, 0, SQRT1_2);
      ctx.cutout.atlasOffsets.push(uMin, vMin);
      ctx.cutout.valLights.push(sky, block);
      ctx.cutout.aos.push(3);
    }

    // Second diagonal plane
    const p2_0 = [cxStr + hw + dx, ctx.wy, czStr - hw + dz];
    const p2_1 = [cxStr + hw + dx, ctx.wy + h, czStr - hw + dz];
    const p2_2 = [cxStr - hw + dx, ctx.wy + h, czStr + hw + dz];
    const p2_3 = [cxStr - hw + dx, ctx.wy, czStr + hw + dz];

    ctx.cutout.positions.push(...p2_0, ...p2_1, ...p2_2, ...p2_0, ...p2_2, ...p2_3);
    ctx.cutout.uvs.push(...uv0, ...uv1, ...uv2, ...uv0, ...uv2, ...uv3);
    for (let i = 0; i < 6; i++) {
      ctx.cutout.normals.push(SQRT1_2, 0, SQRT1_2);
      ctx.cutout.atlasOffsets.push(uMin, vMin);
      ctx.cutout.valLights.push(sky, block);
      ctx.cutout.aos.push(3);
    }
  }
}

// ─── 3. Minecraft-like Element Block Model ───
export interface ModelFace {
  uv?: [number, number, number, number]; // [u0, v0, u1, v1], 0-16. Defaults to [0, 0, 16, 16]
  texture: 'top' | 'bottom' | 'side';
}

export interface ModelElement {
  from: [number, number, number]; // Coordinates in 0-16 grid
  to: [number, number, number];   // Coordinates in 0-16 grid
  faces: {
    up?: ModelFace;
    down?: ModelFace;
    west?: ModelFace;  // -X
    east?: ModelFace;  // +X
    north?: ModelFace; // -Z
    south?: ModelFace; // +Z
  };
}

export class ElementBlockModel implements BlockModel {
  public readonly useGreedyMesh = false;
  public readonly elements: ModelElement[];

  constructor(elements: ModelElement[]) {
    this.elements = elements;
  }

  public renderCustom(ctx: BlockModelRenderContext, props: BlockProperties): void {
    const getAtlasUV = (atlasIndex: number) => {
      const tx = atlasIndex % 8;
      const ty = 7 - Math.floor(atlasIndex / 8);
      return [tx * 0.125, ty * 0.125];
    };

    const sideAtlas = props.textureFaces?.side ?? 3;
    const topAtlas = props.textureFaces?.top ?? sideAtlas;
    const bottomAtlas = props.textureFaces?.bottom ?? sideAtlas;

    const atlasMap = {
      side: getAtlasUV(sideAtlas),
      top: getAtlasUV(topAtlas),
      bottom: getAtlasUV(bottomAtlas)
    };

    // Use cutout data as the target for these custom/alpha-tested elements
    const isTrans = props.opacity < 1.0 || props.isTransparent;
    const targetData = isTrans ? ctx.cutout : ctx.solid;

    const lightVal = ctx.getLightAt ? ctx.getLightAt(ctx.x, ctx.y, ctx.z) : 240;
    const sky = (lightVal >> 4) & 0x0F;
    const block = lightVal & 0x0F;

    for (const el of this.elements) {
      const x0 = el.from[0] / 16;
      const y0 = el.from[1] / 16;
      const z0 = el.from[2] / 16;
      const x1 = el.to[0] / 16;
      const y1 = el.to[1] / 16;
      const z1 = el.to[2] / 16;

      // 1. Up Face (Y = y1, normal = 0, 1, 0)
      if (el.faces.up) {
        let draw = true;
        if (el.to[1] === 16) {
          const neighbor = ctx.getNeighbor(ctx.x, ctx.y + 1, ctx.z);
          draw = ctx.isTransparent(neighbor);
        }
        if (draw) {
          const v0 = [ctx.wx + x0, ctx.wy + y1, ctx.wz + z0];
          const v1 = [ctx.wx + x0, ctx.wy + y1, ctx.wz + z1];
          const v2 = [ctx.wx + x1, ctx.wy + y1, ctx.wz + z1];
          const v3 = [ctx.wx + x1, ctx.wy + y1, ctx.wz + z0];
          
          targetData.positions.push(...v0, ...v1, ...v2, ...v0, ...v2, ...v3);
          
          const uv = el.faces.up.uv ?? [0, 0, 16, 16];
          const uv0 = [uv[0] / 16, uv[1] / 16];
          const uv1 = [uv[0] / 16, uv[3] / 16];
          const uv2 = [uv[2] / 16, uv[3] / 16];
          const uv3 = [uv[2] / 16, uv[1] / 16];
          targetData.uvs.push(...uv0, ...uv1, ...uv2, ...uv0, ...uv2, ...uv3);

          const offset = atlasMap[el.faces.up.texture];
          for (let i = 0; i < 6; i++) {
            targetData.normals.push(0, 1, 0);
            targetData.atlasOffsets.push(offset[0], offset[1]);
            targetData.valLights.push(sky, block);
            targetData.aos.push(3);
          }
        }
      }

      // 2. Down Face (Y = y0, normal = 0, -1, 0)
      if (el.faces.down) {
        let draw = true;
        if (el.from[1] === 0) {
          const neighbor = ctx.getNeighbor(ctx.x, ctx.y - 1, ctx.z);
          draw = ctx.isTransparent(neighbor);
        }
        if (draw) {
          const v0 = [ctx.wx + x0, ctx.wy + y0, ctx.wz + z1];
          const v1 = [ctx.wx + x0, ctx.wy + y0, ctx.wz + z0];
          const v2 = [ctx.wx + x1, ctx.wy + y0, ctx.wz + z0];
          const v3 = [ctx.wx + x1, ctx.wy + y0, ctx.wz + z1];
          
          targetData.positions.push(...v0, ...v1, ...v2, ...v0, ...v2, ...v3);
          
          const uv = el.faces.down.uv ?? [0, 0, 16, 16];
          const uv0 = [uv[0] / 16, uv[1] / 16];
          const uv1 = [uv[0] / 16, uv[3] / 16];
          const uv2 = [uv[2] / 16, uv[3] / 16];
          const uv3 = [uv[2] / 16, uv[1] / 16];
          targetData.uvs.push(...uv0, ...uv1, ...uv2, ...uv0, ...uv2, ...uv3);

          const offset = atlasMap[el.faces.down.texture];
          for (let i = 0; i < 6; i++) {
            targetData.normals.push(0, -1, 0);
            targetData.atlasOffsets.push(offset[0], offset[1]);
            targetData.valLights.push(sky, block);
            targetData.aos.push(3);
          }
        }
      }

      // 3. West Face (nx, X = x0, normal = -1, 0, 0)
      if (el.faces.west) {
        let draw = true;
        if (el.from[0] === 0) {
          const neighbor = ctx.getNeighbor(ctx.x - 1, ctx.y, ctx.z);
          draw = ctx.isTransparent(neighbor);
        }
        if (draw) {
          const v0 = [ctx.wx + x0, ctx.wy + y0, ctx.wz + z1];
          const v1 = [ctx.wx + x0, ctx.wy + y1, ctx.wz + z1];
          const v2 = [ctx.wx + x0, ctx.wy + y1, ctx.wz + z0];
          const v3 = [ctx.wx + x0, ctx.wy + y0, ctx.wz + z0];
          
          targetData.positions.push(...v0, ...v1, ...v2, ...v0, ...v2, ...v3);
          
          const uv = el.faces.west.uv ?? [0, 0, 16, 16];
          const uv0 = [uv[0] / 16, uv[1] / 16];
          const uv1 = [uv[0] / 16, uv[3] / 16];
          const uv2 = [uv[2] / 16, uv[3] / 16];
          const uv3 = [uv[2] / 16, uv[1] / 16];
          targetData.uvs.push(...uv0, ...uv1, ...uv2, ...uv0, ...uv2, ...uv3);

          const offset = atlasMap[el.faces.west.texture];
          for (let i = 0; i < 6; i++) {
            targetData.normals.push(-1, 0, 0);
            targetData.atlasOffsets.push(offset[0], offset[1]);
            targetData.valLights.push(sky, block);
            targetData.aos.push(3);
          }
        }
      }

      // 4. East Face (px, X = x1, normal = 1, 0, 0)
      if (el.faces.east) {
        let draw = true;
        if (el.to[0] === 16) {
          const neighbor = ctx.getNeighbor(ctx.x + 1, ctx.y, ctx.z);
          draw = ctx.isTransparent(neighbor);
        }
        if (draw) {
          const v0 = [ctx.wx + x1, ctx.wy + y0, ctx.wz + z0];
          const v1 = [ctx.wx + x1, ctx.wy + y1, ctx.wz + z0];
          const v2 = [ctx.wx + x1, ctx.wy + y1, ctx.wz + z1];
          const v3 = [ctx.wx + x1, ctx.wy + y0, ctx.wz + z1];
          
          targetData.positions.push(...v0, ...v1, ...v2, ...v0, ...v2, ...v3);
          
          const uv = el.faces.east.uv ?? [0, 0, 16, 16];
          const uv0 = [uv[0] / 16, uv[1] / 16];
          const uv1 = [uv[0] / 16, uv[3] / 16];
          const uv2 = [uv[2] / 16, uv[3] / 16];
          const uv3 = [uv[2] / 16, uv[1] / 16];
          targetData.uvs.push(...uv0, ...uv1, ...uv2, ...uv0, ...uv2, ...uv3);

          const offset = atlasMap[el.faces.east.texture];
          for (let i = 0; i < 6; i++) {
            targetData.normals.push(1, 0, 0);
            targetData.atlasOffsets.push(offset[0], offset[1]);
            targetData.valLights.push(sky, block);
            targetData.aos.push(3);
          }
        }
      }

      // 5. North Face (nz, Z = z0, normal = 0, 0, -1)
      if (el.faces.north) {
        let draw = true;
        if (el.from[2] === 0) {
          const neighbor = ctx.getNeighbor(ctx.x, ctx.y, ctx.z - 1);
          draw = ctx.isTransparent(neighbor);
        }
        if (draw) {
          const v0 = [ctx.wx + x0, ctx.wy + y0, ctx.wz + z0];
          const v1 = [ctx.wx + x0, ctx.wy + y1, ctx.wz + z0];
          const v2 = [ctx.wx + x1, ctx.wy + y1, ctx.wz + z0];
          const v3 = [ctx.wx + x1, ctx.wy + y0, ctx.wz + z0];
          
          targetData.positions.push(...v0, ...v1, ...v2, ...v0, ...v2, ...v3);
          
          const uv = el.faces.north.uv ?? [0, 0, 16, 16];
          const uv0 = [uv[0] / 16, uv[1] / 16];
          const uv1 = [uv[0] / 16, uv[3] / 16];
          const uv2 = [uv[2] / 16, uv[3] / 16];
          const uv3 = [uv[2] / 16, uv[1] / 16];
          targetData.uvs.push(...uv0, ...uv1, ...uv2, ...uv0, ...uv2, ...uv3);

          const offset = atlasMap[el.faces.north.texture];
          for (let i = 0; i < 6; i++) {
            targetData.normals.push(0, 0, -1);
            targetData.atlasOffsets.push(offset[0], offset[1]);
            targetData.valLights.push(sky, block);
            targetData.aos.push(3);
          }
        }
      }

      // 6. South Face (pz, Z = z1, normal = 0, 0, 1)
      if (el.faces.south) {
        let draw = true;
        if (el.to[2] === 16) {
          const neighbor = ctx.getNeighbor(ctx.x, ctx.y, ctx.z + 1);
          draw = ctx.isTransparent(neighbor);
        }
        if (draw) {
          const v0 = [ctx.wx + x1, ctx.wy + y0, ctx.wz + z1];
          const v1 = [ctx.wx + x1, ctx.wy + y1, ctx.wz + z1];
          const v2 = [ctx.wx + x0, ctx.wy + y1, ctx.wz + z1];
          const v3 = [ctx.wx + x0, ctx.wy + y0, ctx.wz + z1];
          
          targetData.positions.push(...v0, ...v1, ...v2, ...v0, ...v2, ...v3);
          
          const uv = el.faces.south.uv ?? [0, 0, 16, 16];
          const uv0 = [uv[0] / 16, uv[1] / 16];
          const uv1 = [uv[0] / 16, uv[3] / 16];
          const uv2 = [uv[2] / 16, uv[3] / 16];
          const uv3 = [uv[2] / 16, uv[1] / 16];
          targetData.uvs.push(...uv0, ...uv1, ...uv2, ...uv0, ...uv2, ...uv3);

          const offset = atlasMap[el.faces.south.texture];
          for (let i = 0; i < 6; i++) {
            targetData.normals.push(0, 0, 1);
            targetData.atlasOffsets.push(offset[0], offset[1]);
            targetData.valLights.push(sky, block);
            targetData.aos.push(3);
          }
        }
      }
    }
  }
}

