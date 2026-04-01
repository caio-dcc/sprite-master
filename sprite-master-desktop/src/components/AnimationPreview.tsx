// ────────────────────────────────────────────────────────────
// AnimationPreview.tsx
// Playback panel: Play/Pause, FPS control, frame stepping
// ────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import type { FrameState } from '../hooks/useSpriteProcessor';

interface Props {
  frames: FrameState[];
  showGuidelines: boolean;
}

export function AnimationPreview({ frames, showGuidelines }: Props) {
  const [current, setCurrent]   = useState(0);
  const [playing, setPlaying]   = useState(false);
  const [fps, setFps]           = useState(8);
  const [previews, setPreviews] = useState<string[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setPreviews(frames.map(f => f.canvas.toDataURL()));
    setCurrent(0);
  }, [frames]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (playing && frames.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrent(c => (c + 1) % frames.length);
      }, 1000 / fps);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, fps, frames.length]);

  if (frames.length === 0) return null;

  const stepBack = () => setCurrent(c => (c - 1 + frames.length) % frames.length);
  const stepFwd  = () => setCurrent(c => (c + 1) % frames.length);

  return (
    <div style={{
      background: '#0f172a', border: '1px solid #1e293b',
      borderRadius: 24, padding: 24,
      display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center'
    }}>
      <h3 style={{ margin: 0, fontSize: 10, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        Preview da Animação
      </h3>

      {/* Canvas */}
      <div
        className="sprite-grid-bg"
        style={{
          width: 180, height: 180,
          borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden'
        }}
      >
        {showGuidelines && <div className="guide-lines" />}
        {previews[current] && (
          <img
            src={previews[current]}
            alt="preview"
            style={{
              maxWidth: '100%', maxHeight: '100%',
              imageRendering: 'pixelated', display: 'block'
            }}
          />
        )}
      </div>

      {/* Frame counter */}
      <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#60a5fa' }}>
        {current + 1} / {frames.length}
      </span>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <CtrlBtn onClick={stepBack}>◄</CtrlBtn>
        <CtrlBtn
          onClick={() => setPlaying(v => !v)}
          style={{ background: playing ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)', minWidth: 64 }}
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </CtrlBtn>
        <CtrlBtn onClick={stepFwd}>►</CtrlBtn>
      </div>

      {/* FPS slider */}
      <div style={{ width: '100%', maxWidth: 260 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
          <span>Velocidade (FPS)</span>
          <span>{fps} fps</span>
        </div>
        <input
          type="range" className="custom-range"
          min={1} max={30} value={fps}
          onChange={e => setFps(Number(e.target.value))}
        />
      </div>
    </div>
  );
}

function CtrlBtn({ children, onClick, style }: {
  children: React.ReactNode;
  onClick: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8, padding: '6px 12px',
        color: '#f1f5f9', fontSize: 11, cursor: 'pointer',
        fontFamily: 'inherit',
        ...style
      }}
    >{children}</button>
  );
}
