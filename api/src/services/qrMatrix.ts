import QRCode from 'qrcode';

export interface QrOptions {
  size?: number; // Output SVG width & height in px (default 256)
  margin?: number; // Quiet zone modules (default 2)
  foregroundColor?: string; // Hex / CSS color for dark modules (default #26211C)
  backgroundColor?: string; // Hex / CSS color for light background (default #FFFFFF)
}

export class QrMatrixGenerator {
  /**
   * Synchronously render official ISO/IEC 18004 compliant QR Code as a crisp vector SVG string
   */
  static renderSvg(text: string, options?: QrOptions): string {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const size = qr.modules.size;
    const margin = options?.margin ?? 2;
    const totalSize = size + margin * 2;
    const outputPx = options?.size ?? 256;
    const dark = options?.foregroundColor ?? '#26211C';
    const light = options?.backgroundColor ?? '#FFFFFF';

    let path = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (qr.modules.get(r, c)) {
          path += `M${c + margin},${r + margin}h1v1h-1z `;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${outputPx}" height="${outputPx}" shape-rendering="crispEdges">
  <rect width="${totalSize}" height="${totalSize}" fill="${light}" />
  <path d="${path.trim()}" fill="${dark}" />
</svg>`;
  }

  /**
   * Synchronously render official ISO/IEC 18004 compliant QR Code as a base64 SVG data URL
   */
  static renderDataUrl(text: string, options?: QrOptions): string {
    const svg = this.renderSvg(text, options);
    const base64 = Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  }

  /**
   * Async high-res PNG / raster Data URL option
   */
  static async renderPngDataUrl(text: string, options?: QrOptions): Promise<string> {
    return await QRCode.toDataURL(text, {
      margin: options?.margin ?? 2,
      width: options?.size ?? 256,
      errorCorrectionLevel: 'M',
      color: {
        dark: options?.foregroundColor ?? '#26211C',
        light: options?.backgroundColor ?? '#FFFFFF',
      },
    });
  }
}
