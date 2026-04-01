// ────────────────────────────────────────────────────────────
// App.tsx  –  Sprite Master Ultra Desktop
// Full faithful port of SpriteMasterUltra (5).html
// ────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSpriteProcessor } from './hooks/useSpriteProcessor';
import type { GridParams } from './utils/imageProcessing';
import { FrameGrid } from './components/FrameGrid';
import { AnimationPreview } from './components/AnimationPreview';
import { FrameEditorModal } from './components/FrameEditorModal';
import { GeneratorTab } from './components/GeneratorTab';
import JSZip from 'jszip';

// Grid presets matching the HTML
const GRID_PRESETS: { label: string; cols: number; rows: number }[] = [
  { label: 'Grade 4x4 (16)',      cols: 4,  rows: 4 },
  { label: 'Grade 6x3 (18)',      cols: 6,  rows: 3 },
  { label: 'Grade 3x6 (18)',      cols: 3,  rows: 6 },
  { label: 'Grade 4x3 (12)',      cols: 4,  rows: 3 },
  { label: 'Grade 3x4 (12)',      cols: 3,  rows: 4 },
  { label: 'Fita 8x2 (16)',       cols: 8,  rows: 2 },
  { label: 'Horizontal 16x1',     cols: 16, rows: 1 },
];

export default function App() {
  const sp = useSpriteProcessor();

  const [params, setParams] = useState<GridParams>({
    width: 100, height: 100,
    overlapX: 0, overlapY: 0,
    offsetX: 0,  offsetY: 0,
    columns: 4,  rows: 4,
    noise: 0, bleed: 1, blur: 0, outline: 0, stabilize: 50,
  });

  const [objName,    setObjName]    = useState('');
  const [actionName, setActionName] = useState('');
  const [exportFormat, setExportFormat] = useState<'image/png' | 'image/jpeg' | 'image/webp'>('image/png');
  const [magicIntensity, setMagicIntensity] = useState<15 | 30 | 50>(30);
  const [currentTab, setCurrentTab] = useState<'slicer' | 'generator'>('slicer');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [globalPrompt, setGlobalPrompt]   = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Re-process whenever image or params change
  useEffect(() => {
    if (sp.sourceImage) sp.processSlices(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.sourceImage, params]);

  // Compute cell size whenever image or grid preset changes
  const applyPreset = useCallback((cols: number, rows: number) => {
    if (!sp.sourceImage) return;
    setParams(p => ({
      ...p,
      columns: cols, rows,
      width:  Math.floor(sp.sourceImage!.width  / cols),
      height: Math.floor(sp.sourceImage!.height / rows),
    }));
  }, [sp.sourceImage]);

  const handleGridSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [cols, rows] = e.target.value.split(',').map(Number);
    if (sp.sourceImage) applyPreset(cols, rows);
    else setParams(p => ({ ...p, columns: cols, rows }));
  };

  // Auto-detect grid (simple heuristic)
  const detectGridIA = useCallback(() => {
    if (!sp.sourceImage) return;
    const w = sp.sourceImage.width, h = sp.sourceImage.height;
    // Find best divisor for a roughly-square cell
    let bestCols = 4, bestRows = 4;
    let bestScore = Infinity;
    for (const { cols, rows } of GRID_PRESETS) {
      const cw = w / cols, ch = h / rows;
      const score = Math.abs(cw - ch); // prefer square cells
      if (score < bestScore) { bestScore = score; bestCols = cols; bestRows = rows; }
    }
    applyPreset(bestCols, bestRows);
  }, [sp.sourceImage, applyPreset]);

  // File import
  const triggerImport = () => fileRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) sp.loadFile(file);
  };
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) sp.loadFile(file);
  }, [sp]);

  // Export ZIP
  const downloadZip = useCallback(async () => {
    const activeActive = sp.activeFrames.filter(f => !f.excluded);
    if (activeActive.length === 0) return;

    const zip = new JSZip();
    const ext = exportFormat === 'image/png' ? 'png'
              : exportFormat === 'image/jpeg' ? 'jpg'
              : 'webp';
    const prefix = objName && actionName ? `${objName}_${actionName}_`
                 : objName              ? `${objName}_`
                 : actionName           ? `${actionName}_`
                 : '';

    for (let i = 0; i < activeActive.length; i++) {
      const frame = activeActive[i];
      const blob = await new Promise<Blob | null>(res =>
        frame.canvas.toBlob(res, exportFormat)
      );
      if (blob) zip.file(`${prefix}${String(i).padStart(2,'0')}.${ext}`, blob);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url; a.download = `${prefix || 'sprites'}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sp.activeFrames, exportFormat, objName, actionName]);

  // Range value update shortcuts
  const upParam = (k: keyof GridParams, v: number) =>
    setParams(p => ({ ...p, [k]: v }));

  const hasImage = !!sp.sourceImage;
  const frameCount = sp.activeFrames.length;
  const cellLabel  = hasImage
    ? `${sp.sourceImage!.width}x${sp.sourceImage!.height} PX • ${frameCount} Quadros`
    : '–';

  return (
    <div style={{ background: '#020617', minHeight: '100vh', color: '#f1f5f9' }}>
      {/* ── Global Loader ── */}
      <div id="global-loader">
        <div className="loading-spin" />
        <div style={{ textAlign: 'center', maxWidth: 300 }}>
          <p style={{ color: '#60a5fa', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.3em', fontSize: 12 }}
             className="animate-pulse">
            Limpando Fundo Mágico...
          </p>
          <p style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', marginTop: 16, lineHeight: 1.6 }}>
            A preencher e apagar de fora para dentro...
          </p>
        </div>
      </div>

      {/* ── Hidden file input ── */}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* ── Navbar ── */}
      <nav style={{
        background: '#0f172a', borderBottom: '1px solid #1e293b',
        position: 'sticky', top: 0, zIndex: 50,
        padding: '0 24px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, background: '#2563eb',
            borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 14
          }}>S</div>
          <span style={{ fontWeight: 800, letterSpacing: '-0.05em', fontSize: 18, textTransform: 'uppercase' }}>
            Sprite Master <span style={{ color: '#3b82f6' }}>Ultra</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', background: '#1e293b', padding: 4, borderRadius: 8 }}>
            <button
              onClick={() => setCurrentTab('slicer')}
              style={{
                padding: '6px 20px', borderRadius: 6, border: 'none',
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                background: currentTab === 'slicer' ? '#2563eb' : 'transparent',
                color: currentTab === 'slicer' ? '#fff' : '#94a3b8',
                transition: 'all 0.15s'
              }}
            >CORTADOR</button>
            <button
              onClick={() => setCurrentTab('generator')}
              style={{
                padding: '6px 20px', borderRadius: 6, border: 'none',
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                background: currentTab === 'generator' ? '#2563eb' : 'transparent',
                color: currentTab === 'generator' ? '#fff' : '#94a3b8',
                transition: 'all 0.15s'
              }}
            >GERADOR IA</button>
          </div>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>

        {/* ── SLICER TAB ── */}
        {currentTab === 'slicer' && (
          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 32 }}>

            {/* ─── LEFT SIDEBAR ─── */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{
                background: '#0f172a', border: '1px solid #1e293b',
                padding: 24, borderRadius: 24,
                display: 'flex', flexDirection: 'column', gap: 24
              }}>
                {/* Panel header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 10, fontWeight: 900, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Painel de Estúdio
                  </h3>
                  {hasImage && (
                    <button
                      onClick={triggerImport}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}
                    >Mudar Imagem</button>
                  )}
                </div>

                {/* Object / Action naming */}
                <div style={{ background: '#020617', padding: 16, borderRadius: 16, border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginLeft: 4 }}>Objeto (Opcional)</label>
                      <input
                        type="text" value={objName} onChange={e => setObjName(e.target.value)}
                        placeholder="Ex: Player"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginLeft: 4 }}>Ação (Opcional)</label>
                      <input
                        type="text" value={actionName} onChange={e => setActionName(e.target.value)}
                        placeholder="Ex: Walk"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <p style={{ fontSize: 9, color: '#475569', margin: 0, padding: '0 4px', fontStyle: 'italic' }}>
                    Se não preencher, os ficheiros serão exportados apenas como 00.png, 01.png, etc.
                  </p>
                </div>

                {/* Grid config */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginLeft: 4 }}>Configuração da Grelha</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      onChange={handleGridSelect}
                      style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}
                    >
                      {GRID_PRESETS.map(p => (
                        <option key={p.label} value={`${p.cols},${p.rows}`}>{p.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={detectGridIA}
                      title="Auto-Detectar Grelha"
                      style={{
                        background: '#4f46e5', border: 'none', borderRadius: 12,
                        padding: '0 12px', color: '#fff', cursor: 'pointer',
                        fontSize: 16, display: 'flex', alignItems: 'center'
                      }}
                    >⚡</button>
                  </div>
                </div>

                {/* Sliders */}
                <div style={{ background: '#020617', padding: 20, borderRadius: 16, border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <h4 style={{ margin: 0, fontSize: 10, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center', borderBottom: '1px solid #1e293b', paddingBottom: 8, fontStyle: 'italic' }}>
                    Ajustes de Matriz (Pixéis)
                  </h4>

                  {/* FIX FLICKER */}
                  <button
                    onClick={() => sp.runAutoFixFlicker(params)}
                    style={{
                      width: '100%', background: 'rgba(6,78,59,0.4)', border: '1px solid rgba(16,185,129,0.3)',
                      borderRadius: 12, padding: '10px 0', color: '#34d399', fontWeight: 900,
                      fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}
                  >★ FIX FLICKER (Algoritmo Rápido)</button>

                  {/* Guidelines checkbox */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: '#94a3b8', cursor: 'pointer' }}>
                    <input
                      type="checkbox" checked={sp.showGuidelines}
                      onChange={e => sp.setShowGuidelines(e.target.checked)}
                      style={{ width: 16, height: 16 }}
                    />
                    Mostrar Guias de Alinhamento (10% Z)
                  </label>

                  {/* Anti-Bleed */}
                  <SliderRow label="Anti-Bleed (Bordas)" val={params.bleed} min={0} max={10} color="#94a3b8"
                    onChange={v => upParam('bleed', v)} />
                  {/* Noise */}
                  <SliderRow label="Filtro de Ruído (Artefactos)" val={params.noise} min={0} max={8} color="#34d399"
                    onChange={v => upParam('noise', v)} />
                  {/* Stabilize */}
                  <SliderRow label="Estabilização Local" val={params.stabilize} min={0} max={100} color="#94a3b8"
                    onChange={v => upParam('stabilize', v)} displayVal={`${params.stabilize}%`} />
                  {/* Edge Blur */}
                  <SliderRow label="Suavizar Bordas (Blur)" val={params.blur} min={0} max={5} color="#94a3b8"
                    onChange={v => upParam('blur', v)} />
                  {/* Outline */}
                  <SliderRow label="Contorno (px)" val={params.outline} min={0} max={5} color="#94a3b8"
                    onChange={v => upParam('outline', v)} displayVal={`${params.outline}px`} />
                </div>

                {/* Magic BG Removal */}
                <div style={{ background: '#020617', padding: 20, borderRadius: 16, border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <h4 style={{ margin: 0, fontSize: 10, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center', borderBottom: '1px solid #1e293b', paddingBottom: 8 }}>
                    Limpeza de Fundo
                  </h4>
                  <div>
                    <label style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Intensidade Mágica</label>
                    <select
                      value={magicIntensity}
                      onChange={e => {
                        const v = Number(e.target.value) as 15 | 30 | 50;
                        setMagicIntensity(v);
                        sp.setMagicTolerance(v);
                      }}
                      style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}
                    >
                      <option value={15}>Baixa (Preserva Detalhes)</option>
                      <option value={30}>Média (Recomendado)</option>
                      <option value={50}>Alta (Agressiva)</option>
                    </select>
                  </div>
                  <button
                    onClick={() => sp.runMagicBgRemoval(params)}
                    style={{
                      width: '100%', background: 'rgba(147,51,234,0.2)', border: '1px solid rgba(168,85,247,0.3)',
                      borderRadius: 12, padding: '12px 0', color: '#c084fc', fontWeight: 900,
                      fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}
                  >✦ Remover Fundo Mágico (Rápido)</button>
                  {/* AI Button */}
                  <button
                    onClick={() => sp.runAiBgRemoval(params)}
                    disabled={sp.isAiProcessing}
                    style={{
                      width: '100%', background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(56,189,248,0.3)',
                      borderRadius: 12, padding: '12px 0', color: '#38bdf8', fontWeight: 900,
                      fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em',
                      cursor: sp.isAiProcessing ? 'not-allowed' : 'pointer',
                      opacity: sp.isAiProcessing ? 0.6 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}
                  >🤖 Remover com IA (Photoshop-Quality)</button>
                  {sp.isAiProcessing && (
                    <div style={{ width: '100%' }}>
                      <div style={{ fontSize: 9, color: '#38bdf8', textAlign: 'center', marginBottom: 4 }}>
                        Processando... {Math.round(sp.aiProgress * 100)}%
                      </div>
                      <div style={{ height: 4, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', background: '#38bdf8', borderRadius: 4,
                          width: `${sp.aiProgress * 100}%`, transition: 'width 0.3s'
                        }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Export */}
                <div style={{ background: 'rgba(30,58,138,0.1)', padding: 20, borderRadius: 16, border: '1px solid rgba(59,130,246,0.2)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ fontSize: 9, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', display: 'block' }}>Formato de Saída</label>
                  <select
                    value={exportFormat}
                    onChange={e => setExportFormat(e.target.value as typeof exportFormat)}
                    style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}
                  >
                    <option value="image/png">PNG (Transparente)</option>
                    <option value="image/jpeg">JPG (Fundo Sólido)</option>
                    <option value="image/webp">WEBP (Alta Compres.)</option>
                  </select>
                  <button
                    onClick={downloadZip}
                    style={{
                      width: '100%', background: '#2563eb', border: 'none',
                      borderRadius: 12, padding: '16px 0', color: '#fff', fontWeight: 900,
                      fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer',
                    }}
                  >Exportar ZIP</button>
                </div>
              </div>
            </aside>

            {/* ─── RIGHT: Frame Grid + Animation Preview ─── */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

              {/* Header bar */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: '#0f172a', padding: 16, borderRadius: 24,
                border: '1px solid #1e293b'
              }}>
                <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 8, height: 24, background: '#3b82f6', borderRadius: 4, display: 'inline-block' }} />
                  Gestão de Quadros
                </h2>
                <span style={{
                  fontSize: 10, fontFamily: 'monospace', background: '#020617',
                  color: '#60a5fa', padding: '6px 16px', borderRadius: 9999,
                  border: '1px solid #1e293b', fontStyle: 'italic'
                }}>{cellLabel}</span>
              </div>

              {/* Drop zone (shown when no image) */}
              {!hasImage && (
                <div
                  onClick={triggerImport}
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  style={{
                    border: '2px dashed #1e293b', borderRadius: 24, padding: 64,
                    textAlign: 'center', cursor: 'pointer',
                    background: 'rgba(15,23,42,0.5)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                    transition: 'all 0.2s'
                  }}
                >
                  <svg width={48} height={48} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#334155' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Inicie o Processamento</p>
                  <p style={{ fontSize: 12, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace', margin: 0 }}>Arraste o seu Spritesheet aqui</p>
                </div>
              )}

              {/* Global AI Refiner Bar */}
              {hasImage && sp.activeFrames.length > 0 && (
                <div style={{
                  background: 'linear-gradient(90deg, rgba(30,41,59,0.5), rgba(15,23,42,0.8))',
                  padding: '12px 16px', borderRadius: 20, border: '1px solid #1e293b',
                  display: 'flex', gap: 12, alignItems: 'center',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                  animation: 'fadeInSlide 0.5s ease-out',
                }}>
                  <div style={{ fontSize: 18 }}>🪄</div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Refinamento Global com IA
                    </span>
                    <input
                      type="text"
                      placeholder="Ex: agora coloque um chapéu no personagem..."
                      value={globalPrompt}
                      onChange={e => setGlobalPrompt(e.target.value)}
                      style={{
                        background: 'transparent', border: 'none', color: '#f1f5f9',
                        fontSize: 13, outline: 'none', width: '100%',
                        fontStyle: 'italic',
                      }}
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (!globalPrompt) return;
                      alert('Processando refinamento global via IA: ' + globalPrompt);
                      // Here: call sp.runGlobalAiRefinement(globalPrompt)
                    }}
                    style={{
                      background: globalPrompt ? '#3b82f6' : '#1e293b',
                      color: '#fff', border: 'none', borderRadius: 12,
                      padding: '8px 20px', fontSize: 11, fontWeight: 900,
                      cursor: globalPrompt ? 'pointer' : 'default',
                      transition: 'all 0.2s',
                    }}
                  >
                    REFINAR TODOS ✨
                  </button>
                </div>
              )}

              {/* Frame Grid */}
              {hasImage && (
                <FrameGrid
                  frames={sp.activeFrames}
                  deletedFrames={sp.deletedFrames}
                  showGuidelines={sp.showGuidelines}
                  onToggleExclusion={sp.toggleExclusion}
                  onDelete={sp.deleteFrame}
                  onRestore={sp.restoreFrame}
                  onDuplicate={sp.duplicateFrame}
                  onReorder={sp.reorderFrames}
                  onView={(idx: number) => setEditingIndex(idx)}
                />
              )}

              {/* Animation Preview */}
              {sp.activeFrames.length > 0 && (
                <AnimationPreview
                  frames={sp.activeFrames.filter(f => !f.excluded)}
                  showGuidelines={sp.showGuidelines}
                />
              )}
            </section>
          </div>
        )}

        {/* ── GENERATOR TAB ── */}
        {currentTab === 'generator' && (
          <GeneratorTab 
            sourceImage={sp.sourceImage} 
            uploadHistory={sp.uploadHistory}
            selectedRef={sp.selectedRef}
            onSelectRef={sp.setSelectedRef}
            onUploadRef={sp.loadFile}
          />
        )}
      </main>

      {/* ── Frame Editor Modal ── */}
      <FrameEditorModal
        frame={editingIndex !== null
          ? (sp.activeFrames.find(f => f.index === editingIndex) ?? null)
          : null
        }
        onClose={() => setEditingIndex(null)}
        onSave={(frameIndex, newCanvas) => {
          sp.updateFrameCanvas(frameIndex, newCanvas);
          setEditingIndex(null);
        }}
        onApplyToAll={(adj) => {
          sp.applyAdjustmentsToAll(adj);
          setEditingIndex(null);
        }}
      />
    </div>
  );
}

// ── Shared styles ──
const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 12,
  color: '#f1f5f9',
  outline: 'none',
  marginTop: 4,
};

// ── Slider Row component ──
function SliderRow({
  label, val, min, max, color, onChange, displayVal
}: {
  label: string; val: number; min: number; max: number;
  color: string; onChange: (v: number) => void; displayVal?: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase', marginBottom: 8 }}>
        <span>{label}</span>
        <span>{displayVal ?? val}</span>
      </div>
      <input
        type="range" className="custom-range"
        min={min} max={max} value={val}
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  );
}
