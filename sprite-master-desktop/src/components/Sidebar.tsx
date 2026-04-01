import { Stack, NumberInput, ColorInput, Button, Title, Divider, Text, Group, Slider } from '@mantine/core';
import { IconSettings, IconFilter, IconWand } from '@tabler/icons-react';
import type { GridParams } from '../utils/imageProcessing';

interface SidebarProps {
  params: GridParams;
  setParams: (p: GridParams) => void;
  bgThreshold: number;
  setBgThreshold: (t: number) => void;
  bgColor: { r: number; g: number; b: number };
  setBgColor: (c: { r: number; g: number; b: number }) => void;
  onAutoGrid: () => void;
}

export function Sidebar({ 
  params, setParams, 
  bgThreshold, setBgThreshold, 
  bgColor, setBgColor,
  onAutoGrid 
}: SidebarProps) {
  
  const updateParam = (key: keyof GridParams, value: number) => {
    setParams({ ...params, [key]: value });
  };

  return (
    <Stack p="md" gap="lg" style={{ height: '100%', borderRight: '1px solid rgba(255, 255, 255, 0.1)', overflowY: 'auto' }}>
      <Stack gap="xs">
        <Group>
          <IconSettings size={18} />
          <Title order={5}>Grid Settings</Title>
        </Group>
        <Group grow>
          <NumberInput label="Cell Width" value={params.width} onChange={(v) => updateParam('width', Number(v))} />
          <NumberInput label="Cell Height" value={params.height} onChange={(v) => updateParam('height', Number(v))} />
        </Group>
        <Group grow>
          <NumberInput label="Columns" value={params.columns} onChange={(v) => updateParam('columns', Number(v))} />
          <NumberInput label="Rows" value={params.rows} onChange={(v) => updateParam('rows', Number(v))} />
        </Group>
        <Group grow>
          <NumberInput label="Offset X" value={params.offsetX} onChange={(v) => updateParam('offsetX', Number(v))} />
          <NumberInput label="Offset Y" value={params.offsetY} onChange={(v) => updateParam('offsetY', Number(v))} />
        </Group>
        <Button 
          fullWidth 
          variant="outline" 
          color="gray"
          leftSection={<IconWand size={16} />}
          onClick={onAutoGrid}
        >
          Auto-Detect Grid
        </Button>
      </Stack>

      <Divider opacity={0.1} />

      <Stack gap="xs">
        <Group>
          <IconFilter size={18} />
          <Title order={5}>Processing Filters</Title>
        </Group>
        
        <ColorInput 
          label="Magic BG Removal" 
          value={`rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`} 
          onChange={(v) => {
            const matches = v.match(/\\d+/g);
            if (matches) setBgColor({ r: Number(matches[0]), g: Number(matches[1]), b: Number(matches[2]) });
          }} 
        />
        <Text size="xs">Threshold: {bgThreshold}</Text>
        <Slider value={bgThreshold} onChange={setBgThreshold} max={255} label={null} color="white" />

        <Text size="xs" mt="xs">Noise Filter: {params.noise}</Text>
        <Slider value={params.noise} onChange={(v) => updateParam('noise', v)} max={8} label={null} color="white" />

        <Text size="xs" mt="xs">Anti-Bleed: {params.bleed}</Text>
        <Slider value={params.bleed} onChange={(v) => updateParam('bleed', v)} max={10} label={null} color="white" />

        <Text size="xs" mt="xs">Edge Blur: {params.blur}</Text>
        <Slider value={params.blur} onChange={(v) => updateParam('blur', v)} max={10} label={null} color="white" />

        <Text size="xs" mt="xs">Outline: {params.outline}</Text>
        <Slider value={params.outline} onChange={(v) => updateParam('outline', v)} max={10} label={null} color="white" />

        <Text size="xs" mt="xs">Stabilization: {params.stabilize}%</Text>
        <Slider value={params.stabilize} onChange={(v) => updateParam('stabilize', v)} max={100} label={null} color="white" />
      </Stack>

      <Stack mt="auto">
        <Text size="xs" c="dimmed" ta="center">
          Sprite Master Ultra Desktop v2.0
        </Text>
      </Stack>
    </Stack>
  );
}
