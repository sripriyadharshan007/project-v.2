'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, Loader2, AlertCircle, Play, FileJson } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import {
  Box, Flex, VStack, HStack, Heading, Text, Button, Textarea, Icon,
  Spinner, Alert, AlertIcon, Code
} from '@chakra-ui/react';

interface Workflow {
  id: string;
  name: string;
  isActive: boolean;
  version: number;
  inputSchema: any;
}

export default function ExecuteWorkflowPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id as string;
  const toast = useToast();

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [inputDataStr, setInputDataStr] = useState('{\n  \n}');

  const fetchWorkflow = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<Workflow>(`/workflow/${workflowId}`);
      setWorkflow(res.data);

      if (res.data.inputSchema && Object.keys(res.data.inputSchema).length > 0) {
        const template: any = {};
        for (const [key, details] of Object.entries(res.data.inputSchema as Record<string, any>)) {
          if (details.type === 'number') template[key] = 0;
          else if (details.type === 'boolean') template[key] = false;
          else template[key] = '';
        }
        setInputDataStr(JSON.stringify(template, null, 2));
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to load workflow details.');
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);

  const handleExecute = async () => {
    try {
      setExecuting(true);
      setError(null);
      setSuccessMsg(null);

      let parsedData = {};
      try {
        parsedData = JSON.parse(inputDataStr);
      } catch (e) {
        throw new Error('Input Data is not valid JSON. Please check your syntax.');
      }

      await api.post(`/executions/start`, {
        workflowId,
        context: parsedData,
      });

      toast.push({
        type: 'success',
        title: 'Workflow started',
        message: 'Execution started. Check Audit Logs for progress.',
      });
      setSuccessMsg('Workflow execution started successfully! You can view it in the Audit Logs.');

      setTimeout(() => {
        router.push('/audit');
      }, 2000);
    } catch (err: any) {
      toast.push({
        type: 'error',
        title: 'Failed to start workflow',
        message: err.message || err?.response?.data?.message || 'Please try again.',
      });
      setError(err.message || err?.response?.data?.message || 'Failed to execute workflow.');
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <Flex align="center" justify="center" h="70vh" gap={3} color="gray.400">
        <Spinner size="md" />
        <Text>Loading execution panel…</Text>
      </Flex>
    );
  }

  if (error && !workflow) {
    return (
      <VStack justify="center" h="70vh" spacing={4}>
        <Icon as={AlertCircle} w={10} h={10} color="red.400" />
        <Text color="red.400" fontWeight="medium">{error}</Text>
        <Button variant="link" color="gray.400" onClick={() => router.back()}>Go back</Button>
      </VStack>
    );
  }

  return (
    <Box maxW="3xl" mx="auto">
      <VStack spacing={8} align="stretch">
        {/* Header */}
        <Flex align="center" justify="space-between">
          <HStack spacing={4}>
            <Button variant="ghost" size="sm" onClick={() => router.back()} p={2} rounded="lg">
              <Icon as={ArrowLeft} w={5} h={5} />
            </Button>
            <Box>
              <Heading size="lg">Execute Workflow</Heading>
              <Text fontSize="sm" color="gray.500">
                {workflow?.name} &nbsp;·&nbsp; v{workflow?.version}
              </Text>
            </Box>
          </HStack>
        </Flex>

        {error && !successMsg && (
          <Alert status="error" rounded="lg">
            <AlertIcon />
            <Text fontSize="sm" whiteSpace="pre-wrap">{error}</Text>
          </Alert>
        )}

        {successMsg && (
          <Alert status="success" rounded="lg">
            <AlertIcon />
            <Text fontSize="sm">{successMsg}</Text>
          </Alert>
        )}

        {!workflow?.isActive && !successMsg && (
          <Alert status="warning" rounded="lg">
            <AlertIcon />
            <Box>
              <Text fontSize="sm" fontWeight="medium">Warning: This workflow is marked as Draft/Inactive.</Text>
              <Text fontSize="xs" mt={1}>If the backend strictly enforces this, the execution may be rejected.</Text>
            </Box>
          </Alert>
        )}

        <Box
          bg="white" _dark={{ bg: 'gray.800' }}
          border="1px" borderColor="gray.200"
          rounded="xl" p={6} shadow="sm"
        >
          <VStack spacing={6} align="stretch">
            <Flex align="start" justify="space-between">
              <Box>
                <HStack spacing={2}>
                  <Icon as={FileJson} w={5} h={5} color="purple.400" />
                  <Heading size="md">Input Data Payload</Heading>
                </HStack>
                <Text fontSize="sm" color="gray.500" mt={1}>
                  Provide the input context (JSON) expected by the workflow schema.
                </Text>
              </Box>
            </Flex>

            {workflow?.inputSchema && Object.keys(workflow.inputSchema).length > 0 && (
              <Box bg="gray.50" _dark={{ bg: 'gray.900' }} p={4} rounded="lg" border="1px" borderColor="gray.200">
                <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase" letterSpacing="wider" mb={2}>
                  Required Schema
                </Text>
                <Code display="block" whiteSpace="pre" fontSize="xs" fontFamily="mono" colorScheme="purple" p={2} rounded="md" overflowX="auto">
                  {JSON.stringify(workflow.inputSchema, null, 2)}
                </Code>
              </Box>
            )}

            <Textarea
              value={inputDataStr}
              onChange={(e) => setInputDataStr(e.target.value)}
              isDisabled={executing || !!successMsg}
              fontFamily="mono"
              fontSize="sm"
              h="256px"
              bg="gray.50" _dark={{ bg: 'gray.900' }}
              spellCheck={false}
              placeholder={'{\n  "key": "value"\n}'}
            />

            <Flex justify="flex-end" pt={4} borderTop="1px" borderColor="gray.200" _dark={{ borderColor: 'gray.700' }}>
              <Button
                leftIcon={executing ? <Spinner size="xs" /> : <Icon as={Play} w={5} h={5} />}
                colorScheme="green"
                onClick={handleExecute}
                isDisabled={executing || !!successMsg}
                shadow="md"
              >
                {executing ? 'Starting execution...' : 'Run Workflow'}
              </Button>
            </Flex>
          </VStack>
        </Box>
      </VStack>
    </Box>
  );
}
