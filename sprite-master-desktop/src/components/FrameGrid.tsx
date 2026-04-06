// ────────────────────────────────────────────────────────────
// FrameGrid.tsx  –  Monochrome Edition
// ────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import type { FrameState } from '../hooks/useSpriteProcessor';

interface Props {
  frames: FrameState[];
  deletedFrames: FrameState[];
  showGuidelines: boolean;
  onToggleExclusion: (idx: number) => void;
  onDelete: (idx: number) => void;
  onRestore: (idx: number) => void;
  onDuplicate: (idx: number) => void;
  onReorder: (fromPos: number, toPos: number) => void;
  onView: (idx: number) => void;
  onSendToGenerator?: (idx: number) => void;
}

export function FrameGrid({
  frames, deletedFrames, showGuidelines,
  onToggleExclusion: _onToggleExclusion, onDelete, onRestore, onDuplicate, onReorder, onView, onSendToGenerator,
}: Props) {
  const [previews, setPreviews]             = useState<string[]>([]);
  const [deletedPreviews, setDeletedPreviews] = useState<string[]>([]);
  const [draggingIdx, setDraggingIdx]       = useState<number | null>(null);
  const [overIdx, setOverIdx]               = useState<number | null>(null);
  const [showDeleted, setShowDeleted]       = useState(false);

  useEffect(() => { setPreviews(frames.map(f => f.canvas.toDataURL())); },        [frames]);
  useEffect(() => { setDeletedPreviews(deletedFrames.map(f => f.canvas.toDataURL())); }, [deletedFrames]);

  const handleDragStart = (e: React.DragEvent, pos: number) => {
    setDraggingIdx(pos);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent, pos: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverIdx(pos);
  };
  const handleDrop = (e: React.DragEvent, pos: number) => {
    e.preventDefault();
    if (draggingIdx !== null && draggingIdx !== pos) onReorder(draggingIdx, pos);
    setDraggingIdx(null); setOverIdx(null);
  };
  const handleDragEnd = () => { setDraggingIdx(null); setOverIdx(null); };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 20 }}>
        {frames.map((frame, pos) => {
          const isExcluded = frame.excluded;
          const isDragging = draggingIdx === pos;
          const isDragOver = overIdx     === pos;
          const url        = previews[pos] ?? '';

          return (
            <div
              key={frame.index}
              className={[
                'frame-card',
                isDragging  ? 'dragging'  : '',
                isDragOver  ? 'drag-over' : '',
                isExcluded  ? 'excluded-frame' : '',
              ].join(' ')}
              draggable
              onDragStart={e => handleDragStart(e, pos)}
              onDragOver={e  => handleDragOver(e, pos)}
              onDrop={e      => handleDrop(e, pos)}
              onDragEnd={handleDragEnd}
              style={{
                background: '#0a0a0a',
                border: isExcluded ? '1px solid #444' : isDragOver ? '1px solid #fff' : '1px solid #222',
                borderRadius: 12, padding: 12,
                transition: 'all 0.2s',
                position: 'relative',
              }}
            >
              <div
                className="sprite-grid-bg"
                onClick={() => onView(frame.index)}
                style={{
                  aspectRatio: '1', borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', position: 'relative', padding: 4,
                  cursor: 'pointer',
                  border: '1px solid #111'
                }}
              >
                {showGuidelines && <div className="guide-lines" />}
                {url && (
                  <img src={url} alt={`frame-${frame.index}`} style={{ maxWidth: '100%', maxHeight: '100%', imageRendering: 'pixelated', display: 'block', margin: 'auto' }} />
                )}
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.0)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, opacity: 0, transition: '0.2s',
                  borderRadius: 8, zIndex: 20,
                }} className="frame-edit-hint">✏️</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, padding: '0 2px' }}>
                <span className="text-mono" style={{ color: '#444' }}>#{pos + 1}</span>
                {isExcluded && <span style={{ fontSize: 7, color: '#666', fontWeight: 900, textTransform: 'uppercase' }}>OFF</span>}
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <ActionBtn title="Enviar p/ Gerador" color="#fff" onClick={() => onSendToGenerator?.(frame.index)}>🚀</ActionBtn>
                <ActionBtn title="Clone" color="#fff" onClick={() => onDuplicate(frame.index)}>⧉</ActionBtn>
                <ActionBtn title="Editar" color="#fff" onClick={() => onView(frame.index)}>✏️</ActionBtn>
              </div>

              <button
                title="Delete"
                onClick={() => onDelete(frame.index)}
                style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#000', border: '1px solid #333',
                  color: '#fff', fontSize: 8, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0, transition: 'opacity 0.2s',
                }}
                className="frame-delete-btn"
              >✕</button>
            </div>
          );
        })}
      </div>

      {deletedFrames.length > 0 && (
        <div style={{ marginTop: 40, borderTop: '1px solid #111', paddingTop: 24 }}>
          <button
            onClick={() => setShowDeleted(v => !v)}
            style={{
              background: '#111', border: '1px solid #222', borderRadius: 10,
              padding: '8px 20px', color: '#fff', fontSize: 10, fontWeight: 800,
              textTransform: 'uppercase', cursor: 'pointer', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 10
            }}
          >
            🗑 DELETADOS ({deletedFrames.length}) {showDeleted ? '▲' : '▼'}
          </button>

          {showDeleted && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 12 }}>
              {deletedFrames.map((frame, pos) => (
                <div key={frame.index} style={{ background: '#050505', border: '1px solid #111', borderRadius: 12, padding: 10, opacity: 0.5 }}>
                  <div className="sprite-grid-bg" style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {deletedPreviews[pos] && <img src={deletedPreviews[pos]} alt="deleted" style={{ maxWidth: '100%', maxHeight: '100%', imageRendering: 'pixelated', filter: 'grayscale(1)' }} />}
                  </div>
                  <button onClick={() => onRestore(frame.index)} style={{ width: '100%', marginTop: 8, background: '#fff', color: '#000', border: 'none', borderRadius: 8, padding: '6px 0', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer' }}>Restaurar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ children, title, color, onClick }: any) {
  return (
    <button title={title} onClick={onClick} style={{
      flex: 1, background: '#111', border: '1px solid #222', borderRadius: 8,
      padding: '6px 0', color, fontSize: 11, cursor: 'pointer', transition: '0.2s',
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#444')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#222')}
    >{children}</button>
  );
}
