import { Box, Text, Group, rem } from '@mantine/core';
import { useRef, useEffect } from 'react';
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import { IconUpload, IconPhoto, IconX } from '@tabler/icons-react';
import type { GridParams } from '../utils/imageProcessing';

interface CanvasViewProps {
  image: HTMLImageElement | null;
  params: GridParams;
  onDrop: (files: File[]) => void;
}

export function CanvasView({ image, params, onDrop }: CanvasViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!image || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    canvasRef.current.width = image.width;
    canvasRef.current.height = image.height;

    // Draw image
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    const { width, height, columns, rows, offsetX, offsetY, overlapX, overlapY } = params;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const x = offsetX + c * (width - overlapX);
        const y = offsetY + r * (height - overlapY);
        ctx.strokeRect(x, y, width, height);
      }
    }
  }, [image, params]);

  if (!image) {
    return (
      <Dropzone
        onDrop={onDrop}
        onReject={(files) => console.log('rejected files', files)}
        maxSize={5 * 1024 ** 2}
        accept={IMAGE_MIME_TYPE}
        h={400}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.02)',
          border: '2px dashed rgba(255,255,255,0.1)',
          borderRadius: 16
        }}
      >
        <Group justify="center" gap="xl" mih={220} style={{ pointerEvents: 'none' }}>
          <Dropzone.Accept>
            <IconUpload
              style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-blue-6)' }}
              stroke={1.5}
            />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX
              style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-red-6)' }}
              stroke={1.5}
            />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconPhoto
              style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-dimmed)' }}
              stroke={1.5}
            />
          </Dropzone.Idle>

          <div>
            <Text size="xl" inline>
              Drag images here or click to select files
            </Text>
            <Text size="sm" c="dimmed" inline mt={7}>
              Attach as many files as you like, each file should not exceed 5mb
            </Text>
          </div>
        </Group>
      </Dropzone>
    );
  }

  return (
    <Box style={{ overflow: 'auto', height: '100%', width: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ display: 'block', margin: 'auto', imageRendering: 'pixelated' }} />
    </Box>
  );
}
