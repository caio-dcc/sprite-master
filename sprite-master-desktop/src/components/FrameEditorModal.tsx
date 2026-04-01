// ─────────────────────────────────────────────────────────────────
// FrameEditorModal.tsx
// Full canvas editor for individual sprite frames.
// Tools: Eraser (B), Brush/Pencil (C), Eyedropper (Z), Move (Space)
// + Color Adjustments: Contrast, Matrix (Hue), Brightness, Saturation
// ─────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback } from 'react';
import type { FrameState } from '../hooks/useSpriteProcessor';

export interface Adjustments {
  brightness: number; // 0–200 (100 = normal)
  contrast:   number; // 0–200 (100 = normal)
  saturation: number; // 0–200 (100 = normal)
  hue:        number; // -180 to 180 degrees
}

interface Props {
  frame: FrameState | null;
  onClose: () => void;
  onSave: (frameIndex: number, canvas: HTMLCanvasElement) => void;
  onApplyToAll?: (adj: Adjustments) => void;
}

type Tool = 'eraser' | 'brush' | 'eyedropper' | 'move' | 'colorEraser';

const DEFAULT_ADJ: Adjustments = { brightness: 100, contrast: 100, saturation: 100, hue: 0 };

export function FrameEditorModal({ frame, onClose, onSave, onApplyToAll }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const wrapRef    = useRef<HTMLDivElement>(null);

  // Tool state
  const [tool, setTool]             = useState<Tool>('eraser');
  const [prevTool, setPrevTool]     = useState<Tool>('eraser'); // for space-hold swap
  const [brushSize, setBrushSize]   = useState(12);
  const [brushColor, setBrushColor] = useState('#ff0000');
  const [opacity, setOpacity]       = useState(1.0);
  const [zoom, setZoom]             = useState(1);
  const [panX, setPanX]             = useState(0);
  const [panY, setPanY]             = useState(0);
  const [eyedropResult, setEyedropResult] = useState<string | null>(null);
  const [colorEraserTolerance, setColorEraserTolerance] = useState(30);

  // Color adjustments (live preview via CSS filter, baked on Apply)
  const [adj, setAdj]               = useState<Adjustments>(DEFAULT_ADJ);

  // Interaction refs
  const drawing      = useRef(false);
  const lastPos      = useRef<{ x: number; y: number } | null>(null);
  const panStart     = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const backupCanvas = useRef<HTMLCanvasElement | null>(null);
  const spaceHeld    = useRef(false);

  // ── Reset on frame change ──
  useEffect(() => {
    if (!frame) return;
    setZoom(1); setPanX(0); setPanY(0);
    setEyedropResult(null);
    setAdj(DEFAULT_ADJ);
  }, [frame?.index]);

  // ── Load frame into canvas ──
  useEffect(() => {
    if (!frame || !canvasRef.current) return;
    const c = canvasRef.current;
    c.width  = frame.canvas.width;
    c.height = frame.canvas.height;
    c.getContext('2d', { willReadFrequently: true })!.drawImage(frame.canvas, 0, 0);
  }, [frame]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    if (!frame) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      switch (e.code) {
        case 'KeyB':
          setTool('eraser');
          break;
        case 'KeyC':
          setTool('brush');
          break;
        case 'KeyW':
          setTool('colorEraser');
          break;
        case 'KeyZ':
          if (!e.ctrlKey && !e.metaKey) { // don't block undo
            e.preventDefault();
            setTool('eyedropper');
          }
          break;
        case 'Space':
          e.preventDefault();
          if (!spaceHeld.current) {
            spaceHeld.current = true;
            setPrevTool(t => { setTool('move'); return t; });
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld.current = false;
        setTool(prevTool);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [frame, prevTool, onClose]);

  // ── CSS filter string from adjustments (live preview only) ──
  const filterStr = `brightness(${adj.brightness}%) contrast(${adj.contrast}%) saturate(${adj.saturation}%) hue-rotate(${adj.hue}deg)`;
  const adjIsDefault = adj.brightness === 100 && adj.contrast === 100 && adj.saturation === 100 && adj.hue === 0;

  // ── Bake adjustments into canvas pixels permanently ──
  const applyAdjustments = useCallback(() => {
    if (!canvasRef.current || adjIsDefault) return;
    saveBackup();
    const src = canvasRef.current;
    const tmp = document.createElement('canvas');
    tmp.width  = src.width;
    tmp.height = src.height;
    const tCtx = tmp.getContext('2d')!;
    tCtx.filter = filterStr;
    tCtx.drawImage(src, 0, 0);
    tCtx.filter = 'none';
    src.getContext('2d')!.clearRect(0, 0, src.width, src.height);
    src.getContext('2d')!.drawImage(tmp, 0, 0);
    setAdj(DEFAULT_ADJ);
  }, [adjIsDefault, filterStr]);

  // ── Canvas coordinate from mouse ──
  const getCanvasPos = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left)  / zoom,
      y: (e.clientY - rect.top)   / zoom,
    };
  }, [zoom]);

  // ── Paint a line segment ──
  const paintSegment = useCallback((
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to:   { x: number; y: number }
  ) => {
    ctx.save();
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    } else if (tool === 'colorEraser') {
      // Per-pixel selective removal
      const radius = brushSize / 2;
      const x0 = Math.floor(Math.min(from.x, to.x) - radius);
      const y0 = Math.floor(Math.min(from.y, to.y) - radius);
      const x1 = Math.ceil(Math.max(from.x, to.x) + radius);
      const y1 = Math.ceil(Math.max(from.y, to.y) + radius);
      
      const width = x1 - x0;
      const height = y1 - y0;
      if (width <= 0 || height <= 0) return;
      
      const imgData = ctx.getImageData(x0, y0, width, height);
      const data = imgData.data;
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const px = x0 + x;
          const py = y0 + y;
          const dist = distToSegment({ x: px, y: py }, from, to);
          if (dist <= radius) {
            const idx = (y * width + x) * 4;
            const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
            if (a > 0) {
              const maxVal = Math.max(r, g, b);
              const minVal = Math.min(r, g, b);
              // Neutral check (Grey/White)
              const isNeutral = (maxVal - minVal) < colorEraserTolerance;
              // Brightness check (prevents erasing dark neutral colors like black/dark grey)
              const isBright = (r + g + b) / 3 > 80; 
              
              if (isNeutral && isBright) {
                data[idx + 3] = 0;
              }
            }
          }
        }
      }
      ctx.putImageData(imgData, x0, y0);
    } else {
      ctx.globalCompositeOperation = 'source-over';
      const { r, g, b } = hexToRgb(brushColor);
      ctx.strokeStyle = `rgba(${r},${g},${b},${opacity})`;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }

    ctx.restore();
  }, [tool, brushSize, brushColor, opacity, colorEraserTolerance]);

  // ── Eyedropper ──
  const pickColor = useCallback((x: number, y: number) => {
    const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const px = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    const hex = `#${px[0].toString(16).padStart(2,'0')}${px[1].toString(16).padStart(2,'0')}${px[2].toString(16).padStart(2,'0')}`;
    setBrushColor(hex);
    setEyedropResult(`rgba(${px[0]},${px[1]},${px[2]},${(px[3]/255).toFixed(2)})`);
    setTool('brush');
  }, []);

  // ── Backup (single-level undo) ──
  const saveBackup = useCallback(() => {
    if (!canvasRef.current) return;
    const b = document.createElement('canvas');
    b.width  = canvasRef.current.width;
    b.height = canvasRef.current.height;
    b.getContext('2d')!.drawImage(canvasRef.current, 0, 0);
    backupCanvas.current = b;
  }, []);

  const undo = useCallback(() => {
    if (!canvasRef.current || !backupCanvas.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.drawImage(backupCanvas.current, 0, 0);
  }, []);

  // ── Mouse events ──
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    e.preventDefault();

    if (tool === 'move') {
      panStart.current = { x: e.clientX, y: e.clientY, px: panX, py: panY };
      return;
    }

    drawing.current = true;
    const pos = getCanvasPos(e);
    lastPos.current = pos;

    if (tool === 'eyedropper') {
      pickColor(pos.x, pos.y);
      drawing.current = false;
      return;
    }

    saveBackup();
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true })!;
    paintSegment(ctx, pos, pos);
  }, [tool, panX, panY, getCanvasPos, pickColor, saveBackup, paintSegment]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return;

    if (tool === 'move' && panStart.current) {
      setPanX(panStart.current.px + e.clientX - panStart.current.x);
      setPanY(panStart.current.py + e.clientY - panStart.current.y);
      return;
    }

    if (!drawing.current) return;
    const pos = getCanvasPos(e);
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true })!;
    if (lastPos.current) paintSegment(ctx, lastPos.current, pos);
    lastPos.current = pos;
  }, [tool, getCanvasPos, paintSegment]);

  const onMouseUp = useCallback(() => {
    drawing.current = false;
    lastPos.current = null;
    panStart.current = null;
  }, []);

  // ── Wheel zoom ──
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom(z => Math.min(16, Math.max(0.25, +(z + delta).toFixed(2))));
  }, []);

  // ── Save ──
  const handleSave = useCallback(() => {
    if (!frame || !canvasRef.current) return;
    if (!adjIsDefault) applyAdjustments();
    const out = document.createElement('canvas');
    out.width  = canvasRef.current.width;
    out.height = canvasRef.current.height;
    const outCtx = out.getContext('2d')!;
    outCtx.filter = adjIsDefault ? 'none' : filterStr;
    outCtx.drawImage(canvasRef.current, 0, 0);
    onSave(frame.index, out);
    onClose();
  }, [frame, adjIsDefault, filterStr, applyAdjustments, onSave, onClose]);

  // ── Reset ──
  const handleReset = useCallback(() => {
    if (!frame || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.drawImage(frame.canvas, 0, 0);
    setAdj(DEFAULT_ADJ);
  }, [frame]);

  if (!frame) return null;

  const cursorStyle: React.CSSProperties['cursor'] =
    tool === 'eraser' || tool === 'colorEraser' ? 'cell'
    : tool === 'brush'    ? 'crosshair'
    : tool === 'eyedropper' ? 'copy'
    : 'grab';

  const upd = (k: keyof Adjustments, v: number) => setAdj(a => ({ ...a, [k]: v }));

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(2,6,23,0.97)',
        backdropFilter: 'blur(16px)',
        display: 'flex', flexDirection: 'column',
      }}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* ─── Header ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', borderBottom: '1px solid #1e293b',
        background: '#0f172a', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 6, height: 22, background: '#3b82f6', borderRadius: 4 }} />
          <span style={{ fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
            Editor de Quadro
          </span>
          <span style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', background: '#020617', padding: '2px 8px', borderRadius: 6 }}>
            {frame.canvas.width} × {frame.canvas.height} px
          </span>
          {/* Active tool badge */}
          <span style={{
            fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
            padding: '3px 10px', borderRadius: 20,
            background: tool === 'eraser' ? 'rgba(239,68,68,0.2)' : tool === 'colorEraser' ? 'rgba(241,245,249,0.2)' : tool === 'brush' ? 'rgba(59,130,246,0.2)' : tool === 'eyedropper' ? 'rgba(16,185,129,0.2)' : 'rgba(139,92,246,0.2)',
            color: tool === 'eraser' ? '#ef4444' : tool === 'colorEraser' ? '#f1f5f9' : tool === 'brush' ? '#60a5fa' : tool === 'eyedropper' ? '#34d399' : '#a78bfa',
            border: '1px solid currentColor',
          }}>
            {tool === 'eraser' ? '⌫ Borracha [B]' : tool === 'colorEraser' ? '🧹 Limpa Brancos [W]' : tool === 'brush' ? '🖌 Pincel [C]' : tool === 'eyedropper' ? '💧 Conta-Gotas [Z]' : '✥ Mover [Space]'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={undo} style={oBtn('#f59e0b')}>↩ Desfazer</button>
          <button onClick={handleReset} style={oBtn('#94a3b8')}>↺ Restaurar</button>
          <button onClick={handleSave} style={{ ...oBtn('#3b82f6'), background: '#1d4ed8', fontWeight: 900 }}>Salvar ✓</button>
          <button onClick={onClose} style={oBtn('#ef4444')}>✕</button>
        </div>
      </div>

      {/* ─── Body ─── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Left Sidebar (Toolbox) ── */}
        <aside style={{
          width: 196, flexShrink: 0,
          background: '#0f172a', borderRight: '1px solid #1e293b',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto', overflowX: 'hidden',
        }}>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* ── Tool Buttons ── */}
            <div>
              <SectionLabel>Ferramentas</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <ToolBtn active={tool === 'eraser'}      color="#ef4444" icon="⌫" label="Borracha [B]" onClick={() => { saveBackup(); setTool('eraser');      setPrevTool('eraser');      }} />
                <ToolBtn active={tool === 'colorEraser'} color="#f1f5f9" icon="🧹" label="L. Brancos [W]" onClick={() => { saveBackup(); setTool('colorEraser'); setPrevTool('colorEraser'); }} />
                <ToolBtn active={tool === 'brush'}       color="#3b82f6" icon="🖌" label="Pincel [C]"   onClick={() => { saveBackup(); setTool('brush');       setPrevTool('brush');       }} />
                <ToolBtn active={tool === 'eyedropper'}  color="#10b981" icon="💧" label="Gotas [Z]"    onClick={() => {                setTool('eyedropper');  setPrevTool('eyedropper');  }} />
                <ToolBtn active={tool === 'move'}        color="#8b5cf6" icon="✥"  label="Mover [⎵]"   onClick={() => {                setTool('move');        setPrevTool('move');        }} />
              </div>
              {/* Keyboard hint */}
              <div style={{ marginTop: 8, fontSize: 8, color: '#334155', lineHeight: 1.6, textAlign: 'center', fontFamily: 'monospace' }}>
                B=Borracha • W=Limpa Brancos • C=Pincel • Z=Gotas • ⎵=Mover
              </div>
            </div>

            {/* ── Brush Size ── */}
            <div>
              <SectionLabel right={`${brushSize}px`}>Tamanho</SectionLabel>
              <input type="range" className="custom-range" min={1} max={80} value={brushSize}
                onChange={e => setBrushSize(Number(e.target.value))} />
              <div style={{ display: 'flex', gap: 3, marginTop: 5 }}>
                {[1, 4, 8, 16, 32].map(s => (
                  <button key={s} onClick={() => setBrushSize(s)} style={{
                    flex: 1, background: brushSize === s ? '#3b82f6' : '#1e293b',
                    border: 'none', borderRadius: 5, color: '#fff', fontSize: 7,
                    padding: '3px 0', cursor: 'pointer', fontWeight: 700,
                  }}>{s}</button>
                ))}
              </div>
            </div>

            {/* ── Brush Color (brush mode only) ── */}
            {tool === 'brush' && (
              <div>
                <SectionLabel>Cor do Pincel</SectionLabel>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <input type="color" value={brushColor} onChange={e => setBrushColor(e.target.value)}
                    style={{ width: 36, height: 30, border: 'none', borderRadius: 8, padding: 2, cursor: 'pointer', background: 'none' }} />
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#94a3b8' }}>{brushColor}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {['#ffffff','#000000','#ef4444','#f59e0b','#22c55e','#3b82f6','#8b5cf6','#ec4899'].map(c => (
                    <button key={c} onClick={() => setBrushColor(c)} title={c} style={{
                      width: 18, height: 18, borderRadius: 4, cursor: 'pointer',
                      background: c, border: brushColor === c ? '2px solid #f1f5f9' : '1px solid #334155',
                    }} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Eyedropper result ── */}
            {eyedropResult && (
              <div style={{ background: '#020617', padding: 8, borderRadius: 8, border: '1px solid #1e293b' }}>
                <SectionLabel>Cor Capturada</SectionLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 5, background: brushColor, border: '1px solid #334155', flexShrink: 0 }} />
                  <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#94a3b8', wordBreak: 'break-all' }}>{eyedropResult}</span>
                </div>
              </div>
            )}

            {/* ── Color Eraser Tolerance ── */}
            {tool === 'colorEraser' && (
              <div>
                <SectionLabel right={`${colorEraserTolerance}`}>Sensibilidade (Cor)</SectionLabel>
                <input type="range" className="custom-range" min={1} max={150} value={colorEraserTolerance}
                  onChange={e => setColorEraserTolerance(Number(e.target.value))} />
              </div>
            )}

            {/* ── Opacity ── */}
            <div>
              <SectionLabel right={`${Math.round(opacity * 100)}%`}>Opacidade</SectionLabel>
              <input type="range" className="custom-range" min={0} max={100} value={Math.round(opacity * 100)}
                onChange={e => setOpacity(Number(e.target.value) / 100)} />
            </div>

            {/* ── Zoom ── */}
            <div>
              <SectionLabel>Zoom</SectionLabel>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 5 }}>
                <button onClick={() => setZoom(z => Math.max(0.25, +(z - 0.5).toFixed(2)))} style={zoomBtn}>−</button>
                <span style={{ flex: 1, textAlign: 'center', fontSize: 11, fontFamily: 'monospace' }}>{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(16, +(z + 0.5).toFixed(2)))} style={zoomBtn}>+</button>
              </div>
              <div style={{ display: 'flex', gap: 3 }}>
                {[0.5, 1, 2, 4, 8].map(z => (
                  <button key={z} onClick={() => { setZoom(z); setPanX(0); setPanY(0); }} style={{
                    flex: 1, background: zoom === z ? '#3b82f6' : '#1e293b',
                    border: 'none', borderRadius: 5, color: '#fff', fontSize: 7,
                    padding: '3px 0', cursor: 'pointer', fontWeight: 700,
                  }}>{z === 0.5 ? '½' : `${z}×`}</button>
                ))}
              </div>
              <button onClick={() => { setZoom(1); setPanX(0); setPanY(0); }}
                style={{ ...oBtn('#475569'), marginTop: 6, width: '100%', fontSize: 9, padding: '4px 0' }}>
                Centralizar
              </button>
            </div>

            {/* ── Brush preview ── */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', fontWeight: 700 }}>Preview</div>
              <div className="sprite-grid-bg" style={{
                width: 70, height: 70, borderRadius: 10, border: '1px solid #1e293b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width:  Math.min(62, brushSize * 2),
                  height: Math.min(62, brushSize * 2),
                  borderRadius: '50%', transition: 'all 0.1s',
                  background: tool === 'eraser' || tool === 'colorEraser'
                    ? `rgba(239,68,68,${opacity})`
                    : `${brushColor}${Math.round(opacity * 255).toString(16).padStart(2,'0')}`,
                }} />
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              COLOR ADJUSTMENTS PANEL (bottom of sidebar)
              ═══════════════════════════════════════════ */}
          <div style={{
            marginTop: 'auto',
            background: '#020617',
            borderTop: '1px solid #1e293b',
            padding: 14,
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 2,
            }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Ajustes de Cor
              </span>
              {!adjIsDefault && (
                <button
                  onClick={() => setAdj(DEFAULT_ADJ)}
                  style={{ fontSize: 8, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                >Resetar</button>
              )}
            </div>

            {/* Brightness / Brilho */}
            <AdjSlider
              label="Brilho" unit="%" value={adj.brightness}
              min={0} max={200} neutral={100}
              color="#fbbf24"
              onChange={v => upd('brightness', v)}
            />

            {/* Contrast / Contraste */}
            <AdjSlider
              label="Contraste" unit="%" value={adj.contrast}
              min={0} max={200} neutral={100}
              color="#94a3b8"
              onChange={v => upd('contrast', v)}
            />

            {/* Saturation / Intensidade de Cores */}
            <AdjSlider
              label="Saturação" unit="%" value={adj.saturation}
              min={0} max={200} neutral={100}
              color="#ec4899"
              onChange={v => upd('saturation', v)}
            />

            {/* Hue / Matriz de Cores */}
            <AdjSlider
              label="Matriz (Hue)" unit="°" value={adj.hue}
              min={-180} max={180} neutral={0}
              color="#818cf8"
              onChange={v => upd('hue', v)}
            />

            {/* Live preview note + apply button */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {!adjIsDefault && (
                <>
                  <div style={{ fontSize: 8, color: '#334155', textAlign: 'center', fontStyle: 'italic' }}>
                    Preview ao vivo — aplicar para gravar
                  </div>
                  <button
                    onClick={applyAdjustments}
                    style={{
                      width: '100%', padding: '8px 0',
                      background: 'rgba(129,140,248,0.15)',
                      border: '1px solid rgba(129,140,248,0.3)',
                      borderRadius: 10, color: '#818cf8',
                      fontSize: 9, fontWeight: 900, textTransform: 'uppercase',
                      letterSpacing: '0.08em', cursor: 'pointer',
                    }}
                  >Aplicar Neste Quadro ✓</button>
                </>
              )}
              
              {onApplyToAll && (
                <button
                  onClick={() => {
                    if (confirm('Aplicar estes ajustes de cor a TODOS os quadros ativos?')) {
                      onApplyToAll(adj);
                    }
                  }}
                  style={{
                    width: '100%', padding: '8px 0',
                    background: 'rgba(34,197,94,0.1)',
                    border: '1px solid rgba(34,197,94,0.25)',
                    borderRadius: 10, color: '#22c55e',
                    fontSize: 9, fontWeight: 900, textTransform: 'uppercase',
                    letterSpacing: '0.08em', cursor: 'pointer',
                  }}
                >Aplicar a TODOS os Quadros ⧉</button>
              )}
            </div>
          </div>
        </aside>

        {/* ── Canvas Area ── */}
        <div
          ref={wrapRef}
          style={{
            flex: 1, overflow: 'hidden', position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#020617',
            cursor: cursorStyle,
          }}
          onWheel={onWheel}
        >
          {/* Pixel grid at high zoom */}
          {zoom >= 4 && (
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5,
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
              `,
              backgroundSize: `${zoom}px ${zoom}px`,
              backgroundPosition: `${panX}px ${panY}px`,
            }} />
          )}

          {/* Editable canvas — CSS filter applies adjustment preview */}
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              left: `calc(50% + ${panX}px)`,
              top:  `calc(50% + ${panY}px)`,
              transform: `translate(-50%, -50%) scale(${zoom})`,
              transformOrigin: 'center',
              imageRendering: 'pixelated',
              cursor: cursorStyle,
              filter: filterStr,
              boxShadow: `
                0 0 0 1px rgba(255,255,255,0.08),
                0 24px 80px rgba(0,0,0,0.9)
              `,
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
          />

          {/* Status bar */}
          <div style={{
            position: 'absolute', bottom: 12, right: 12,
            fontSize: 9, color: '#1e293b', fontFamily: 'monospace',
            background: '#0f172a', padding: '3px 10px', borderRadius: 8,
            border: '1px solid #1e293b', pointerEvents: 'none',
            display: 'flex', gap: 16,
          }}>
            <span>🖱 Scroll = Zoom</span>
            <span>⎵ Space = Mover</span>
            <span>B / W / C / Z = Ferr.</span>
            <span>{Math.round(zoom * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────

function SectionLabel({ children, right }: { children: React.ReactNode; right?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
      <span>{children}</span>
      {right && <span style={{ color: '#f1f5f9', fontFamily: 'monospace' }}>{right}</span>}
    </div>
  );
}

function ToolBtn({ active, color, icon, label, onClick }: {
  active: boolean; color: string; icon: string; label: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 3, padding: '7px 4px',
      background: active ? `${color}25` : 'rgba(255,255,255,0.03)',
      border: `1px solid ${active ? color + '60' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 10, cursor: 'pointer', transition: 'all 0.12s',
      color: active ? color : '#475569',
      boxShadow: active ? `0 0 10px ${color}33` : 'none',
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2, textAlign: 'center' }}>{label}</span>
    </button>
  );
}

function AdjSlider({ label, unit, value, min, max, neutral, color, onChange }: {
  label: string; unit: string; value: number;
  min: number; max: number; neutral: number;
  color: string;
  onChange: (v: number) => void;
}) {
  const isChanged = value !== neutral;
  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 9, fontWeight: 700, marginBottom: 5,
        color: isChanged ? color : '#334155',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        <span>{label}</span>
        <span style={{ fontFamily: 'monospace', color: isChanged ? color : '#475569' }}>
          {value > 0 && unit === '°' && value > neutral ? `+${value}` : value}{unit}
        </span>
      </div>
      <input
        type="range" className="custom-range"
        min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ accentColor: color }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Style helpers
// ─────────────────────────────────────────────────────────────────
const oBtn = (color: string): React.CSSProperties => ({
  background: `${color}15`, border: `1px solid ${color}35`,
  borderRadius: 9, padding: '6px 12px', color,
  fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
  fontWeight: 600, transition: 'all 0.15s',
});

const zoomBtn: React.CSSProperties = {
  width: 28, height: 28,
  background: '#1e293b', border: '1px solid #334155',
  borderRadius: 7, color: '#f1f5f9', fontSize: 15,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
};

function hexToRgb(hex: string) {
  const c = hex.replace('#', '');
  return {
    r: parseInt(c.substring(0, 2), 16) || 0,
    g: parseInt(c.substring(2, 4), 16) || 0,
    b: parseInt(c.substring(4, 6), 16) || 0,
  };
}

// ── Distance from point to line segment ──
function distToSegment(p: { x: number; y: number }, v: { x: number; y: number }, w: { x: number; y: number }) {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt((p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2);
}
