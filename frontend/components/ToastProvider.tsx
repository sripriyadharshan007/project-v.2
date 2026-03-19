'use client';

import { useToast as useChakraToast } from '@chakra-ui/react';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useToast() {
  const toast = useChakraToast();

  return {
    push: (t: any) => {
      toast({
        title: t.title,
        description: t.message,
        status: t.type === 'error' ? 'error' : t.type === 'success' ? 'success' : 'info',
        duration: t.durationMs || 4000,
        isClosable: true,
      });
    },
    dismiss: (id: string) => {
      toast.close(id);
    },
  };
}

