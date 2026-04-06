// ────────────────────────────────────────────────────────────
// App.tsx  –  Unified Dashboard (Slicer + Inline Editor)
// ────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSpriteProcessor, type FrameState } from './hooks/useSpriteProcessor';
import type { GridParams } from './utils/imageProcessing';
import { FrameGrid } from './components/FrameGrid';
import { AnimationPreview } from './components/AnimationPreview';
import JSZip from 'jszip';

const GRID_PRESETS = [
  { label: 'Grade 3x4 (10)', cols: 3, rows: 4 },
  { label: 'Grade 4x4 (16)', cols: 4, rows: 4 },
  { label: 'Grade 5x4 (20)', cols: 5, rows: 4 },
  { label: 'Grade 6x3 (18)', cols: 6, rows: 3 },
  { label: 'Grade 8x2 (16)', cols: 8, rows: 2 },
  { label: 'Horizontal 16x1', cols: 16, rows: 1 },
];

export default function App() {
  const sp = useSpriteProcessor();
  const [params, setParams] = useState<GridParams>({
    width: 64, height: 64, overlapX: 0, overlapY: 0, offsetX: 0, offsetY: 0,
    columns: 4, rows: 4, noise: 0, bleed: 1, blur: 0, outline: 0, stabilize: 50,
  });

  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [magicIntensity, setMagicIntensity] = useState<15 | 30 | 50>(50);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionName, setActionName] = useState('idle');
  const [layerOffsetX, setLayerOffsetX] = useState(0);
  const [layerOffsetY, setLayerOffsetY] = useState(0);
  const [autoRemoveLayerBg, setAutoRemoveLayerBg] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const accessoryRef = useRef<HTMLInputElement>(null);

  // Editor states
  const [tool, setTool] = useState<'brush' | 'eraser' | 'colorEraser' | 'eyedropper'>('brush');
  const [brushSize, setBrushSize] = useState(12);
  const [brushColor, setBrushColor] = useState('#ffffff');
  const [tolerance, setTolerance] = useState(30);

  // Processing with loading indicator
  useEffect(() => {
    if (!sp.sourceImage) return;
    setIsProcessing(true);
    const t = setTimeout(() => {
      sp.processSlices(params);
      setIsProcessing(false);
    }, 50);
    return () => clearTimeout(t);
  }, [sp.sourceImage, params]);

  const activeSpriteInfo = sp.sourceImage 
    ? `${sp.sourceImage.width}x${sp.sourceImage.height} PX | ${sp.activeFrames.length} Frames` 
    : 'Nenhum Sprite Carregado';

  const downloadZip = async () => {
    const zip = new JSZip();
    const folder = zip.folder(actionName);
    const active = sp.activeFrames.filter(f => !f.excluded);

    for (let i = 0; i < active.length; i++) {
        const f = active[i];
        const blob = await new Promise<Blob|null>(r => f.canvas.toBlob(r, 'image/png'));
        if (blob) folder?.file(`${i}.png`, blob);
    }
    const content = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(content); a.download = `${actionName || 'sprites'}.zip`; a.click();
  };

  const applyPreset = useCallback((cols: number, rows: number) => {
    if (!sp.sourceImage) return;
    setParams(p => ({ ...p, columns: cols, rows, width: Math.floor(sp.sourceImage!.width / cols), height: Math.floor(sp.sourceImage!.height / rows) }));
  }, [sp.sourceImage]);

  const detectGridIA = useCallback(() => {
    if (!sp.sourceImage) return;
    const w = sp.sourceImage.width, h = sp.sourceImage.height;
    let bestCols = 4, bestRows = 4, bestScore = Infinity;
    for (const { cols, rows } of GRID_PRESETS) {
      const score = Math.abs(w / cols - h / rows);
      if (score < bestScore) { bestScore = score; bestCols = cols; bestRows = rows; }
    }
    applyPreset(bestCols, bestRows);
  }, [sp.sourceImage, applyPreset]);

  const upParam = (k: keyof GridParams, v: number) => setParams(p => ({ ...p, [k]: v }));

  const handleAccessoryFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEv) => {
      const img = new Image();
      img.onload = () => {
        sp.compositeLayer(img, { 
          magic: autoRemoveLayerBg, 
          magicTol: magicIntensity, 
          ox: layerOffsetX, 
          oy: layerOffsetY 
        });
      };
      img.src = loadEv.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = ''; 
  };

  const editorActive = editingIdx !== null;
  return (
    <div style={{ display: 'flex', flexDirection: 'row-reverse', height: '100vh', background: '#000', color: '#fff', overflow: 'hidden' }}>
      
      {/* ── LOADING OVERLAY ── */}
      {isProcessing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24, backdropFilter: 'blur(8px)' }}>
          <div style={{ width: 80, height: 80, position: 'relative' }}>
            <svg viewBox="0 0 80 80" style={{ width: 80, height: 80, animation: 'spin 1.2s linear infinite' }}>
              <circle cx="40" cy="40" r="36" fill="none" stroke="#111" strokeWidth="4" />
              <circle cx="40" cy="40" r="36" fill="none" stroke="#fff" strokeWidth="4" strokeDasharray="180" strokeDashoffset="60" strokeLinecap="round" />
            </svg>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 24, color: '#fff' }}>S</span>
          </div>
          <span className="text-mono" style={{ fontSize: 13, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Processando...</span>
        </div>
      )}

      {/* ── SIDEBAR (RIGHT) ── */}
      <aside style={{ width: 320, borderLeft: '1px solid #111', background: '#020202', display: 'flex', flexDirection: 'column', padding: '32px 0', flexShrink: 0 }}>
        <div style={{ padding: '0 24px', marginBottom: 40, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: '#fff', color: '#000', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>S</div>
          <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '0.1em', color: '#fff' }}>SUPER SPRITE INTERN</span>
        </div>



        {/* ── SIDEBAR DYNAMIC CONTROLS ── */}
        <div style={{ flex: 1, padding: '24px', borderTop: '1px solid #111', marginTop: 16 }}>
          {!sp.sourceImage && (
             <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h4 style={sideHeader}>Ações Rápidas</h4>
                <button onClick={() => fileRef.current?.click()} style={{ ...sidebarBtnMain, background: 'linear-gradient(135deg, #fff, #ddd)', color: '#000' }}>Importar Primeiro Sprite</button>
                <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#fff', fontSize: 11, opacity: 0.3, border: '1px dashed #222', borderRadius: 16, marginTop: 8, padding: 12 }}>
                   Painel de configurações aparecerá após o carregamento
                </div>
             </div>
          )}

          {sp.sourceImage && editingIdx === null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
               <h4 style={sideHeader}>Ações Rápidas</h4>
               <button onClick={() => { if(confirm('Limpar sprite atual?')) sp.clearAll(); }} style={{ ...sidebarBtnMain, background: '#111', color: '#ef4444', border: '1px solid #222' }}>Limpar Sprite</button>
               <button onClick={() => fileRef.current?.click()} style={sidebarBtnMain}>Importar Sprite</button>
               <button onClick={sp.fillTo30Frames} style={{ ...sidebarBtnMain, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff', border: 'none', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)', marginTop: 8 }}>Preencher até 30 Frames</button>
               
               <div style={{ marginTop: 24, borderTop: '1px solid #111', paddingTop: 24 }}>
                  <h4 style={sideHeader}>Exportação Profissional</h4>
                  <label style={sideLabel}>Nome da Ação (Pasta)</label>
                  <input 
                    type="text" 
                    value={actionName} 
                    onChange={e => setActionName(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'))}
                    placeholder="ex: andando_calmo"
                    style={inputStyle}
                  />
                  <button onClick={downloadZip} style={exportBtnStyle}>Exportar ZIP</button>
               </div>

                <div style={{ marginTop: 24, borderTop: '1px solid #111', paddingTop: 24 }}>
                   <h4 style={sideHeader}>Composição de Camadas</h4>
                   <button onClick={() => accessoryRef.current?.click()} style={{ ...sidebarBtnMain, background: '#111', border: '1px solid #333' }}>Compor Acessório (Folha)</button>
                   <input type="file" ref={accessoryRef} style={{ display: 'none' }} accept="image/*" onChange={handleAccessoryFile} />
                   
                   <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#fff', cursor: 'pointer', marginTop: 12 }}>
                      <input type="checkbox" checked={autoRemoveLayerBg} onChange={e => setAutoRemoveLayerBg(e.target.checked)} />
                      Limpar fundo do acessório
                   </label>

                   <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                      <div>
                        <label style={sideLabel}>Offset X</label>
                        <input type="number" value={layerOffsetX} onChange={e => setLayerOffsetX(Number(e.target.value))} style={inputStyle} />
                      </div>
                      <div>
                        <label style={sideLabel}>Offset Y</label>
                        <input type="number" value={layerOffsetY} onChange={e => setLayerOffsetY(Number(e.target.value))} style={inputStyle} />
                      </div>
                   </div>
                   <div className="text-mono" style={{ fontSize: 10, color: '#fff', opacity: 0.3, marginTop: 12, textAlign: 'center' }}>
                      A folha de acessório deve usar a mesma grade do personagem.
                   </div>
                </div>
            </div>
          )}

          {sp.sourceImage && editingIdx !== null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
               <button onClick={() => setEditingIdx(null)} style={{ ...sidebarBtnMain, background: '#111', color: '#fff', border: '1px solid #222' }}>← Voltar à Grade</button>
               <h4 style={sideHeader}>Ferramentas</h4>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <ToolBtn active={tool === 'brush'} label="Pincel" icon="🖌" hotkey="C" onClick={() => setTool('brush')} />
                  <ToolBtn active={tool === 'eraser'} label="Borracha" icon="⌫" hotkey="B" onClick={() => setTool('eraser')} />
                  <ToolBtn active={tool === 'colorEraser'} label="Limpa Brancos" icon="🧹" hotkey="W" onClick={() => setTool('colorEraser')} />
                  <ToolBtn active={tool === 'eyedropper'} label="Conta-gotas" icon="💧" hotkey="Z" onClick={() => setTool('eyedropper')} />
               </div>
               <SliderRow label="Tamanho do Pincel" val={brushSize} min={1} max={100} onChange={setBrushSize} />
               {tool === 'colorEraser' && <SliderRow label="Sensibilidade" val={tolerance} min={1} max={255} onChange={setTolerance} />}
               {tool === 'brush' && (
                 <div style={{ marginTop: 8 }}>
                    <label style={sideLabel}>Cor do Pincel</label>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                      <input type="color" value={brushColor} onChange={e => setBrushColor(e.target.value)} style={{ width: 40, height: 36, background: 'none', border: '1px solid #222', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                      <span className="text-mono" style={{ fontSize: 12, color: '#fff' }}>{brushColor}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                      {['#ffffff','#000000','#ef4444','#f59e0b','#22c55e','#3b82f6','#8b5cf6','#ec4899'].map(c => (
                        <button key={c} onClick={() => setBrushColor(c)} style={{ width: 22, height: 22, borderRadius: 6, border: brushColor === c ? '2px solid #fff' : '1px solid #222', background: c, cursor: 'pointer' }} />
                      ))}
                    </div>
                 </div>
               )}
               <div className="text-mono" style={{ fontSize: 11, color: '#fff', marginTop: 16, lineHeight: 1.8, textAlign: 'center' }}>
                 B=Borracha • C=Pincel • W=Limpa • Z=Gotas<br/>
                 Ctrl+Z=Desfazer • R=Resetar
               </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ height: 60, borderBottom: '1px solid #111', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0, zIndex: 10 }}>
          <span className="text-mono" style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{activeSpriteInfo.toUpperCase()}</span>
          <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: '0.1em', color: '#fff' }}>
            {editorActive ? `EDITOR — FRAME #${editingIdx + 1}` : 'PROCESSAMENTO GLOBAL'}
          </span>
          {!sp.sourceImage && <button onClick={() => fileRef.current?.click()} style={{ ...iconBtnSmall, width: 'auto', padding: '0 16px', fontSize: 11 }}>Carregar Primeiro Sprite</button>}
          {sp.sourceImage && <div style={{ width: 100 }} />}
        </header>

        <section style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ display: editingIdx === null ? 'grid' : 'flex', gridTemplateColumns: '1fr 340px', gap: 32, padding: 32 }}>
              
              {editingIdx === null ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                    {sp.sourceImage ? (
                      <FrameGrid frames={sp.activeFrames} deletedFrames={sp.deletedFrames} showGuidelines={sp.showGuidelines} onToggleExclusion={sp.toggleExclusion} onDelete={sp.deleteFrame} onRestore={sp.restoreFrame} onDuplicate={sp.duplicateFrame} onReorder={sp.reorderFrames} onView={setEditingIdx}  />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', opacity: 0.15 }}>
                         <div style={{ fontSize: 120, marginBottom: 24 }}>📁</div>
                         <h2 style={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.4em', fontSize: 24 }}>Aguardando Sprite</h2>
                      </div>
                    )}
                  </div>
                  <aside style={{ position: 'sticky', top: 0, display: 'flex', flexDirection: 'column', gap: 20, opacity: sp.sourceImage ? 1 : 0.4, pointerEvents: sp.sourceImage ? 'auto' : 'none' }}>
                    <AnimationPreview frames={sp.activeFrames.filter(f => !f.excluded)} showGuidelines={sp.showGuidelines} />
                    
                    <div className="glass-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
                      <div>
                        <h5 style={sideHeader}>Grelha de Importação</h5>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <select onChange={e => { const [c,r] = e.target.value.split(',').map(Number); applyPreset(c,r); }} style={{ ...selectStyle, flex: 1 }}>
                              {GRID_PRESETS.map(p => <option key={p.label} value={`${p.cols},${p.rows}`}>{p.label}</option>)}
                          </select>
                          <button onClick={detectGridIA} style={iconBtnSmall} title="Auto-detectar melhor grade">⚡</button>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#fff', cursor: 'pointer', marginTop: 12 }}>
                          <input type="checkbox" checked={sp.showGuidelines} onChange={e => sp.setShowGuidelines(e.target.checked)} />
                          Guias Visuais de Grade
                        </label>
                      </div>

                      <div style={{ borderTop: '1px solid #222', paddingTop: 20 }}>
                        <h5 style={sideHeader}>Controle de Processamento</h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <SliderRow label="Anti-Bleed" val={params.bleed} min={0} max={10} onChange={(v: number) => upParam('bleed', v)} />
                          <SliderRow label="Anti-Aliasing" val={params.blur} min={0} max={10} onChange={(v: number) => upParam('blur', v)} />
                          <SliderRow label="Contorno" val={params.outline} min={0} max={5} onChange={(v: number) => upParam('outline', v)} />
                          <SliderRow label="Ruído" val={params.noise} min={0} max={8} onChange={(v: number) => upParam('noise', v)} />
                          <SliderRow label="Estabilidade" val={params.stabilize} min={0} max={100} onChange={(v: number) => upParam('stabilize', v)} displayVal={`${params.stabilize}%`} />
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid #222', paddingTop: 20 }}>
                        <h5 style={sideHeader}>Limpeza Inteligente</h5>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <select value={magicIntensity} onChange={e => { setMagicIntensity(Number(e.target.value) as any); sp.setMagicTolerance(Number(e.target.value)); }} style={{ ...selectStyle, flex: 1 }}>
                                <option value={15}>Fraco</option>
                                <option value={30}>Médio</option>
                                <option value={50}>Forte</option>
                            </select>
                            <button onClick={() => { setIsProcessing(true); setTimeout(() => { sp.runMagicBgRemoval(params); setIsProcessing(false); }, 50); }} style={actionBtnStyle}>Limpar</button>
                        </div>
                        <button onClick={() => { setIsProcessing(true); setTimeout(() => { sp.runAutoFixFlicker(params); setIsProcessing(false); }, 50); }} style={{ ...actionBtnStyle, width: '100%', marginTop: 8, padding: '12px' }}>★ Corrigir Flicker Global</button>
                        <button onClick={() => sp.runAutoAlignPivots(params)} style={{ ...actionBtnStyle, width: '100%', marginTop: 8, padding: '12px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}>★ Alinhar pelos Pés (Auto)</button>
                      </div>
                    </div>
                  </aside>
                </>
              ) : (
                    <InlineEditor
                      frame={sp.activeFrames.find(f => f.index === editingIdx)!}
                      tool={tool} brushSize={brushSize} brushColor={brushColor} tolerance={tolerance}
                      onUpdate={sp.updateFrameCanvas}
                      onPickColor={setBrushColor}
                      onSetTool={setTool}
                      onApplyToAll={sp.applyAdjustmentsToAll}
                    />
              )}
            </div>

        </section>
      </main>

      <input ref={fileRef} type="file" hidden onChange={e => e.target.files?.[0] && sp.loadFile(e.target.files[0])} />
    </div>
  );
}

// ═══════════════════════════════════════════════
// INLINE EDITOR (with Undo, Reset, Hotkeys)
// ═══════════════════════════════════════════════
type Adjustments = { brightness: number, contrast: number, saturation: number, hue: number };
const DEFAULT_ADJ: Adjustments = { brightness: 100, contrast: 100, saturation: 100, hue: 0 };

function InlineEditor({ frame, tool, brushSize, brushColor, tolerance, onUpdate, onPickColor, onSetTool, onApplyToAll }: {
  frame: FrameState; tool: string; brushSize: number; brushColor: string; tolerance: number;
  onUpdate: (idx: number, canvas: HTMLCanvasElement) => void;
  onPickColor: (hex: string) => void;
  onSetTool: (t: any) => void;
  onApplyToAll?: (adj: Adjustments) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const backupStack = useRef<ImageData[]>([]);
  const originalData = useRef<ImageData | null>(null);
  const loadedIdx = useRef<number | null>(null);
  const [adj, setAdj] = useState<Adjustments>(DEFAULT_ADJ);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, visible: false });
  const containerRef = useRef<HTMLDivElement>(null);

  const adjIsDefault = adj.brightness === 100 && adj.contrast === 100 && adj.saturation === 100 && adj.hue === 0;
  const filterStr = `brightness(${adj.brightness}%) contrast(${adj.contrast}%) saturate(${adj.saturation}%) hue-rotate(${adj.hue}deg)`;

  // Load frame ONLY when switching to a different frame index
  useEffect(() => {
    if (!frame || !canvasRef.current) return;
    if (loadedIdx.current === frame.index) return; // skip if same frame
    loadedIdx.current = frame.index;
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true })!;
    canvasRef.current.width = frame.canvas.width;
    canvasRef.current.height = frame.canvas.height;
    ctx.drawImage(frame.canvas, 0, 0);
    originalData.current = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    backupStack.current = [];
  }, [frame]);

  // Save state for undo
  const pushUndo = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true })!;
    const snap = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    backupStack.current.push(snap);
    if (backupStack.current.length > 30) backupStack.current.shift();
  }, []);

  const syncToProcessor = useCallback(() => {
    if (!canvasRef.current || !frame) return;
    const out = document.createElement('canvas');
    out.width = canvasRef.current.width;
    out.height = canvasRef.current.height;
    out.getContext('2d')!.drawImage(canvasRef.current, 0, 0);
    onUpdate(frame.index, out);
  }, [frame, onUpdate]);

  const undo = useCallback(() => {
    if (!canvasRef.current || backupStack.current.length === 0) return;
    const prev = backupStack.current.pop()!;
    canvasRef.current.getContext('2d')!.putImageData(prev, 0, 0);
    syncToProcessor();
  }, [syncToProcessor]);

  const applyAdjustments = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    const tmp = document.createElement('canvas');
    tmp.width = canvasRef.current.width;
    tmp.height = canvasRef.current.height;
    const tCtx = tmp.getContext('2d')!;
    tCtx.filter = filterStr;
    tCtx.drawImage(canvasRef.current, 0, 0);
    
    pushUndo();
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.drawImage(tmp, 0, 0);
    setAdj(DEFAULT_ADJ);
    syncToProcessor();
  }, [filterStr, pushUndo, syncToProcessor]);

  const reset = useCallback(() => {
    if (!canvasRef.current || !originalData.current) return;
    pushUndo();
    canvasRef.current.getContext('2d')!.putImageData(originalData.current, 0, 0);
    setAdj(DEFAULT_ADJ);
    syncToProcessor();
  }, [pushUndo, syncToProcessor]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); return; }
      switch(e.key.toLowerCase()) {
        case 'b': onSetTool('eraser'); break;
        case 'c': onSetTool('brush'); break;
        case 'w': onSetTool('colorEraser'); break;
        case 'z': if (!e.ctrlKey) onSetTool('eyedropper'); break;
        case 'r': reset(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, reset, onSetTool]);

  const getPos = (e: React.MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvasRef.current.width / rect.width),
      y: (e.clientY - rect.top) * (canvasRef.current.height / rect.height),
      screenX: e.clientX - rect.left,
      screenY: e.clientY - rect.top,
      scale: rect.width / canvasRef.current.width
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    
    setMousePos({ 
      x: e.clientX - containerRect.left, 
      y: e.clientY - containerRect.top, 
      visible: true 
    });
    handleAction(e);
  };

  const handleAction = (e: React.MouseEvent) => {
    if (!canvasRef.current || (tool !== 'eyedropper' && !isDrawing.current)) return;
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true })!;

    if (tool === 'eyedropper') {
      const data = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
      onPickColor(`#${[data[0], data[1], data[2]].map(v => v.toString(16).padStart(2, '0')).join('')}`);
      return;
    }

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2); ctx.fill();
    } else if (tool === 'colorEraser') {
       const radius = Math.floor(brushSize / 2);
       const ix = Math.max(0, Math.floor(x - radius)), iy = Math.max(0, Math.floor(y - radius));
       const w = Math.min(brushSize, canvasRef.current.width - ix);
       const h = Math.min(brushSize, canvasRef.current.height - iy);
       if (w <= 0 || h <= 0) return;
       const imgData = ctx.getImageData(ix, iy, w, h);
       for(let i = 0; i < imgData.data.length; i += 4) {
          const pr = imgData.data[i], pg = imgData.data[i+1], pb = imgData.data[i+2], pa = imgData.data[i+3];
          if (pa === 0) continue;
          const brightness = (pr + pg + pb) / 3;
          const saturation = Math.max(pr, pg, pb) - Math.min(pr, pg, pb);
          const brightnessThreshold = 255 - tolerance;
          if (brightness > brightnessThreshold && saturation < tolerance) {
            imgData.data[i + 3] = 0;
          }
       }
       ctx.putImageData(imgData, ix, iy);
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = brushColor;
      ctx.beginPath(); ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2); ctx.fill();
    }
  };

  const onDown = (e: React.MouseEvent) => {
    pushUndo();
    isDrawing.current = true;
    handleAction(e);
  };
  const onEnd = () => { if (isDrawing.current) { isDrawing.current = false; syncToProcessor(); } };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', background: '#020202' }}>
       {/* BARRA LATERAL ESQUERDA (AJUSTES) */}
       <aside style={{ width: 300, borderRight: '1px solid #111', background: '#050505', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 32, flexShrink: 0 }}>
          <h4 style={sideHeader}>Ajustes de Imagem</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
             <SliderRangeRow label="Brilho" val={adj.brightness} min={0} max={200} displayVal={`${adj.brightness}%`} onChange={v => setAdj(prev => ({ ...prev, brightness: v }))} />
             <SliderRangeRow label="Contraste" val={adj.contrast} min={0} max={200} displayVal={`${adj.contrast}%`} onChange={v => setAdj(prev => ({ ...prev, contrast: v }))} />
             <SliderRangeRow label="Saturação" val={adj.saturation} min={0} max={200} displayVal={`${adj.saturation}%`} onChange={v => setAdj(prev => ({ ...prev, saturation: v }))} />
             <SliderRangeRow label="Matriz (Hue)" val={adj.hue} min={-180} max={180} displayVal={`${adj.hue}°`} onChange={v => setAdj(prev => ({ ...prev, hue: v }))} />
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid #111', paddingTop: 32 }}>
             <button onClick={undo} style={{ ...editorActionBtn, width: '100%' }}>↩ Desfazer [Ctrl+Z]</button>
             <button onClick={reset} style={{ ...editorActionBtn, width: '100%' }}>↺ Resetar Original [R]</button>
             {!adjIsDefault && (
               <>
                 <button onClick={applyAdjustments} style={{ ...editorActionBtn, width: '100%', background: '#fff', color: '#000', border: 'none', padding: '12px' }}>Aplicar Neste Quadro</button>
                 {onApplyToAll && (
                   <button onClick={() => { if(confirm('Aplicar a TODOS os quadros?')) { onApplyToAll(adj); setAdj(DEFAULT_ADJ); } }} style={{ ...editorActionBtn, width: '100%', borderColor: '#333' }}>Aplicar a Todos</button>
                 )}
                 <button onClick={() => setAdj(DEFAULT_ADJ)} style={{ ...editorActionBtn, width: '100%', color: '#ef4444', border: 'none' }}>Descartar</button>
               </>
             )}
          </div>
       </aside>

       {/* ÁREA CENTRAL (FRAME) */}
       <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', padding: 48 }}>
           <div 
             ref={containerRef}
             onMouseEnter={() => setMousePos(p => ({ ...p, visible: true }))}
             onMouseLeave={() => setMousePos(p => ({ ...p, visible: false }))}
             style={{ width: '100%', height: '100%', maxWidth: '1000px', maxHeight: '800px', background: '#030303', border: '1px solid #111', borderRadius: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'none', overflow: 'hidden', position: 'relative', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}
           >
             <canvas 
               ref={canvasRef} 
               onMouseDown={onDown} 
               onMouseMove={handleMouseMove} 
               onMouseUp={onEnd} 
               style={{ maxWidth: '95%', maxHeight: '95%', imageRendering: 'pixelated', background: 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAACpJREFUGFdjZEACjAABRhAAsigjowAjAwNQAF0AARgBApgAAsgAAXQBBAAkGQYEvlS9xwAAAABJRU5ErkJggg==)', filter: filterStr }} 
             />

             {mousePos.visible && (
               <div style={{
                 position: 'absolute',
                 left: mousePos.x,
                 top: mousePos.y,
                 width: brushSize * (canvasRef.current ? (canvasRef.current.getBoundingClientRect().width / canvasRef.current.width) : 1),
                 height: brushSize * (canvasRef.current ? (canvasRef.current.getBoundingClientRect().height / canvasRef.current.height) : 1),
                 border: `2px solid ${tool === 'eraser' || tool === 'colorEraser' ? '#ef4444' : '#fff'}`,
                 borderRadius: '50%',
                 pointerEvents: 'none',
                 transform: 'translate(-50%, -50%)',
                 zIndex: 10
               }} />
             )}
           </div>

           <div className="text-mono" style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: '#fff', opacity: 0.2, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {tool === 'eyedropper' ? 'Clique para capturar cor' : 'Clique e arraste • B=Borracha C=Pincel W=Limpa Z=Gotas • R=Reseta'}
           </div>
       </div>
    </div>
  );
}

// ── Components ──
function ToolBtn({ active, label, icon, hotkey, onClick }: { active: boolean, label: string, icon: string, hotkey: string, onClick: () => void }) {
  return <button onClick={onClick} title={`${label} [${hotkey}]`} style={{ padding: '12px', background: active ? '#fff' : '#0a0a0a', color: active ? '#000' : '#fff', border: '1px solid #222', borderRadius: 12, fontSize: 14, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: '0.2s', position: 'relative' }}>
    <span>{icon}</span>
    <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }}>{label}</span>
    <span style={{ position: 'absolute', top: 4, right: 6, fontSize: 9, fontWeight: 900, color: active ? '#fff' : '#000', background: active ? '#2563eb' : '#fff', padding: '1px 4px', borderRadius: 4 }}>{hotkey}</span>
  </button>
}

function SliderRow({ label, val, min, max, onChange, displayVal }: { label: string, val: number, min: number, max: number, onChange: (v: number) => void, displayVal?: string }) {
  const update = (delta: number) => {
    onChange(Math.max(min, Math.min(max, val + delta)));
  };
  return <div style={{ marginBottom: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }} className="text-mono">
      <span style={{ color: '#fff' }}>{label}</span>
      <span style={{ fontWeight: 900, color: '#fff' }}>{displayVal ?? val}</span>
    </div>
    <div style={{ display: 'flex', gap: 4 }}>
      <button onClick={() => update(-10)} style={btnTiny}>-10</button>
      <button onClick={() => update(-1)} style={btnTiny}>-1</button>
      <button onClick={() => update(1)} style={btnTiny}>+1</button>
      <button onClick={() => update(10)} style={btnTiny}>+10</button>
    </div>
  </div>
}

function SliderRangeRow({ label, val, min, max, onChange, displayVal }: { label: string, val: number, min: number, max: number, onChange: (v: number) => void, displayVal?: string }) {
  return <div style={{ flex: 1 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }} className="text-mono">
      <span style={{ color: '#fff' }}>{label}</span>
      <span style={{ fontWeight: 900, color: '#fff' }}>{displayVal ?? val}</span>
    </div>
    <input 
      type="range" 
      min={min} 
      max={max} 
      value={val} 
      onChange={e => onChange(Number(e.target.value))} 
      className="custom-range"
    />
  </div>
}

// ── Styles ──
const sideHeader: React.CSSProperties = { fontSize: 14, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, color: '#fff' };
const sideLabel: React.CSSProperties = { fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: '#fff' };
const sidebarBtnMain: React.CSSProperties = { width: '100%', background: '#fff', color: '#000', border: 'none', borderRadius: 12, padding: '14px', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', transition: '0.2s' };
const actionBtnStyle: React.CSSProperties = { flex: 1, background: '#111', border: '1px solid #333', borderRadius: 10, padding: '10px', color: '#fff', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer' };
const exportBtnStyle: React.CSSProperties = { width: '100%', background: '#fff', border: 'none', borderRadius: 14, padding: '14px', fontSize: 12, fontWeight: 900, color: '#000', textTransform: 'uppercase', cursor: 'pointer', marginTop: 10 };
const selectStyle: React.CSSProperties = { background: '#111', border: '1px solid #333', borderRadius: 10, padding: '8px 12px', color: '#fff', fontSize: 12, outline: 'none' };
const iconBtnSmall: React.CSSProperties = { background: '#fff', color: '#000', border: 'none', borderRadius: 10, width: 38, height: 38, fontWeight: 900, cursor: 'pointer' };
const editorActionBtn: React.CSSProperties = { background: '#111', border: '1px solid #333', borderRadius: 10, padding: '8px 16px', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', transition: '0.2s' };
const btnTiny: React.CSSProperties = { flex: 1, background: '#111', border: '1px solid #333', borderRadius: 8, padding: '8px 0', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: '0.2s' };
const inputStyle: React.CSSProperties = { width: '100%', background: '#111', border: '1px solid #333', borderRadius: 10, padding: '12px', color: '#fff', fontSize: 12, outline: 'none', marginTop: 12 };
