// ─────────────────────────────────────────────────────────────────
// GeneratorTab.tsx
// AI-powered spritesheet generator UI with style reference history.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useRef } from 'react';

interface Props {
  uploadHistory: HTMLImageElement[];
  selectedRef: HTMLImageElement | null;
  onSelectRef: (img: HTMLImageElement) => void;
  onUploadRef: (file: File) => void;
}

export function GeneratorTab({ uploadHistory, selectedRef, onSelectRef, onUploadRef }: Props) {
  const [description, setDescription] = useState('');
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(6);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = () => {
    if (!description) return;
    setIsGenerating(true);
    setProgress(0);
    
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 15;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
        setTimeout(() => {
          setIsGenerating(false);
          alert('Geração concluída! O resultado seria um spritesheet ' + cols + 'x' + rows + ' no estilo da referência selecionada.');
        }, 1000);
      }
      setProgress(p);
    }, 400);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUploadRef(file);
  };

  const styleKeywords = "pixel art, consistent game asset, high fidelity, transparent background, centered composition";
  const gridInfo = `${cols}x${rows} spritesheet grid`;
  const basePrompt = description ? `${description}, ${gridInfo}, ${styleKeywords}.` : '';
  const finalPrompt = selectedRef 
    ? `${basePrompt} Following the exact artistic style, color palette, and character proportions of the provided style reference image.`
    : basePrompt;

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 24,
      padding: '24px 32px', animation: 'fadeIn 0.6s ease-out',
      height: '100%', overflowY: 'auto'
    }}>
      
      {/* ─── LEFT: Configuration ─── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ background: '#0f172a', padding: 24, borderRadius: 24, border: '1px solid #1e293b' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 13, fontWeight: 800, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>🤖</span> PARÂMETROS DE GERAÇÃO
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>O que você quer criar?</label>
              <textarea
                placeholder="Ex: Guerreiro sombrio atacando com foice de energia..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                style={{
                  ...inputStyle, height: 80, resize: 'none',
                  fontSize: 13, lineHeight: '1.5',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label style={labelStyle}>Colunas</label>
                  <span style={{ color: '#60a5fa', fontSize: 10, fontFamily: 'monospace' }}>{cols}</span>
                </div>
                <input type="range" min={1} max={12} value={cols} onChange={e => setCols(parseInt(e.target.value))} style={{ width: '100%' }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label style={labelStyle}>Linhas</label>
                  <span style={{ color: '#60a5fa', fontSize: 10, fontFamily: 'monospace' }}>{rows}</span>
                </div>
                <input type="range" min={1} max={8} value={rows} onChange={e => setRows(parseInt(e.target.value))} style={{ width: '100%' }} />
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!description || isGenerating}
              style={{
                background: description && !isGenerating ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#1e293b',
                color: '#fff', border: 'none', borderRadius: 16, padding: '14px',
                fontSize: 12, fontWeight: 900, cursor: description && !isGenerating ? 'pointer' : 'default',
                marginTop: 4, transition: 'all 0.2s',
                boxShadow: description && !isGenerating ? '0 10px 20px rgba(59,130,246,0.3)' : 'none',
              }}
            >
              {isGenerating ? `GERANDO... ${Math.round(progress)}%` : 'GERAR SPRITESHEET ✨'}
            </button>
            
            {isGenerating && (
              <div style={{ height: 4, background: '#020617', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#3b82f6', width: `${progress}%`, transition: 'width 0.3s' }} />
              </div>
            )}
          </div>
        </div>

        {/* Built Prompt Card */}
        <div style={{ background: '#020617', borderRadius: 24, padding: 20, border: '1px solid #1e293b' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 9, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Prompt Técnico de IA
          </h3>
          <div style={{
            fontSize: 11, color: '#94a3b8', fontStyle: 'italic', lineHeight: '1.6',
            background: 'rgba(255,255,255,0.01)', padding: 12, borderRadius: 12,
            border: '1px dashed #1e293b', minHeight: 60,
          }}>
            {finalPrompt || "Aguardando descrição..."}
          </div>
        </div>
      </section>

      {/* ─── RIGHT: Aesthetics Reference ─── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
        
        <div style={{ 
          background: '#0f172a', borderRadius: 24, padding: 24, border: '1px solid #1e293b', 
          display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#f1f5f9', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Referência Estética
            </h3>
            <button 
              onClick={() => fileInputRef.current?.click()}
              style={{
                fontSize: 9, fontWeight: 900, color: '#3b82f6', background: 'rgba(59,130,246,0.1)',
                border: '1px solid rgba(59,130,246,0.2)', padding: '6px 12px', borderRadius: 10, cursor: 'pointer'
              }}
            >
              + SUBIR FOTO
            </button>
            <input type="file" ref={fileInputRef} onChange={onFileChange} style={{ display: 'none' }} accept="image/*" />
          </div>

          <p style={{ margin: 0, fontSize: 10, color: '#475569', lineHeight: '1.5' }}>
            Selecione uma imagem da sua lista ou suba uma nova para servir de guia artístico para a IA.
          </p>

          {/* Reference List / Gallery */}
          <div style={{ 
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', 
            gap: 12, flex: 1, overflowY: 'auto', paddingRight: 8,
            minHeight: 120
          }}>
            {uploadHistory.length > 0 ? (
              uploadHistory.map((img, idx) => (
                <div 
                  key={idx}
                  onClick={() => onSelectRef(img)}
                  style={{
                    aspectRatio: '1', borderRadius: 12, overflow: 'hidden',
                    border: `2px solid ${selectedRef?.src === img.src ? '#3b82f6' : 'transparent'}`,
                    background: '#020617', cursor: 'pointer', transition: 'all 0.2s',
                    position: 'relative'
                  }}
                  className="sprite-grid-bg"
                >
                  <img src={img.src} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
                  {selectedRef?.src === img.src && (
                    <div style={{
                      position: 'absolute', top: 4, right: 4, background: '#3b82f6', color: '#fff',
                      borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 8, fontWeight: 900
                    }}>✓</div>
                  )}
                </div>
              ))
            ) : (
              <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3, gap: 10, border: '2px dashed #1e293b', borderRadius: 20 }}>
                <p style={{ fontSize: 32, margin: 0 }}>🗂️</p>
                <p style={{ fontSize: 9, fontWeight: 700 }}>NENHUMA IMAGEM SUBIDA</p>
              </div>
            )}
          </div>

          {/* Active Preview */}
          <div style={{ 
            background: '#020617', padding: 16, borderRadius: 20, border: '1px solid #1e293b',
            display: 'flex', alignItems: 'center', gap: 16 
          }}>
            <div className="sprite-grid-bg" style={{ width: 60, height: 60, borderRadius: 12, overflow: 'hidden', border: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {selectedRef ? (
                <img src={selectedRef.src} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: 20 }}>🖼️</span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: '#3b82f6', marginBottom: 2 }}>REFERÊNCIA ATIVA</div>
              <div style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic' }}>
                {selectedRef ? "A IA usará este estilo para a geração." : "Nenhuma referência ativa."}
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 800, color: '#475569',
  textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#1e293b', border: '1px solid #334155',
  borderRadius: 12, padding: '12px 16px', fontSize: 12, color: '#f1f5f9',
  outline: 'none', transition: 'border-color 0.2s',
};
