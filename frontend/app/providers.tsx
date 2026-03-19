'use client';

import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { ToastProvider } from '@/components/ToastProvider';

const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider theme={theme}>
      <ToastProvider>{children}</ToastProvider>
    </ChakraProvider>
  );
}

