'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Plus, Edit2, Play, Trash2, Calendar, CheckCircle2, XCircle, GitGraph } from 'lucide-react';
import { format } from 'date-fns';
import {
  Box, Flex, VStack, HStack, Heading, Text, Button, Input, Select,
  Table, Thead, Tbody, Tr, Th, Td, TableContainer, Badge, Spinner, Icon, IconButton
} from '@chakra-ui/react';

interface Workflow {
  id: string;
  name: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResult {
  data: Workflow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function WorkflowsPage() {
  const router = useRouter();
  const [data, setData] = useState<PaginatedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft'>('all');
  const [stepCounts, setStepCounts] = useState<Record<string, number>>({});

  const fetchWorkflows = async (currentPage: number) => {
    try {
      setLoading(true);
      const response = await api.get<PaginatedResult>(`/workflow?page=${currentPage}&limit=10`);
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch workflows', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows(page);
  }, [page]);

  useEffect(() => {
    const items = data?.data ?? [];
    if (items.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const missing = items.filter((wf) => stepCounts[wf.id] === undefined);
        if (missing.length === 0) return;

        const counts = await Promise.all(
          missing.map(async (wf) => {
            const res = await api.get<any[]>(`/steps/workflow/${wf.id}`);
            return [wf.id, Array.isArray(res.data) ? res.data.length : 0] as const;
          }),
        );

        if (cancelled) return;
        setStepCounts((prev) => {
          const next = { ...prev };
          for (const [id, count] of counts) next[id] = count;
          return next;
        });
      } catch (e) {
        console.warn('Failed to fetch step counts', e);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.data]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    try {
      await api.delete(`/workflow/${id}`);
      fetchWorkflows(page);
    } catch (error) {
      console.error('Failed to delete', error);
      alert('Error deleting workflow');
    }
  };

  const createWorkflow = async () => {
    try {
      const response = await api.post('/workflow', {
        name: 'Untitled Workflow',
        isActive: false
      });
      router.push(`/workflows/${response.data.id}/editor`);
    } catch (error) {
      console.error('Failed to create workflow', error);
      alert('Error creating workflow');
    }
  };

  const items = data?.data ?? [];
  const filtered = items.filter((wf) => {
    const qq = q.trim().toLowerCase();
    const matchesQuery = qq.length === 0 || wf.name.toLowerCase().includes(qq) || wf.id.toLowerCase().includes(qq);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && wf.isActive) ||
      (statusFilter === 'draft' && !wf.isActive);
    return matchesQuery && matchesStatus;
  });

  return (
    <VStack spacing={6} align="stretch" w="full">
      <Flex direction={{ base: 'column', sm: 'row' }} justify="space-between" align={{ sm: 'center' }} gap={4}>
        <Box>
          <Heading size="lg" letterSpacing="tight">Workflows</Heading>
          <Text color="gray.500" mt={1}>Manage and orchestrate your automated processes.</Text>
        </Box>
        <Button
          leftIcon={<Plus size={20} />}
          colorScheme="purple"
          onClick={createWorkflow}
          shadow="md"
        >
          Create Workflow
        </Button>
      </Flex>

      <Flex direction={{ base: 'column', md: 'row' }} gap={3} align={{ md: 'center' }} justify={{ md: 'space-between' }}>
        <Flex direction={{ base: 'column', sm: 'row' }} gap={3} align={{ sm: 'center' }}>
          <Box w={{ base: 'full', sm: '320px' }}>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or ID…"
              bg="white" _dark={{ bg: 'gray.900' }}
            />
          </Box>
          <Box w={{ base: 'full', sm: '192px' }}>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              bg="white" _dark={{ bg: 'gray.900' }}
            >
              <option value="all" style={{ color: 'inherit', background: 'inherit' }}>All statuses</option>
              <option value="active" style={{ color: 'inherit', background: 'inherit' }}>Active</option>
              <option value="draft" style={{ color: 'inherit', background: 'inherit' }}>Draft</option>
            </Select>
          </Box>
        </Flex>
        <Text fontSize="sm" color="gray.500">
          Showing <Text as="span" fontWeight="medium" color="gray.900" _dark={{ color: 'white' }}>{filtered.length}</Text> of{' '}
          <Text as="span" fontWeight="medium" color="gray.900" _dark={{ color: 'white' }}>{items.length}</Text> on this page
        </Text>
      </Flex>

      {loading ? (
        <VStack py={12} spacing={4}>
          <Spinner color="purple.500" size="xl" />
          <Text color="gray.500">Loading workflows...</Text>
        </VStack>
      ) : (
        <Box bg="white" border="1px" borderColor="gray.200" _dark={{ bg: 'gray.800', borderColor: 'gray.700' }} rounded="xl" overflow="hidden" shadow="sm">
          <TableContainer>
            <Table variant="simple" size="md">
              <Thead bg="gray.50" _dark={{ bg: 'gray.700' }}>
                <Tr>
                  <Th>ID</Th>
                  <Th>Name</Th>
                  <Th>Steps</Th>
                  <Th>Status</Th>
                  <Th>Version</Th>
                  <Th textAlign="right">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filtered.length === 0 ? (
                  <Tr>
                    <Td colSpan={6} textAlign="center" py={10} color="gray.500">
                      No workflows match your search/filter.
                    </Td>
                  </Tr>
                ) : (
                  filtered.map((wf) => (
                    <Tr key={wf.id} _hover={{ bg: 'gray.50', _dark: { bg: 'gray.700' } }} role="group">
                      <Td fontFamily="mono" fontSize="xs" color="gray.500">
                        {wf.id.slice(0, 8)}…
                      </Td>
                      <Td fontWeight="medium">
                        <VStack align="start" spacing={0.5}>
                          <Text>{wf.name}</Text>
                          <HStack fontSize="xs" color="gray.500">
                            <Icon as={Calendar} w={3.5} h={3.5} opacity={0.6} />
                            <Text>{format(new Date(wf.createdAt), 'MMM d, yyyy')}</Text>
                          </HStack>
                        </VStack>
                      </Td>
                      <Td>
                        <Badge variant="subtle" px={2} py={1} rounded="md">
                          {stepCounts[wf.id] === undefined ? '—' : stepCounts[wf.id]}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge
                          colorScheme={wf.isActive ? 'green' : 'gray'}
                          display="inline-flex"
                          alignItems="center"
                          gap={1.5}
                          px={2}
                          py={1}
                          rounded="full"
                        >
                          <Icon as={wf.isActive ? CheckCircle2 : XCircle} w={3.5} h={3.5} />
                          {wf.isActive ? 'Active' : 'Draft'}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge variant="outline" fontFamily="mono" px={2} py={1} rounded="md">
                          v{wf.version}
                        </Badge>
                      </Td>
                      <Td textAlign="right">
                        <HStack spacing={1} justify="flex-end">
                          <IconButton
                            as={Link}
                            href={`/workflows/${wf.id}/editor`}
                            aria-label="Edit Workflow"
                            icon={<Icon as={Edit2} w={4} h={4} />}
                            size="sm"
                            variant="ghost"
                            colorScheme="purple"
                          />
                          <IconButton
                            as={Link}
                            href={`/workflows/${wf.id}/execute`}
                            aria-label="Execute Workflow"
                            icon={<Icon as={Play} w={4} h={4} />}
                            size="sm"
                            variant="ghost"
                            colorScheme="green"
                          />
                          <IconButton
                            as={Link}
                            href={`/workflows/${wf.id}/graph`}
                            aria-label="View Graph"
                            icon={<Icon as={GitGraph} w={4} h={4} />}
                            size="sm"
                            variant="ghost"
                            colorScheme="purple"
                          />
                          <IconButton
                            aria-label="Delete Workflow"
                            icon={<Icon as={Trash2} w={4} h={4} />}
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => handleDelete(wf.id)}
                          />
                        </HStack>
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          </TableContainer>
          
          {data && data.totalPages > 1 && (
            <Flex borderTop="1px" borderColor="gray.200" _dark={{ borderColor: 'gray.700' }} px={6} py={4} align="center" justify="space-between" fontSize="sm">
              <Text color="gray.500">
                Showing page <Text as="span" fontWeight="medium" color="gray.900" _dark={{ color: 'white' }}>{data.page}</Text> of{' '}
                <Text as="span" fontWeight="medium" color="gray.900" _dark={{ color: 'white' }}>{data.totalPages}</Text>
              </Text>
              <HStack spacing={2}>
                <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} isDisabled={data.page === 1}>Previous</Button>
                <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} isDisabled={data.page === data.totalPages}>Next</Button>
              </HStack>
            </Flex>
          )}
        </Box>
      )}
    </VStack>
  );
}
