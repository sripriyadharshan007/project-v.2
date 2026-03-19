'use client';

import { useColorMode, IconButton } from '@chakra-ui/react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const { colorMode, toggleColorMode } = useColorMode();

  return (
    <IconButton
      aria-label="Toggle theme"
      icon={colorMode === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
      onClick={toggleColorMode}
      variant="outline"
      size="sm"
    />
  );
}

