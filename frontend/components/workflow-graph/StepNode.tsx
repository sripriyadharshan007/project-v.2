'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { CheckCircle2, Bell, Wrench, Star } from 'lucide-react';
import { Box, Flex, HStack, Text, Icon, Badge } from '@chakra-ui/react';

type StepType = 'TASK' | 'APPROVAL' | 'NOTIFICATION';

interface StepNodeData {
  label: string;
  stepType: StepType;
  isStartStep?: boolean;
}

const CONFIG: Record<StepType, {
  icon: React.ElementType;
  colorScheme: string;
}> = {
  TASK:         { icon: Wrench,       colorScheme: 'indigo' },
  APPROVAL:     { icon: CheckCircle2, colorScheme: 'orange' },
  NOTIFICATION: { icon: Bell,         colorScheme: 'green' },
};

function StepNode({ data, selected }: NodeProps) {
  const { label, stepType, isStartStep } = data as unknown as StepNodeData;
  const cfg = CONFIG[stepType] ?? CONFIG.TASK;
  const BadgeIcon = cfg.icon;

  const bgMap: Record<string, string> = {
    indigo: 'indigo.50',
    orange: 'orange.50',
    green: 'green.50',
  };
  const borderColorMap: Record<string, string> = {
    indigo: 'indigo.200',
    orange: 'orange.200',
    green: 'green.200',
  };
  const iconColorMap: Record<string, string> = {
    indigo: 'indigo.500',
    orange: 'orange.500',
    green: 'green.500',
  };

  const bg = bgMap[cfg.colorScheme];
  const border = borderColorMap[cfg.colorScheme];
  const iconColor = iconColorMap[cfg.colorScheme];

  return (
    <Box
      position="relative"
      minW="180px"
      rounded="xl"
      borderWidth="2px"
      borderColor={selected ? 'blue.400' : border}
      bg={bg}
      _dark={{ bg: 'gray.800', borderColor: selected ? 'blue.400' : 'gray.600' }}
      px={4}
      py={3}
      shadow={selected ? 'outline' : 'md'}
      transform={selected ? 'scale(1.05)' : 'none'}
      transition="all 0.2s"
      _hover={{ transform: 'scale(1.02)', shadow: 'xl' }}
    >
      {isStartStep && (
        <Badge
          position="absolute"
          top="-2.5"
          left="50%"
          transform="translateX(-50%)"
          colorScheme="indigo"
          bg="indigo.600"
          color="white"
          rounded="full"
          px={2}
          py={0.5}
          fontSize="2xs"
          shadow="sm"
          display="flex"
          alignItems="center"
          gap={1}
        >
          <Icon as={Star} w={2.5} h={2.5} />
          START
        </Badge>
      )}

      <HStack spacing={2.5}>
        <Flex
          align="center"
          justify="center"
          w={8}
          h={8}
          rounded="lg"
          bg="white"
          _dark={{ bg: 'gray.700' }}
        >
          <Icon as={BadgeIcon} w={4} h={4} color={iconColor} />
        </Flex>
        <Text fontSize="sm" fontWeight="semibold" color="gray.800" _dark={{ color: 'gray.100' }} lineHeight="tight">
          {label}
        </Text>
      </HStack>

      <Box mt={2}>
        <Badge colorScheme={cfg.colorScheme} fontSize="2xs" px={2} py={0.5} rounded="full">
          {stepType.toLowerCase()}
        </Badge>
      </Box>

      {/* React Flow handles */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ width: 12, height: 12, background: '#475569', border: '2px solid #cbd5e1' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ width: 12, height: 12, background: '#475569', border: '2px solid #cbd5e1' }}
      />
    </Box>
  );
}

export default memo(StepNode);
