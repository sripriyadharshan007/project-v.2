'use client';

import { Box, Flex, Container, HStack, Text } from '@chakra-ui/react';
import Link from 'next/link';
import { LayoutDashboard, PlayCircle, ShieldCheck } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Flex direction="column" minH="100vh">
      {/* Navigation Bar */}
      <Box
        position="sticky"
        top={0}
        zIndex={50}
        w="full"
        borderBottom="1px"
        borderColor="gray.200"
        _dark={{ borderColor: 'gray.700', bg: 'rgba(26, 32, 44, 0.8)' }}
        bg="rgba(255, 255, 255, 0.8)"
        backdropFilter="blur(10px)"
      >
        <Container maxW="container.xl" h={16}>
          <Flex h="full" alignItems="center" justify="space-between">
            {/* Logo */}
            <Link href="/" passHref>
              <Flex alignItems="center" gap={2}>
                <PlayCircle size={24} color="#667eea" />
                <Text
                  fontSize="xl"
                  fontWeight="bold"
                  bgGradient="linear(to-r, blue.400, purple.500)"
                  bgClip="text"
                >
                  FlowEngine
                </Text>
              </Flex>
            </Link>

            {/* Nav Links */}
            <HStack spacing={{ base: 3, sm: 6 }}>
              <Link href="/workflows" passHref>
                <Flex alignItems="center" gap={2} fontSize="sm" fontWeight="medium" opacity={0.8} _hover={{ opacity: 1, transition: '0.2s' }}>
                  <LayoutDashboard size={16} />
                  <Text>Workflows</Text>
                </Flex>
              </Link>
              <Link href="/audit" passHref>
                <Flex alignItems="center" gap={2} fontSize="sm" fontWeight="medium" opacity={0.8} _hover={{ opacity: 1, transition: '0.2s' }}>
                  <ShieldCheck size={16} />
                  <Text>Audit Logs</Text>
                </Flex>
              </Link>
              <ThemeToggle />
            </HStack>
          </Flex>
        </Container>
      </Box>

      {/* Main Content Area */}
      <Box flex="1" as="main" py={8}>
        <Container maxW="container.xl">
          {children}
        </Container>
      </Box>
    </Flex>
  );
}
