'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, Loader2, AlertCircle, Save, GitGraph } from 'lucide-react';
import Link from 'next/link';
import {
  Box, Flex, VStack, HStack, Heading, Text, Button, Input, Textarea,
  Icon, Switch, FormControl, FormLabel, Spinner, Alert, AlertIcon,
  SimpleGrid, Code
} from '@chakra-ui/react';

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  version: number;
  inputSchema: any;
}

export default function WorkflowEditorPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id as string;

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [inputSchemaStr, setInputSchemaStr] = useState('{}');

  const fetchWorkflow = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<Workflow>(`/workflow/${workflowId}`);
      setWorkflow(res.data);
      setName(res.data.name);
      setIsActive(res.data.isActive);
      setInputSchemaStr(JSON.stringify(res.data.inputSchema || {}, null, 2));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to load workflow.');
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      let parsedSchema = {};
      try {
        parsedSchema = JSON.parse(inputSchemaStr);
      } catch (e) {
        throw new Error('Input Schema is not valid JSON.');
      }

      await api.patch(`/workflow/${workflowId}`, {
        name,
        isActive,
        inputSchema: parsedSchema,
      });

      alert('Workflow saved successfully!');
    } catch (err: any) {
      setError(err.message || err?.response?.data?.message || 'Failed to save workflow.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Flex align="center" justify="center" h="70vh" gap={3} color="gray.400">
        <Spinner size="md" />
        <Text>Loading editor…</Text>
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
    <Box maxW="4xl" mx="auto">
      <VStack spacing={8} align="stretch">
        {/* Header */}
        <Flex align="center" justify="space-between">
          <HStack spacing={4}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              p={2}
              rounded="lg"
            >
              <Icon as={ArrowLeft} w={5} h={5} />
            </Button>
            <Box>
              <Heading size="lg">Edit Workflow</Heading>
              <Text fontSize="sm" color="gray.500">
                v{workflow?.version} &nbsp;·&nbsp; ID: {workflow?.id}
              </Text>
            </Box>
          </HStack>
          <HStack spacing={3}>
            <Button
              as={Link}
              href={`/workflows/${workflowId}/graph`}
              leftIcon={<Icon as={GitGraph} w={4} h={4} />}
              variant="outline"
              size="sm"
            >
              View Graph
            </Button>
            <Button
              leftIcon={saving ? <Spinner size="xs" /> : <Icon as={Save} w={4} h={4} />}
              colorScheme="purple"
              size="sm"
              onClick={handleSave}
              isDisabled={saving}
            >
              Save Changes
            </Button>
          </HStack>
        </Flex>

        {error && (
          <Alert status="error" rounded="lg">
            <AlertIcon />
            <Text fontSize="sm">{error}</Text>
          </Alert>
        )}

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
          {/* Main Settings */}
          <Box gridColumn={{ md: 'span 2' }}>
            <VStack spacing={6} align="stretch">
              <Box
                bg="white" _dark={{ bg: 'gray.800', borderColor: 'gray.700' }}
                border="1px" borderColor="gray.200"
                rounded="xl" p={6} shadow="sm"
              >
                <Heading size="md" mb={4}>General Settings</Heading>

                <FormControl mb={4}>
                  <FormLabel fontSize="sm">Workflow Name</FormLabel>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Expense Approval"
                    bg="gray.50" _dark={{ bg: 'gray.900' }}
                  />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <Switch
                    colorScheme="purple"
                    isChecked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    mr={3}
                  />
                  <Box>
                    <FormLabel mb={0} fontSize="sm">Active Status</FormLabel>
                    <Text fontSize="xs" color="gray.500">Enable or disable this workflow execution</Text>
                  </Box>
                </FormControl>
              </Box>

              <Box
                bg="white" _dark={{ bg: 'gray.800' }}
                border="1px" borderColor="gray.200"
                rounded="xl" p={6} shadow="sm"
              >
                <Heading size="md" mb={2}>Input Schema (JSON)</Heading>
                <Text fontSize="xs" color="gray.500" mb={4}>
                  Define the required input fields using a flat-property map (e.g. <Code fontSize="xs">{`{ "amount": {"type": "number", "required": true} }`}</Code>)
                </Text>
                <Textarea
                  value={inputSchemaStr}
                  onChange={(e) => setInputSchemaStr(e.target.value)}
                  fontFamily="mono"
                  fontSize="sm"
                  h="256px"
                  bg="gray.50" _dark={{ bg: 'gray.900' }}
                  spellCheck={false}
                />
              </Box>
            </VStack>
          </Box>

          {/* Sidebar */}
          <Box>
            <Box
              bg="white" _dark={{ bg: 'gray.800' }}
              border="1px" borderColor="gray.200"
              rounded="xl" p={6} shadow="sm"
            >
              <Heading size="sm" textTransform="uppercase" letterSpacing="wider" mb={4}>Quick Actions</Heading>
              <Text fontSize="sm" color="gray.500" mb={4}>
                Currently, steps and rules must be configured via the API or Graph view.
                Full visual builder coming soon!
              </Text>
              <Button
                as={Link}
                href={`/workflows/${workflowId}/graph`}
                leftIcon={<Icon as={GitGraph} w={4} h={4} />}
                colorScheme="purple"
                variant="outline"
                w="full"
              >
                Open Visual Graph
              </Button>
            </Box>
          </Box>
        </SimpleGrid>
      </VStack>
    </Box>
  );
}
