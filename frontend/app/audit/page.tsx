'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Loader2, AlertCircle, ShieldCheck, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  Box, Flex, VStack, HStack, Heading, Text, Button, Input, Select,
  Table, Thead, Tbody, Tr, Th, Td, TableContainer, Badge, Spinner, Icon
} from '@chakra-ui/react';

interface ExecutionLog {
  id: string;
  executionId: string;
  stepId: string;
  stepName: string;
  stepType: string;
  status: string;
  errorMessage: string | null;
  evaluatedRules: any;
  selectedNextStep: string | null;
  startedAt: string;
  endedAt: string;
  execution: {
    workflow: {
      name: string;
    };
  };
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'failed' | 'rejected'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/executions');
      
      let allLogs: ExecutionLog[] = [];
      res.data.forEach((exec: any) => {
        if (exec.logs) {
          const execLogs = exec.logs.map((log: any) => ({
            ...log,
            execution: {
              workflow: {
                name: exec.workflow?.name || 'Workflow'
              }
            }
          }));
          allLogs = [...allLogs, ...execLogs];
        }
      });
      
      allLogs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      setLogs(allLogs);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [q, statusFilter]);

  const filtered = logs.filter((log) => {
    const status = (log.status || '').toLowerCase();
    const qq = q.trim().toLowerCase();
    const matchesQuery =
      qq.length === 0 ||
      log.executionId.toLowerCase().includes(qq) ||
      (log.execution?.workflow?.name || '').toLowerCase().includes(qq) ||
      (log.stepName || '').toLowerCase().includes(qq);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'completed' && status === 'completed') ||
      (statusFilter === 'failed' && status === 'failed') ||
      (statusFilter === 'rejected' && status === 'rejected');

    return matchesQuery && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pageItems = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  return (
    <VStack spacing={6} align="stretch" w="full">
      <Flex direction={{ base: 'column', sm: 'row' }} justify="space-between" align={{ sm: 'center' }} gap={4}>
        <Box>
          <HStack spacing={3}>
            <Icon as={ShieldCheck} w={8} h={8} color="purple.500" />
            <Heading size="lg" letterSpacing="tight">Audit Logs</Heading>
          </HStack>
          <Text color="gray.500" mt={1}>System-wide trail of workflow executions.</Text>
        </Box>
      </Flex>

      {error ? (
        <VStack bg="red.50" _dark={{ bg: 'red.900', opacity: 0.1 }} border="1px" borderColor="red.200" rounded="lg" p={6} spacing={4}>
          <Icon as={AlertCircle} w={10} h={10} color="red.400" />
          <Text color="red.400" fontWeight="medium" textAlign="center">{error}</Text>
          <Button colorScheme="red" variant="subtle" onClick={fetchLogs}>Try Again</Button>
        </VStack>
      ) : loading ? (
        <VStack py={20} spacing={4} border="1px" borderColor="gray.200" rounded="xl" bg="white" _dark={{ bg: 'gray.800', borderColor: 'gray.700' }} shadow="sm">
          <Spinner color="purple.500" size="xl" />
          <Text fontWeight="medium" color="gray.500">Loading audit logs...</Text>
        </VStack>
      ) : logs.length === 0 ? (
        <VStack py={20} spacing={4} border="1px" borderColor="gray.200" rounded="xl" bg="white" _dark={{ bg: 'gray.800', borderColor: 'gray.700' }} shadow="sm" px={4} textAlign="center">
          <Flex w={16} h={16} rounded="full" bg="gray.100" _dark={{ bg: 'gray.700' }} align="center" justify="center" color="gray.500" mb={2}>
            <Icon as={Clock} w={8} h={8} />
          </Flex>
          <Heading size="md">No logs found</Heading>
          <Text color="gray.500" maxW="sm">Execute a workflow to generate audit logs. They will appear here automatically.</Text>
          <Button as={Link} href="/workflows" mt={4} colorScheme="purple">
            Go to Workflows
          </Button>
        </VStack>
      ) : (
        <VStack spacing={3} align="stretch">
          <Flex direction={{ base: 'column', md: 'row' }} gap={3} align={{ md: 'center' }} justify={{ md: 'space-between' }}>
            <Flex direction={{ base: 'column', sm: 'row' }} gap={3} align={{ sm: 'center' }}>
              <Box w={{ base: 'full', sm: '320px' }}>
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by execution, workflow, step…"
                  bg="white" _dark={{ bg: 'gray.900' }}
                />
              </Box>
              <Box w={{ base: 'full', sm: '192px' }}>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  bg="white" _dark={{ bg: 'gray.900' }}
                >
                  <option value="all">All statuses</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="rejected">Rejected</option>
                </Select>
              </Box>
            </Flex>
            <Text fontSize="sm" color="gray.500">
              Showing <Text as="span" fontWeight="medium" color="gray.900" _dark={{ color: 'white' }}>{pageItems.length}</Text> of{' '}
              <Text as="span" fontWeight="medium" color="gray.900" _dark={{ color: 'white' }}>{filtered.length}</Text>
            </Text>
          </Flex>

          <Box bg="white" border="1px" borderColor="gray.200" _dark={{ bg: 'gray.800', borderColor: 'gray.700' }} rounded="xl" overflow="hidden" shadow="sm">
            <TableContainer>
              <Table variant="simple" size="md">
                <Thead bg="gray.50" _dark={{ bg: 'gray.700' }}>
                  <Tr>
                    <Th>Execution ID</Th>
                    <Th>Workflow Name</Th>
                    <Th>Step</Th>
                    <Th>Status</Th>
                    <Th>Timestamp</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {pageItems.map((log) => {
                    const status = (log.status || '').toLowerCase();
                    const isCompleted = status === 'completed';
                    const isFailed = status === 'failed';
                    const isRejected = status === 'rejected';

                    const colorScheme = isCompleted ? 'green' : isRejected ? 'orange' : isFailed ? 'red' : 'gray';
                    const StatusIcon = isCompleted ? CheckCircle2 : XCircle;

                    return (
                      <Tr key={log.id} _hover={{ bg: 'gray.50', _dark: { bg: 'gray.700' } }}>
                        <Td fontFamily="mono" fontSize="xs" color="gray.500">{log.executionId.slice(0, 8)}…</Td>
                        <Td>{log.execution?.workflow?.name || 'Unknown'}</Td>
                        <Td>{log.stepName}</Td>
                        <Td>
                          <Badge colorScheme={colorScheme} display="inline-flex" alignItems="center" gap={1} px={2} py={1} rounded="full">
                            <Icon as={StatusIcon} w={3.5} h={3.5} />
                            {(status || 'unknown').charAt(0).toUpperCase() + (status || 'unknown').slice(1)}
                          </Badge>
                        </Td>
                        <Td color="gray.500" whiteSpace="nowrap">
                          <HStack spacing={2}>
                            <Icon as={Clock} w={4} h={4} opacity={0.6} />
                            <Text>{format(new Date(log.startedAt), 'MMM d, HH:mm:ss')}</Text>
                          </HStack>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </TableContainer>
          </Box>

          <Flex border="1px" borderColor="gray.200" rounded="xl" bg="white" _dark={{ bg: 'gray.800', borderColor: 'gray.700' }} px={6} py={4} align="center" justify="space-between" fontSize="sm">
            <Text color="gray.500">
              Page <Text as="span" fontWeight="medium" color="gray.900" _dark={{ color: 'white' }}>{pageSafe}</Text> of{' '}
              <Text as="span" fontWeight="medium" color="gray.900" _dark={{ color: 'white' }}>{totalPages}</Text>
            </Text>
            <HStack spacing={2}>
              <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} isDisabled={pageSafe === 1}>Previous</Button>
              <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} isDisabled={pageSafe === totalPages}>Next</Button>
            </HStack>
          </Flex>
        </VStack>
      )}
    </VStack>
  );
}
