/**
 * 清洗并提取 WebGL 驱动返回的原始 GPU 显卡名称，
 * 去除 ANGLE 包装、硬件 ID (如 0x0000)、API 类型、Direct3D/OpenGL 驱动后缀等冗余信息。
 * 
 * 兼容以下格式：
 * 1. ANGLE Windows NVIDIA 独显/集显 (含 0x0000 硬件ID，Direct3D)
 * 2. AMD 显卡 (含 (TM) 商标)
 * 3. macOS 显卡 (如 Apple M1/M2, Metal)
 * 4. OpenGL 传统驱动格式 (含 PCIe/SSE2)
 * 
 * @param raw 原始 GPU 驱动信息字符串，例如：
 *            "ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58) Direct3D11 vs_5_0 ps_5_0, D3D11)"
 * @returns 净化后的显卡名称，例如 "NVIDIA GeForce RTX 5070 Laptop GPU"
 */
export function cleanGpuName(raw: string): string {
  if (!raw) return 'Unknown';

  // 1. 如果是 Chrome/Edge (Windows) 下常见的 ANGLE 封装格式
  // 匹配 ANGLE (Vendor, GPU Model, Backend)
  const angleMatch = raw.match(/ANGLE \((.*)\)/i);
  if (angleMatch) {
    const parts = angleMatch[1].split(',');
    if (parts.length >= 2) {
      const gpuSection = parts[1].trim();
      return cleanGpuSuffixes(gpuSection);
    }
  }

  // 2. 对于 macOS 或其他直接输出的原始渲染器名称，直接清洗后缀
  return cleanGpuSuffixes(raw);
}

/**
 * 内部辅助函数，剥离显卡型号背后的冗余驱动参数后缀
 */
function cleanGpuSuffixes(gpu: string): string {
  let cleaned = gpu.trim();

  // 移除硬件 ID (如 (0x00002D58)) 以及随后的所有信息
  cleaned = cleaned.split(/\s*\(0x/i)[0];

  // 移除常见 API 后缀 (如 Direct3D, OpenGL, WebGL, Metal, D3D11, vs_, ps_, PCIe, SSE2)
  cleaned = cleaned.split(/\s*(?:\bDirect3D\b|\bOpenGL\b|\bWebGL\b|\bMetal\b|\bvs_\d|ps_\d|\/?PCIe|\/?SSE2)/i)[0];

  return cleaned.trim();
}
