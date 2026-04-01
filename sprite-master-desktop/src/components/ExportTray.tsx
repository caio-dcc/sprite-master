import { Group, Box, Text, ScrollArea, Tooltip, Badge } from '@mantine/core';
import type { SpriteSlice } from '../utils/imageProcessing';
import { useEffect, useState } from 'react';

interface ExportTrayProps {
  slices: SpriteSlice[];
  excludedIndices: Set<number>;
  onToggleExclusion: (idx: number) => void;
}

export function ExportTray({ slices, excludedIndices, onToggleExclusion }: ExportTrayProps) {
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = slices.map(s => s.canvas.toDataURL());
    setPreviews(urls);
  }, [slices]);

  if (slices.length === 0) return null;

  return (
    <Box p="xs" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', background: 'black' }}>
      <Text size="xs" mb={5} fw={700} c="dimmed">EXTRACTED FRAMES ({slices.length})</Text>
      <ScrollArea w="100%" h={120}>
        <Group gap="xs" wrap="nowrap">
          {previews.map((url, i) => {
            const isExcluded = excludedIndices.has(i);
            return (
              <Tooltip key={i} label={isExcluded ? `Frame ${i} (Excluded)` : `Frame ${i}`}>
                <Box 
                  onClick={() => onToggleExclusion(i)}
                  style={{ 
                    border: isExcluded ? '1px solid #ff4d4f' : '1px solid rgba(255, 255, 255, 0.1)', 
                    borderRadius: 4,
                    overflow: 'hidden',
                    background: isExcluded ? '#2a1212' : '#111',
                    flexShrink: 0,
                    position: 'relative',
                    cursor: 'pointer',
                    opacity: isExcluded ? 0.5 : 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <img src={url} alt={`frame-${i}`} style={{ height: 80, display: 'block', imageRendering: 'pixelated' }} />
                  {isExcluded && (
                    <Badge 
                      color="red" 
                      size="xs" 
                      style={{ position: 'absolute', top: 2, right: 2, pointerEvents: 'none' }}
                    >
                      X
                    </Badge>
                  )}
                  <Text size="10px" c="dimmed" style={{ textAlign: 'center', background: '#000' }}>#{i}</Text>
                </Box>
              </Tooltip>
            );
          })}
        </Group>
      </ScrollArea>
    </Box>
  );
}
