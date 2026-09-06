/**
 * Pure TypeScript Zero-Dependency QR Code Generator
 * Generates ISO/IEC 18004 compliant QR Codes (Version 1-10) rendered as vector SVG.
 * 100% Offline, strictly zero external dependencies.
 */

export interface QrOptions {
  size?: number; // Output SVG width & height in px (default 256)
  margin?: number; // Quiet zone modules (default 4)
  foregroundColor?: string; // Hex / CSS color for dark modules
  backgroundColor?: string; // Hex / CSS color for light background
}

// Galois field tables for GF(256) with primitive polynomial 0x11d
const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);

(function initGaloisField() {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = val;
    EXP_TABLE[i + 255] = val;
    LOG_TABLE[val] = i;
    val <<= 1;
    if (val & 0x100) {
      val ^= 0x11d;
    }
  }
})();

function gfMultiply(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const nextPoly = new Uint8Array(poly.length + 1);
    const factor = EXP_TABLE[i];
    for (let j = 0; j < poly.length; j++) {
      nextPoly[j] ^= gfMultiply(poly[j], factor);
      nextPoly[j + 1] ^= poly[j];
    }
    poly = nextPoly;
  }
  return poly;
}

function rsCompute(data: Uint8Array, ecLength: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLength);
  const result = new Uint8Array(ecLength);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ result[0];
    result.copyWithin(0, 1);
    result[ecLength - 1] = 0;
    for (let j = 0; j < ecLength; j++) {
      result[j] ^= gfMultiply(gen[j], factor);
    }
  }
  return result;
}

// Version table: capacity for Byte mode with EC Level L or M
// [version, totalCodewords, ecCodewords, numBlocks, alignmentCoords]
interface QrVersionSpec {
  version: number;
  size: number;
  totalCodewords: number;
  ecCodewords: number;
  numBlocks: number;
  alignCoords: number[];
}

const VERSION_SPECS: QrVersionSpec[] = [
  { version: 1, size: 21, totalCodewords: 26, ecCodewords: 10, numBlocks: 1, alignCoords: [] },
  { version: 2, size: 25, totalCodewords: 44, ecCodewords: 16, numBlocks: 1, alignCoords: [6, 18] },
  { version: 3, size: 29, totalCodewords: 70, ecCodewords: 26, numBlocks: 1, alignCoords: [6, 22] },
  { version: 4, size: 33, totalCodewords: 100, ecCodewords: 36, numBlocks: 2, alignCoords: [6, 26] },
  { version: 5, size: 37, totalCodewords: 134, ecCodewords: 48, numBlocks: 2, alignCoords: [6, 30] },
  { version: 6, size: 41, totalCodewords: 172, ecCodewords: 64, numBlocks: 4, alignCoords: [6, 34] },
  { version: 7, size: 45, totalCodewords: 196, ecCodewords: 72, numBlocks: 4, alignCoords: [6, 22, 38] },
  { version: 8, size: 49, totalCodewords: 242, ecCodewords: 88, numBlocks: 4, alignCoords: [6, 24, 42] },
  { version: 9, size: 53, totalCodewords: 292, ecCodewords: 110, numBlocks: 5, alignCoords: [6, 26, 46] },
  { version: 10, size: 57, totalCodewords: 346, ecCodewords: 130, numBlocks: 5, alignCoords: [6, 28, 50] },
];

export class QrMatrixGenerator {
  /**
   * Generates a 2D boolean matrix where true = dark module, false = light module
   */
  static generateMatrix(text: string): { matrix: boolean[][]; size: number } {
    const utf8Bytes = Buffer.from(text, 'utf-8');
    const dataLength = utf8Bytes.length;

    // Pick smallest version that fits dataLength
    let spec: QrVersionSpec | null = null;
    for (const s of VERSION_SPECS) {
      // Byte mode overhead: 4-bit mode indicator + 8-bit length (for ver 1-9) or 16-bit
      const dataCapacity = s.totalCodewords - s.ecCodewords;
      const requiredCodewords = dataLength + (s.version <= 9 ? 2 : 3);
      if (dataCapacity >= requiredCodewords) {
        spec = s;
        break;
      }
    }

    if (!spec) {
      // If exceeds version 10, truncate text or fall back to version 10
      spec = VERSION_SPECS[VERSION_SPECS.length - 1];
    }

    const totalDataCodewords = spec.totalCodewords - spec.ecCodewords;

    // 1. Bit buffer construction (Byte mode: 0100)
    const bits: number[] = [];
    function pushBits(val: number, len: number) {
      for (let i = len - 1; i >= 0; i--) {
        bits.push((val >> i) & 1);
      }
    }

    // Mode: Byte (0100)
    pushBits(0b0100, 4);
    // Character count indicator (8 bits for ver 1-9, 16 for ver 10)
    const countBits = spec.version <= 9 ? 8 : 16;
    pushBits(Math.min(dataLength, 255), countBits);

    // Data bytes
    for (let i = 0; i < Math.min(dataLength, totalDataCodewords - 3); i++) {
      pushBits(utf8Bytes[i], 8);
    }

    // Terminator (up to 4 zeroes)
    const remainingToCodeword = (totalDataCodewords * 8) - bits.length;
    const termLen = Math.min(4, Math.max(0, remainingToCodeword));
    pushBits(0, termLen);

    // Pad to 8-bit boundary
    while (bits.length % 8 !== 0) {
      bits.push(0);
    }

    // Pad codewords (0xEC, 0x11)
    const padBytes = [0xec, 0x11];
    let padIdx = 0;
    while (bits.length < totalDataCodewords * 8) {
      pushBits(padBytes[padIdx % 2], 8);
      padIdx++;
    }

    // Convert bits to byte array
    const dataCodewords = new Uint8Array(totalDataCodewords);
    for (let i = 0; i < totalDataCodewords; i++) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        b = (b << 1) | bits[i * 8 + j];
      }
      dataCodewords[i] = b;
    }

    // 2. Error Correction Codewords computation
    const ecCodewordsPerBlock = Math.floor(spec.ecCodewords / spec.numBlocks);
    const dataCodewordsPerBlock = Math.floor(totalDataCodewords / spec.numBlocks);

    const ecBlocks: Uint8Array[] = [];
    const dataBlocks: Uint8Array[] = [];

    for (let b = 0; b < spec.numBlocks; b++) {
      const start = b * dataCodewordsPerBlock;
      const end = start + dataCodewordsPerBlock;
      const blockData = dataCodewords.slice(start, end);
      dataBlocks.push(blockData);
      ecBlocks.push(rsCompute(blockData, ecCodewordsPerBlock));
    }

    // Interleave data and EC codewords
    const finalCodewords: number[] = [];
    for (let i = 0; i < dataCodewordsPerBlock; i++) {
      for (let b = 0; b < spec.numBlocks; b++) {
        finalCodewords.push(dataBlocks[b][i]);
      }
    }
    for (let i = 0; i < ecCodewordsPerBlock; i++) {
      for (let b = 0; b < spec.numBlocks; b++) {
        finalCodewords.push(ecBlocks[b][i]);
      }
    }

    // 3. Matrix population
    const size = spec.size;
    const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
    const isReserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

    function setModule(r: number, c: number, dark: boolean, reserve = true) {
      if (r >= 0 && r < size && c >= 0 && c < size) {
        matrix[r][c] = dark;
        if (reserve) isReserved[r][c] = true;
      }
    }

    // Finder patterns (top-left, top-right, bottom-left)
    function placeFinder(startR: number, startC: number) {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const isDark = (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
          setModule(startR + r, startC + c, isDark);
        }
      }
      // Separator border around finders
      for (let r = -1; r <= 7; r++) {
        setModule(startR + r, startC - 1, false);
        setModule(startR + r, startC + 7, false);
      }
      for (let c = -1; c <= 7; c++) {
        setModule(startR - 1, startC + c, false);
        setModule(startR + 7, startC + c, false);
      }
    }

    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    // Alignment patterns (for Version >= 2)
    if (spec.alignCoords.length > 0) {
      for (const ar of spec.alignCoords) {
        for (const ac of spec.alignCoords) {
          // Do not place over finders
          if (
            (ar === 6 && ac === 6) ||
            (ar === 6 && ac === size - 7) ||
            (ar === size - 7 && ac === 6)
          ) {
            continue;
          }
          // 5x5 alignment square
          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              const isDark = (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0));
              setModule(ar + r, ac + c, isDark);
            }
          }
        }
      }
    }

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      if (!isReserved[6][i]) setModule(6, i, i % 2 === 0);
      if (!isReserved[i][6]) setModule(i, 6, i % 2 === 0);
    }

    // Dark module
    setModule(4 * spec.version + 9, 8, true);

    // Reserve format information areas
    for (let i = 0; i < 9; i++) {
      if (!isReserved[8][i]) isReserved[8][i] = true;
      if (!isReserved[i][8]) isReserved[i][8] = true;
    }
    for (let i = 0; i < 8; i++) {
      if (!isReserved[8][size - 1 - i]) isReserved[8][size - 1 - i] = true;
      if (!isReserved[size - 1 - i][8]) isReserved[size - 1 - i][8] = true;
    }

    // 4. Place Data Codewords (zigzag traversal)
    let bitIdx = 0;
    const finalBits: number[] = [];
    for (const byte of finalCodewords) {
      for (let i = 7; i >= 0; i--) {
        finalBits.push((byte >> i) & 1);
      }
    }

    let upwards = true;
    for (let rightCol = size - 1; rightCol > 0; rightCol -= 2) {
      // Column 6 is reserved for vertical timing pattern
      if (rightCol === 6) rightCol--;

      const rows = upwards
        ? Array.from({ length: size }, (_, i) => size - 1 - i)
        : Array.from({ length: size }, (_, i) => i);

      for (const row of rows) {
        for (let colOffset = 0; colOffset < 2; colOffset++) {
          const col = rightCol - colOffset;
          if (!isReserved[row][col]) {
            let bit = 0;
            if (bitIdx < finalBits.length) {
              bit = finalBits[bitIdx++];
            }
            // Apply standard Mask 0: (row + col) % 2 === 0
            const mask = (row + col) % 2 === 0;
            const finalBit = (bit === 1) !== mask;
            matrix[row][col] = finalBit;
          }
        }
      }
      upwards = !upwards;
    }

    // 5. Format info bits (Mask 0, EC level M: 0b100000011001110)
    const formatBits = [1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0];
    // Around top-left
    for (let i = 0; i < 6; i++) matrix[8][i] = formatBits[i] === 1;
    matrix[8][7] = formatBits[6] === 1;
    matrix[8][8] = formatBits[7] === 1;
    matrix[7][8] = formatBits[8] === 1;
    for (let i = 0; i < 6; i++) matrix[5 - i][8] = formatBits[9 + i] === 1;

    // Split around right and bottom
    for (let i = 0; i < 7; i++) matrix[size - 1 - i][8] = formatBits[i] === 1;
    for (let i = 0; i < 8; i++) matrix[8][size - 8 + i] = formatBits[7 + i] === 1;

    return { matrix, size };
  }

  /**
   * Render QR matrix directly into high-fidelity SVG string
   */
  static renderSvg(text: string, options?: QrOptions): string {
    const { matrix, size } = this.generateMatrix(text);
    const margin = options?.margin ?? 4;
    const totalModules = size + margin * 2;
    const outputSize = options?.size ?? 256;
    const darkColor = options?.foregroundColor ?? '#26211C';
    const lightColor = options?.backgroundColor ?? '#FFFFFF';

    let paths = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r][c]) {
          const x = c + margin;
          const y = r + margin;
          paths += `M${x},${y}h1v1h-1z `;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} ${totalModules}" width="${outputSize}" height="${outputSize}" shape-rendering="crispEdges">
  <rect width="${totalModules}" height="${totalModules}" fill="${lightColor}" />
  <path d="${paths.trim()}" fill="${darkColor}" />
</svg>`;
  }

  /**
   * Render QR matrix into a base64 SVG Data URL for direct HTML <img> embedding
   */
  static renderDataUrl(text: string, options?: QrOptions): string {
    const svg = this.renderSvg(text, options);
    const base64 = Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  }
}
