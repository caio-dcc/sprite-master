// ────────────────────────────────────────────────────────────
// imageProcessing.ts  –  All pixel-level algorithms
// Background removal: faithful port of SpriteMasterUltra (5).html
// + Multi-pass checkerboard-aware enhancement
// + AI mode via @imgly/background-removal
// ────────────────────────────────────────────────────────────

export interface SpriteSlice {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  name: string;
}

export interface GridParams {
  width: number;
  height: number;
  overlapX: number;
  overlapY: number;
  offsetX: number;
  offsetY: number;
  columns: number;
  rows: number;
  noise: number;
  bleed: number;
  blur: number;
  outline: number;
  stabilize: number;
}

// ─────────────────────────────────────────────────────────────────
// MAGIC BACKGROUND REMOVAL
// Faithful port of the HTML version (8-directional BFS from ALL edges
// with top-3 dominant background colors detected from ALL border pixels)
// + second pass: checkerboard interior cleanup
// ─────────────────────────────────────────────────────────────────
export function magicBackgroundRemoval(
  canvas: HTMLCanvasElement,
  tolerance: number
): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // ── 1. Sample ALL border pixels to find dominant background colors ──
  const colorCounts: Record<string, number> = {};
  const sample = (x: number, y: number) => {
    const idx = (y * w + x) * 4;
    if (data[idx + 3] > 128) {
      // Quantize to nearest 10 for clustering (same as HTML source)
      const r = Math.round(data[idx]     / 10) * 10;
      const g = Math.round(data[idx + 1] / 10) * 10;
      const b = Math.round(data[idx + 2] / 10) * 10;
      const k = `${r},${g},${b}`;
      colorCounts[k] = (colorCounts[k] || 0) + 1;
    }
  };

  for (let x = 0; x < w; x++) { sample(x, 0); sample(x, h - 1); }
  for (let y = 0; y < h; y++) { sample(0, y); sample(w - 1, y); }

  const sorted = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);

  // Accept up to 3 dominant border colors (threshold: > 2% of perimeter)
  // For checkerboard backgrounds, this captures both white AND gray squares
  interface BgColor { r: number; g: number; b: number }
  const targets: BgColor[] = [];
  for (let i = 0; i < Math.min(4, sorted.length); i++) {
    if (sorted[i][1] > (w + h) * 0.015) {
      const [r, g, b] = sorted[i][0].split(',').map(Number);
      targets.push({ r, g, b });
    }
  }

  if (targets.length === 0) return; // No clear background found

  const tol2 = tolerance * 2; // Manhattan distance threshold (matches HTML)
  const visited = new Uint8Array(w * h);

  // ── 2. 8-directional BFS from ALL edge pixels ──
  // Use flat Int32Array queue for performance (same as HTML source)
  const queue = new Int32Array(w * h * 2);
  let qHead = 0;
  let qTail = 0;

  const pushQ = (x: number, y: number) => {
    const idx = y * w + x;
    if (!visited[idx]) {
      visited[idx] = 1;
      queue[qTail++] = x;
      queue[qTail++] = y;
    }
  };

  for (let x = 0; x < w; x++) { pushQ(x, 0); pushQ(x, h - 1); }
  for (let y = 0; y < h; y++) { pushQ(0, y); pushQ(w - 1, y); }

  while (qHead < qTail) {
    const x = queue[qHead++];
    const y = queue[qHead++];
    const pi = (y * w + x) * 4;

    // If already transparent → propagate but don't check color
    if (data[pi + 3] === 0) {
      if (x > 0)     pushQ(x - 1, y);
      if (x < w - 1) pushQ(x + 1, y);
      if (y > 0)     pushQ(x, y - 1);
      if (y < h - 1) pushQ(x, y + 1);
      continue;
    }

    // Check if this pixel matches any background target color
    let match = false;
    for (const t of targets) {
      const dist = Math.abs(data[pi] - t.r)
                 + Math.abs(data[pi + 1] - t.g)
                 + Math.abs(data[pi + 2] - t.b);
      if (dist < tol2) { match = true; break; }
    }

    if (match) {
      data[pi + 3] = 0; // Erase pixel
      // Propagate in all 8 directions (same as HTML)
      if (x > 0)     pushQ(x - 1, y);
      if (x < w - 1) pushQ(x + 1, y);
      if (y > 0)     pushQ(x, y - 1);
      if (y < h - 1) pushQ(x, y + 1);
      if (x > 0     && y > 0)     pushQ(x - 1, y - 1);
      if (x < w - 1 && y > 0)     pushQ(x + 1, y - 1);
      if (x > 0     && y < h - 1) pushQ(x - 1, y + 1);
      if (x < w - 1 && y < h - 1) pushQ(x + 1, y + 1);
    }
  }

  // ── 3. CHECKERBOARD INTERIOR CLEANUP PASS ──
  // After edge flood-fill, any background-colored pixel that is now
  // completely surrounded by transparent pixels (or more background pixels)
  // is a "trapped" interior checkerboard square. Remove them.
  let changed = true;
  let passes = 0;
  while (changed && passes < 6) {
    changed = false;
    passes++;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const pi = (y * w + x) * 4;
        if (data[pi + 3] === 0) continue; // already transparent

        // Check if matches background
        let isBg = false;
        for (const t of targets) {
          const dist = Math.abs(data[pi] - t.r)
                     + Math.abs(data[pi + 1] - t.g)
                     + Math.abs(data[pi + 2] - t.b);
          if (dist < tol2) { isBg = true; break; }
        }
        if (!isBg) continue;

        // Count transparent 4-neighbours
        let transparentNeighbors = 0;
        if (data[((y - 1) * w + x) * 4 + 3] === 0) transparentNeighbors++;
        if (data[((y + 1) * w + x) * 4 + 3] === 0) transparentNeighbors++;
        if (data[(y * w + x - 1) * 4 + 3] === 0)   transparentNeighbors++;
        if (data[(y * w + x + 1) * 4 + 3] === 0)   transparentNeighbors++;

        // If 3+ neighbours are transparent, this is an isolated BG square → erase
        if (transparentNeighbors >= 3) {
          data[pi + 3] = 0;
          changed = true;
        }
      }
    }
  }

  // ── 4. SEMI-TRANSPARENT FRINGE CLEANUP ──
  // Remove residual near-background fringe pixels (partial transparency left after BG removal)
  // These appear as a halo of "checkerboard ghost" around the sprite
  const halfTol = Math.round(tol2 * 0.7);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    // Check if this pixel is "almost background" with lower threshold
    for (const t of targets) {
      const dist = Math.abs(data[i] - t.r)
                 + Math.abs(data[i + 1] - t.g)
                 + Math.abs(data[i + 2] - t.b);
      if (dist < halfTol) {
        // Graduated fade: the closer to background color, the more transparent
        const ratio = 1 - dist / halfTol;
        const newAlpha = Math.round(data[i + 3] * (1 - ratio * 0.85));
        data[i + 3] = newAlpha;
        break;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

// ────────────────────────────────────────────────────────────
// AI BACKGROUND REMOVAL via @imgly/background-removal
// Call this instead for photographic/complex backgrounds
// Returns a new HTMLCanvasElement with transparent background
// ────────────────────────────────────────────────────────────
export async function aiBackgroundRemoval(
  canvas: HTMLCanvasElement,
  onProgress?: (p: number) => void
): Promise<HTMLCanvasElement> {
  // Dynamic import so the WASM model is only loaded on demand
  const { removeBackground } = await import('@imgly/background-removal');

  // Convert canvas to Blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
  });

  const resultBlob = await removeBackground(blob, {
    progress: (_key, current, total) => {
      if (onProgress) onProgress(total > 0 ? current / total : 0);
    },
    output: { quality: 1, format: 'image/png' as const },
  });

  const url = URL.createObjectURL(resultBlob);
  const img  = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload  = () => resolve(i);
    i.onerror = reject;
    i.src = url;
  });
  URL.revokeObjectURL(url);

  const out = document.createElement('canvas');
  out.width  = canvas.width;
  out.height = canvas.height;
  out.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return out;
}

// ────────────────────────────────────────────────────────────
// NOISE FILTER  – removes isolated pixel artefacts
// ────────────────────────────────────────────────────────────
export function applyNoiseFilter(canvas: HTMLCanvasElement, noiseVal: number): void {
  if (noiseVal <= 0) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;
  const tempData = new Uint8ClampedArray(data);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      if (tempData[idx + 3] > 0) {
        let neighbors = 0;
        for (let ny = -1; ny <= 1; ny++)
          for (let nx = -1; nx <= 1; nx++) {
            if (nx === 0 && ny === 0) continue;
            if (tempData[((y + ny) * width + (x + nx)) * 4 + 3] > 0) neighbors++;
          }
        if (neighbors <= noiseVal) data[idx + 3] = 0;
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// ────────────────────────────────────────────────────────────
// ANTI-BLEED  – clears low-alpha pixels on N border strips
// ────────────────────────────────────────────────────────────
export function applyBleedFilter(canvas: HTMLCanvasElement, bleedVal: number): void {
  if (bleedVal <= 0) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;

  for (let x = 0; x <= bleedVal; x++) {
    for (let y = 0; y < height; y++) {
      const idxL = (y * width + x) * 4;
      if (data[idxL + 3] < 220) data[idxL + 3] = 0;
      const idxR = (y * width + (width - 1 - x)) * 4;
      if (data[idxR + 3] < 220) data[idxR + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// ────────────────────────────────────────────────────────────
// EDGE BLUR (Anti-Aliasing)
// ────────────────────────────────────────────────────────────
export function applyEdgeBlur(canvas: HTMLCanvasElement, blurVal: number): void {
  if (blurVal <= 0) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  for (let pass = 0; pass < blurVal; pass++) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imageData;
    const tempData = new Uint8ClampedArray(data);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        if (tempData[idx + 3] > 0) {
          let isEdge = false;
          outer: for (let ny = -1; ny <= 1; ny++)
            for (let nx = -1; nx <= 1; nx++)
              if (tempData[((y + ny) * width + (x + nx)) * 4 + 3] === 0) { isEdge = true; break outer; }

          if (isEdge) {
            let r = 0, g = 0, b = 0, a = 0;
            for (let ny = -1; ny <= 1; ny++)
              for (let nx = -1; nx <= 1; nx++) {
                const nIdx = ((y + ny) * width + (x + nx)) * 4;
                r += tempData[nIdx]; g += tempData[nIdx + 1];
                b += tempData[nIdx + 2]; a += tempData[nIdx + 3];
              }
            data[idx] = r / 9; data[idx + 1] = g / 9;
            data[idx + 2] = b / 9; data[idx + 3] = a / 9;
          }
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }
}

// ────────────────────────────────────────────────────────────
// OUTLINE  – shadow-projection technique
// ────────────────────────────────────────────────────────────
export function applyOutline(canvas: HTMLCanvasElement, outlineVal: number): void {
  if (outlineVal <= 0) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const tmp = document.createElement('canvas');
  tmp.width = canvas.width; tmp.height = canvas.height;
  tmp.getContext('2d')!.drawImage(canvas, 0, 0);

  ctx.save();
  ctx.shadowColor = 'black'; ctx.shadowBlur = 0;
  const steps = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,1],[-1,1],[1,-1]];
  for (let s = 1; s <= outlineVal; s++) {
    for (const [ox, oy] of steps) {
      ctx.shadowOffsetX = ox * s;
      ctx.shadowOffsetY = oy * s;
      ctx.drawImage(tmp, 0, 0);
    }
  }
  ctx.restore();
  ctx.drawImage(tmp, 0, 0);
}

// ────────────────────────────────────────────────────────────
// BOUNDING BOX
// ────────────────────────────────────────────────────────────
export function getBoundingBox(
  canvas: HTMLCanvasElement
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const w = canvas.width, h = canvas.height;
  let minX = w, minY = h, maxX = 0, maxY = 0, hasPixels = false;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) {
      const px = (i / 4) % w, py = Math.floor((i / 4) / w);
      minX = Math.min(minX, px); minY = Math.min(minY, py);
      maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
      hasPixels = true;
    }
  }
  return hasPixels ? { minX, minY, maxX, maxY } : null;
}

// ────────────────────────────────────────────────────────────
// STABILIZATION (center-of-mass alignment)
// ────────────────────────────────────────────────────────────
export function getAlignmentOffset(
  canvas: HTMLCanvasElement,
  stabilize: number
): { dx: number; dy: number } {
  if (stabilize <= 0) return { dx: 0, dy: 0 };
  const bounds = getBoundingBox(canvas);
  if (!bounds) return { dx: 0, dy: 0 };
  const { minX, maxX, minY, maxY } = bounds;
  const dx = ((canvas.width  / 2) - (minX + (maxX - minX) / 2)) * (stabilize / 100);
  const dy = ((canvas.height / 2) - (minY + (maxY - minY) / 2)) * (stabilize / 100);
  return { dx, dy };
}

// ────────────────────────────────────────────────────────────
// CANVAS CLONE
// ────────────────────────────────────────────────────────────
export function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const dst = document.createElement('canvas');
  dst.width = src.width; dst.height = src.height;
  dst.getContext('2d')!.drawImage(src, 0, 0);
  return dst;
}
