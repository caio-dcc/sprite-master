// ────────────────────────────────────────────────────────────
// useSpriteProcessor.ts
// Core state + processing logic for the Sprite Master Ultra
// ────────────────────────────────────────────────────────────
import { useState, useCallback, useRef } from 'react';
import {
  magicBackgroundRemoval,
  aiBackgroundRemoval,
  applyNoiseFilter,
  applyBleedFilter,
  applyEdgeBlur,
  applyOutline,
  getAlignmentOffset,
  cloneCanvas,
} from '../utils/imageProcessing';
import type { GridParams, SpriteSlice } from '../utils/imageProcessing';

export { type GridParams, type SpriteSlice };

export type FrameState = SpriteSlice & {
  originalCanvas: HTMLCanvasElement; // untouched copy for restore
  excluded: boolean;
  deleted: boolean; // soft-deleted but restorable
  duplicatedFrom?: number;
};

export function useSpriteProcessor() {
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [uploadHistory, setUploadHistory] = useState<HTMLImageElement[]>([]);
  const [selectedRef, setSelectedRef]   = useState<HTMLImageElement | null>(null);
  const [frames, setFrames]             = useState<FrameState[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [magicTolerance, setMagicTolerance] = useState(30);
  const [showGuidelines, setShowGuidelines] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Build raw canvas for a single cell ──
  function buildCellCanvas(
    img: HTMLImageElement,
    x: number, y: number, cw: number, ch: number
  ): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, x, y, cw, ch, 0, 0, cw, ch);
    return c;
  }

  // ── Apply all filter passes to a canvas (mutates it) ──
  function applyFilters(c: HTMLCanvasElement, p: GridParams) {
    if (p.bleed  > 0) applyBleedFilter(c, p.bleed);
    if (p.noise  > 0) applyNoiseFilter(c, p.noise);
    if (p.blur   > 0) applyEdgeBlur(c, p.blur);
    if (p.outline > 0) applyOutline(c, p.outline);
    // Stabilization (shift after all other filters)
    if (p.stabilize > 0) {
      const { dx, dy } = getAlignmentOffset(c, p.stabilize);
      if (dx !== 0 || dy !== 0) {
        const tmp = document.createElement('canvas');
        tmp.width = c.width; tmp.height = c.height;
        const tCtx = tmp.getContext('2d')!;
        tCtx.imageSmoothingEnabled = false;
        tCtx.drawImage(c, Math.round(dx), Math.round(dy));
        c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
        c.getContext('2d')!.drawImage(tmp, 0, 0);
      }
    }
  }

  // ── Main slice + filter processing ──
  const processSlices = useCallback(async (params: GridParams) => {
    if (!sourceImage) return;
    setIsProcessing(true);

    const { width: cw, height: ch, columns: cols, rows, offsetX, offsetY, overlapX, overlapY } = params;
    const newFrames: FrameState[] = [];
    let index = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = offsetX + c * (cw - overlapX);
        const y = offsetY + r * (ch - overlapY);

        const raw  = buildCellCanvas(sourceImage, x, y, cw, ch);
        const proc = buildCellCanvas(sourceImage, x, y, cw, ch);
        applyFilters(proc, params);

        newFrames.push({
          canvas: proc,
          originalCanvas: raw,
          x, y,
          width: cw, height: ch,
          index,
          name: `frame_${String(index).padStart(2, '0')}.png`,
          excluded: false,
          deleted: false,
        });
        index++;
      }
    }

    setFrames(newFrames);
    setIsProcessing(false);
  }, [sourceImage]);

  // ── Re-apply filters to existing frames (called when params change post-magic) ──
  const reprocessFrames = useCallback((params: GridParams) => {
    setFrames(prev => prev.map(f => {
      if (f.deleted) return f;
      const proc = cloneCanvas(f.originalCanvas);
      applyFilters(proc, params);
      return { ...f, canvas: proc };
    }));
  }, []);

  // ── Magic (algorithmic) background removal on all non-deleted frames ──
  const runMagicBgRemoval = useCallback((params: GridParams) => {
    setIsProcessing(true);
    const loader = document.getElementById('global-loader');
    if (loader) loader.classList.add('active');

    setTimeout(() => {
      setFrames(prev => prev.map(f => {
        if (f.deleted) return f;
        const proc = cloneCanvas(f.originalCanvas);
        magicBackgroundRemoval(proc, magicTolerance);
        applyFilters(proc, params);
        return { ...f, canvas: proc };
      }));
      setIsProcessing(false);
      if (loader) loader.classList.remove('active');
    }, 50);
  }, [magicTolerance]);

  // ── AI background removal (neural network via @imgly/background-removal) ──
  const [aiProgress, setAiProgress] = useState(0);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  const runAiBgRemoval = useCallback(async (params: GridParams) => {
    setIsAiProcessing(true);
    setAiProgress(0);
    const loader = document.getElementById('global-loader');
    const loaderText = document.getElementById('loader-text');
    const loaderSub  = document.getElementById('loader-subtext');
    if (loader) loader.classList.add('active');
    if (loaderText) loaderText.textContent = 'Removendo Fundo com IA...';
    if (loaderSub)  loaderSub.textContent  = 'Carregando modelo neural (primeira vez pode demorar)...';

    try {
      const updated: FrameState[] = [];
      const active = frames.filter(f => !f.deleted);
      for (let i = 0; i < active.length; i++) {
        const f = active[i];
        if (loaderText) loaderText.textContent = `IA: Frame ${i + 1} / ${active.length}...`;
        const src = cloneCanvas(f.originalCanvas);
        const resultCanvas = await aiBackgroundRemoval(src, (p) => setAiProgress(p));
        applyFilters(resultCanvas, params);
        updated.push({ ...f, canvas: resultCanvas });
      }
      // Merge results back
      setFrames(prev => prev.map(f => {
        const upd = updated.find(u => u.index === f.index);
        return upd ?? f;
      }));
    } catch (err) {
      console.error('AI removal failed:', err);
      alert('Erro no modo IA. Verifique a conexão ou use o modo mágico algortmico.');
    } finally {
      setIsAiProcessing(false);
      setAiProgress(0);
      if (loader) loader.classList.remove('active');
    }
  }, [frames]);

  // ── Auto-fix flicker: re-process all frames with stabilize=100 ──
  const runAutoFixFlicker = useCallback((params: GridParams) => {
    reprocessFrames({ ...params, stabilize: 100 });
  }, [reprocessFrames]);

  // ── Toggle exclude ──
  const toggleExclusion = useCallback((index: number) => {
    setFrames(prev => prev.map(f =>
      f.index === index ? { ...f, excluded: !f.excluded } : f
    ));
  }, []);

  // ── Soft delete (can be restored) ──
  const deleteFrame = useCallback((index: number) => {
    setFrames(prev => prev.map(f =>
      f.index === index ? { ...f, deleted: true } : f
    ));
  }, []);

  // ── Restore a deleted frame ──
  const restoreFrame = useCallback((index: number) => {
    setFrames(prev => prev.map(f =>
      f.index === index ? { ...f, deleted: false, excluded: false } : f
    ));
  }, []);

  // ── Duplicate a frame (inserted right after the source) ──
  const duplicateFrame = useCallback((index: number) => {
    setFrames(prev => {
      const pos = prev.findIndex(f => f.index === index);
      if (pos === -1) return prev;
      const src = prev[pos];
      const dup: FrameState = {
        ...src,
        canvas: cloneCanvas(src.canvas),
        originalCanvas: cloneCanvas(src.originalCanvas),
        index: Date.now(), // unique id
        name: `frame_copy_${Math.random().toString(36).slice(2, 6)}.png`,
        excluded: false,
        deleted: false,
        duplicatedFrom: src.index,
      };
      const next = [...prev];
      next.splice(pos + 1, 0, dup);
      return next;
    });
  }, []);

  // ── Reorder via drag-drop ──
  const reorderFrames = useCallback((fromIndex: number, toIndex: number) => {
    setFrames(prev => {
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
  }, []);

  // ── Load image file ──
  const loadFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setSourceImage(img);
        setUploadHistory(prev => {
          // Avoid duplicates by checking source URL
          if (prev.some(p => p.src === img.src)) return prev;
          return [...prev, img];
        });
        setSelectedRef(img);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  // ── Update a single frame's canvas (after editor save) ──
  const updateFrameCanvas = useCallback((index: number, newCanvas: HTMLCanvasElement) => {
    setFrames(prev => prev.map(f =>
      f.index === index ? { ...f, canvas: newCanvas } : f
    ));
  }, []);

  // ── Apply color adjustments to ALL active frames ──
  const applyAdjustmentsToAll = useCallback((adj: { brightness: number, contrast: number, saturation: number, hue: number }) => {
    const filter = `brightness(${adj.brightness}%) contrast(${adj.contrast}%) saturate(${adj.saturation}%) hue-rotate(${adj.hue}deg)`;
    
    setFrames(prev => prev.map(f => {
      if (f.deleted) return f;
      
      const tmp = document.createElement('canvas');
      tmp.width  = f.canvas.width;
      tmp.height = f.canvas.height;
      const tCtx = tmp.getContext('2d')!;
      tCtx.filter = filter;
      tCtx.drawImage(f.canvas, 0, 0);
      
      const newCanvas = document.createElement('canvas');
      newCanvas.width  = f.canvas.width;
      newCanvas.height = f.canvas.height;
      newCanvas.getContext('2d')!.drawImage(tmp, 0, 0);
      
      return { ...f, canvas: newCanvas };
    }));
  }, []);

  // active (non-deleted) frames for display
  const activeFrames = frames.filter(f => !f.deleted);
  const deletedFrames = frames.filter(f => f.deleted);

  return {
    sourceImage,
    uploadHistory,
    selectedRef, setSelectedRef,
    frames,
    activeFrames,
    deletedFrames,
    isProcessing,
    isAiProcessing,
    aiProgress,
    magicTolerance, setMagicTolerance,
    showGuidelines, setShowGuidelines,
    processSlices,
    reprocessFrames,
    runMagicBgRemoval,
    runAiBgRemoval,
    runAutoFixFlicker,
    toggleExclusion,
    deleteFrame,
    restoreFrame,
    duplicateFrame,
    reorderFrames,
    updateFrameCanvas,
    applyAdjustmentsToAll,
    loadFile,
    fileInputRef,
  };
}
