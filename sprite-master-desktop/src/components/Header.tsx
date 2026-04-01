import { Group, Text, Button } from '@mantine/core';
import { IconDownload, IconFileImport } from '@tabler/icons-react';

export function Header({ onImport, onExport }: { onImport: () => void; onExport: () => void }) {
  return (
    <Group h="100%" px="md" justify="space-between" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
      <Group>
        <Text fw={900} size="xl" style={{ letterSpacing: '-1px', textTransform: 'uppercase' }}>
          Sprite Master <span style={{ fontWeight: 300 }}>Ultra</span>
        </Text>
      </Group>

      <Group>
        <Button 
          leftSection={<IconFileImport size={16} />} 
          variant="subtle" 
          color="gray"
          onClick={onImport}
        >
          Import
        </Button>
        <Button 
          leftSection={<IconDownload size={16} />} 
          variant="filled" 
          color="white"
          style={{ color: 'black' }}
          onClick={onExport}
        >
          Export ZIP
        </Button>
      </Group>
    </Group>
  );
}
