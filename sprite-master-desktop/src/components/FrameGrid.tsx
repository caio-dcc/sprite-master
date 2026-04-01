// ────────────────────────────────────────────────────────────
// FrameGrid.tsx
// Drag-to-reorder sortable grid of sprite frames.
// Each card: Exclude toggle | Duplicate | View/Edit
// ────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
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
}

export function FrameGrid({
  frames, deletedFrames, showGuidelines,
  onToggleExclusion, onDelete, onRestore, onDuplicate, onReorder, onView,
}: Props) {
  const [previews, setPreviews]             = useState<string[]>([]);
  const [deletedPreviews, setDeletedPreviews] = useState<string[]>([]);
  const [draggingIdx, setDraggingIdx]       = useState<number | null>(null);
  const [overIdx, setOverIdx]               = useState<number | null>(null);
  const [showDeleted, setShowDeleted]       = useState(false);

  useEffect(() => { setPreviews(frames.map(f => f.canvas.toDataURL())); },        [frames]);
  useEffect(() => { setDeletedPreviews(deletedFrames.map(f => f.canvas.toDataURL())); }, [deletedFrames]);

  // ── Drag & Drop ──
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
      {/* ── Active frames grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 16 }}>
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
                background: '#0f172a',
                border: isExcluded ? '1px solid #ef4444'
                      : isDragOver ? '2px solid #3b82f6'
                      : '1px solid #1e293b',
                borderRadius: 16, padding: 8,
                transition: 'all 0.15s',
                position: 'relative',
              }}
            >
              {/* Sprite preview – double-click to open editor */}
              <div
                className="sprite-grid-bg"
                onDoubleClick={() => onView(frame.index)}
                style={{
                  aspectRatio: '1', borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', position: 'relative', padding: 4,
                  cursor: 'zoom-in',
                }}
              >
                {showGuidelines && <div className="guide-lines" />}
                {url && (
                  <img
                    src={url}
                    alt={`frame-${frame.index}`}
                    style={{ maxWidth: '100%', maxHeight: '100%', imageRendering: 'pixelated', display: 'block', margin: 'auto' }}
                  />
                )}
                {/* Hover overlay hint */}
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(59,130,246,0.0)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, opacity: 0, transition: 'opacity 0.15s',
                  borderRadius: 8, zIndex: 20,
                }}
                  className="frame-edit-hint"
                >🖊</div>
              </div>

              {/* Frame label + status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5, padding: '0 2px' }}>
                <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#475569' }}>#{pos + 1}</span>
                {isExcluded && (
                  <span style={{ fontSize: 7, color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>excluído</span>
                )}
                {frame.duplicatedFrom !== undefined && (
                  <span style={{ fontSize: 7, color: '#818cf8', fontWeight: 700, textTransform: 'uppercase' }}>cópia</span>
                )}
              </div>

              {/* ── 3 Action buttons ── */}
              <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>

                {/* 1. Exclude / Include toggle */}
                <ActionBtn
                  title={isExcluded ? 'Incluir no export' : 'Excluir do export'}
                  color={isExcluded ? '#34d399' : '#f59e0b'}
                  onClick={() => onToggleExclusion(frame.index)}
                >
                  {isExcluded ? '✓' : '○'}
                </ActionBtn>

                {/* 2. Duplicate */}
                <ActionBtn title="Duplicar frame" color="#818cf8" onClick={() => onDuplicate(frame.index)}>
                  ⧉
                </ActionBtn>

                {/* 3. View / Open Editor (replaces Delete) */}
                <ActionBtn title="Abrir editor" color="#38bdf8" onClick={() => onView(frame.index)}>
                  👁
                </ActionBtn>
              </div>

              {/* Delete (small corner X, less prominent) */}
              <button
                title="Deletar frame (restaurável)"
                onClick={() => onDelete(frame.index)}
                style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 16, height: 16, borderRadius: '50%',
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#ef4444', fontSize: 8, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0, transition: 'opacity 0.15s',
                  lineHeight: 1,
                }}
                className="frame-delete-btn"
              >✕</button>
            </div>
          );
        })}
      </div>

      {/* ── Deleted frames tray ── */}
      {deletedFrames.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <button
            onClick={() => setShowDeleted(v => !v)}
            style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 12, padding: '7px 14px', color: '#ef4444',
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              cursor: 'pointer', marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 8
            }}
          >
            🗑 Frames Deletados ({deletedFrames.length})
            <span style={{ fontSize: 10 }}>{showDeleted ? '▲' : '▼'}</span>
          </button>

          {showDeleted && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 10 }}>
              {deletedFrames.map((frame, pos) => (
                <div key={frame.index} style={{
                  background: '#150a0a', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 12, padding: 8, opacity: 0.65
                }}>
                  <div className="sprite-grid-bg" style={{
                    aspectRatio: '1', borderRadius: 6, overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {deletedPreviews[pos] && (
                      <img src={deletedPreviews[pos]} alt="deleted"
                        style={{ maxWidth: '100%', maxHeight: '100%', imageRendering: 'pixelated', filter: 'grayscale(1)' }}
                      />
                    )}
                  </div>
                  <button onClick={() => onRestore(frame.index)} style={{
                    width: '100%', marginTop: 5, background: 'rgba(6,78,59,0.4)',
                    border: '1px solid rgba(16,185,129,0.25)', borderRadius: 7,
                    padding: '4px 0', color: '#34d399', fontSize: 8, fontWeight: 700,
                    textTransform: 'uppercase', cursor: 'pointer'
                  }}>↩ Restaurar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ children, title, color, onClick }: {
  children: React.ReactNode; title: string; color: string; onClick: () => void;
}) {
  return (
    <button title={title} onClick={onClick} style={{
      flex: 1, background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 8, padding: '4px 0',
      color, fontSize: 12, cursor: 'pointer', transition: 'all 0.1s',
      fontFamily: 'inherit',
    }}
      onMouseEnter={e => (e.currentTarget.style.background = `${color}20`)}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
    >{children}</button>
  );
}
