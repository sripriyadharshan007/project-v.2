'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import api from '@/lib/api';
import StepNode from '@/components/workflow-graph/StepNode';
import { ArrowLeft, Loader2, AlertCircle, Plus, X, Pencil, Trash2 } from 'lucide-react';
import { buildGraphLayout } from '@/lib/graph-layout';
import {
  Box, Flex, VStack, HStack, Heading, Text, Button, Input, Select,
  Icon, IconButton, Spinner, Badge, FormControl, FormLabel, Checkbox,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton,
  useDisclosure
} from '@chakra-ui/react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Step {
  id: string;
  name: string;
  stepType: 'TASK' | 'APPROVAL' | 'NOTIFICATION';
  order: number;
  role?: string | null;
  metadata?: Record<string, any>;
}

interface Rule {
  id: string;
  stepId: string;
  condition: string;
  nextStepId: string | null;
  priority: number;
  isDefault: boolean;
}

interface Workflow {
  id: string;
  name: string;
  version: number;
  startStepId: string | null;
}

const nodeTypes = { stepNode: StepNode };

// ─────────────────────────────────────────────────────────────────────────────

export default function WorkflowGraphPage() {
  const params     = useParams();
  const router     = useRouter();
  const workflowId = params.id as string;

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [steps,    setSteps]    = useState<Step[]>([]);
  const [rules,    setRules]    = useState<Rule[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // UI State
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const addStepModal = useDisclosure();
  const editStepModal = useDisclosure();

  // New Step Form
  const [newStepName, setNewStepName] = useState('');
  const [newStepType, setNewStepType] = useState<'TASK'|'APPROVAL'|'NOTIFICATION'>('TASK');
  const [editStepName, setEditStepName] = useState('');
  const [editStepType, setEditStepType] = useState<'TASK'|'APPROVAL'|'NOTIFICATION'>('TASK');
  
  // New Rule Form
  const [ruleCondition, setRuleCondition] = useState('');
  const [rulePriority, setRulePriority] = useState(1);
  const [ruleNextStep, setRuleNextStep] = useState<string>('');
  const [ruleIsDefault, setRuleIsDefault] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchWorkflow = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [wfRes, stepsRes] = await Promise.all([
        api.get<Workflow>(`/workflow/${workflowId}`),
        api.get<Step[]>(`/steps/workflow/${workflowId}`),
      ]);

      const wf       = wfRes.data;
      const stepList = stepsRes.data;

      setWorkflow(wf);
      setSteps(stepList);

      const rulesPerStep = await Promise.all(
        stepList.map((s) =>
          api.get<Rule[]>(`/rules/step/${s.id}`).then((r) => r.data),
        ),
      );
      const allRules = rulesPerStep.flat();
      setRules(allRules);

      // Build React Flow graph
      const rawNodes: Node[] = stepList.map((step) => ({
        id:   step.id,
        type: 'stepNode',
        data: {
          label:       step.name,
          stepType:    step.stepType,
          isStartStep: step.id === wf.startStepId,
        },
        position: { x: 0, y: 0 },
      }));

      const rawEdges: Edge[] = allRules
        .filter((r) => r.nextStepId !== null)
        .map((rule) => ({
          id:     `edge-${rule.id}`,
          source: rule.stepId,
          target: rule.nextStepId!,
          label:  rule.isDefault
            ? 'DEFAULT'
            : rule.condition.length > 40
              ? rule.condition.slice(0, 38) + '…'
              : rule.condition,
          labelStyle:     { fill: '#94a3b8', fontSize: 10 },
          labelBgStyle:   { fill: '#0f172a', fillOpacity: 0.9 },
          labelBgPadding: [6, 4] as [number, number],
          labelBgBorderRadius: 4,
          style: {
            stroke:      rule.isDefault ? '#6366f1' : '#38bdf8',
            strokeWidth: 2,
          },
          animated: true,
          type:     'smoothstep',
        }));

      const laid = buildGraphLayout(rawNodes, rawEdges, wf.startStepId);
      setNodes(laid.nodes);
      setEdges(laid.edges);

    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to load workflow graph.');
    } finally {
      setLoading(false);
    }
  }, [workflowId, setNodes, setEdges]);

  useEffect(() => { fetchWorkflow(); }, [fetchWorkflow]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await api.post('/steps', {
        workflowId,
        name: newStepName,
        stepType: newStepType,
        order: steps.length + 1
      });
      setNewStepName('');
      addStepModal.onClose();
      await fetchWorkflow();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add step');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStepId) return;
    try {
      setIsSubmitting(true);
      await api.post('/rules', {
        stepId: selectedStepId,
        condition: ruleIsDefault ? 'DEFAULT' : ruleCondition,
        priority: Number(rulePriority),
        nextStepId: ruleNextStep || null,
        isDefault: ruleIsDefault
      });
      setRuleCondition('');
      setRulePriority(rules.filter(r => r.stepId === selectedStepId).length + 1);
      setRuleIsDefault(false);
      setRuleNextStep('');
      await fetchWorkflow();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const selectedStep = useMemo(() => steps.find(s => s.id === selectedStepId), [steps, selectedStepId]);
  const stepRules = useMemo(() => rules.filter(r => r.stepId === selectedStepId), [rules, selectedStepId]);

  const openEditModal = (step: Step) => {
    setEditStepName(step.name);
    setEditStepType(step.stepType);
    editStepModal.onOpen();
  };

  const handleUpdateStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStepId) return;
    try {
      setIsSubmitting(true);
      await api.patch(`/steps/${selectedStepId}`, {
        name: editStepName,
        stepType: editStepType,
      });
      editStepModal.onClose();
      await fetchWorkflow();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update step');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStep = async (step: Step) => {
    const ok = confirm(
      `Delete step "${step.name}"?\n\nThis will remove routing rules on this step. Any rules pointing to this step will end the workflow.`,
    );
    if (!ok) return;
    try {
      setIsSubmitting(true);
      await api.delete(`/steps/${step.id}`);
      setSelectedStepId(null);
      await fetchWorkflow();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete step');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading && !workflow) {
    return (
      <Flex align="center" justify="center" h="70vh" gap={3} color="gray.400">
        <Spinner size="md" />
        <Text>Building workflow graph…</Text>
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
    <Flex direction="column" h="calc(100vh - 8rem)">

      {/* ── Header ── */}
      <Flex align="center" justify="space-between" mb={4}>
        <HStack spacing={4}>
          <IconButton
            aria-label="Go back"
            icon={<Icon as={ArrowLeft} w={5} h={5} />}
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          />
          <Box>
            <Heading size="lg">{workflow?.name}</Heading>
            <Text fontSize="sm" color="gray.500">
              v{workflow?.version} &nbsp;·&nbsp; {steps.length} steps &nbsp;·&nbsp; {rules.length} rules
            </Text>
          </Box>
        </HStack>
        <Button
          leftIcon={<Icon as={Plus} w={4} h={4} />}
          colorScheme="purple"
          size="sm"
          onClick={addStepModal.onOpen}
        >
          Add Step
        </Button>
      </Flex>

      {/* ── Main Layout ── */}
      <Flex flex={1} gap={4} overflow="hidden">
        
        {/* Graph Canvas */}
        <Box flex={1} rounded="xl" border="1px" borderColor="gray.600" overflow="hidden" bg="gray.900" position="relative">
          <HStack
            position="absolute" top={4} left={4} zIndex={10}
            bg="gray.800" p={2} rounded="lg" border="1px" borderColor="gray.700"
            shadow="lg" spacing={4}
          >
            <Text fontSize="xs" color="gray.400" textTransform="uppercase" letterSpacing="widest" fontWeight="semibold" ml={2}>Legend</Text>
            {[
              { label: 'Task',         color: '#6366f1' },
              { label: 'Approval',     color: '#f59e0b' },
              { label: 'Notification', color: '#10b981' },
            ].map(({ label, color }) => (
              <HStack key={label} spacing={1.5}>
                <Box w="10px" h="10px" rounded="full" bg={color} />
                <Text fontSize="xs">{label}</Text>
              </HStack>
            ))}
          </HStack>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, node) => setSelectedStepId(node.id)}
            onPaneClick={() => setSelectedStepId(null)}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.2}
            maxZoom={2.5}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#94a3b8" />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(n) => {
                const t = (n.data as any)?.stepType;
                if (t === 'TASK') return '#6366f1';
                if (t === 'APPROVAL') return '#f59e0b';
                if (t === 'NOTIFICATION') return '#10b981';
                return '#64748b';
              }}
              maskColor="rgba(0,0,0,0.55)"
            />
          </ReactFlow>
        </Box>

        {/* Sidebar: Steps list + details */}
        <Box w="384px" rounded="xl" border="1px" borderColor="gray.700" bg="gray.800" display="flex" flexDirection="column" overflow="hidden" shadow="2xl">
          <Flex p={4} borderBottom="1px" borderColor="gray.700" align="center" justify="space-between" bg="gray.700">
            <Heading size="sm">Steps</Heading>
            {selectedStep && (
              <IconButton
                aria-label="Close"
                icon={<Icon as={X} w={5} h={5} />}
                variant="ghost"
                size="xs"
                onClick={() => setSelectedStepId(null)}
              />
            )}
          </Flex>

          <Box p={3} borderBottom="1px" borderColor="gray.700">
            <VStack spacing={2} maxH="192px" overflowY="auto" align="stretch">
              {steps
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((s) => (
                  <Flex
                    key={s.id}
                    align="center"
                    justify="space-between"
                    gap={2}
                    rounded="lg"
                    border="1px"
                    borderColor={selectedStepId === s.id ? 'purple.400' : 'gray.600'}
                    bg={selectedStepId === s.id ? 'purple.900' : 'gray.800'}
                    px={3}
                    py={2}
                    transition="all 0.15s"
                    cursor="pointer"
                    onClick={() => setSelectedStepId(s.id)}
                    _hover={{ bg: selectedStepId === s.id ? 'purple.900' : 'gray.700' }}
                  >
                    <Box flex={1} minW={0}>
                      <Text fontSize="sm" fontWeight="semibold" isTruncated>{s.order}. {s.name}</Text>
                      <Text fontSize="2xs" textTransform="uppercase" letterSpacing="wider" fontWeight="bold" color="gray.400">{s.stepType}</Text>
                    </Box>
                    <HStack spacing={1}>
                      <IconButton
                        aria-label="Edit step"
                        icon={<Icon as={Pencil} w={4} h={4} />}
                        variant="ghost"
                        size="xs"
                        colorScheme="purple"
                        onClick={(e) => { e.stopPropagation(); setSelectedStepId(s.id); openEditModal(s); }}
                      />
                      <IconButton
                        aria-label="Delete step"
                        icon={<Icon as={Trash2} w={4} h={4} />}
                        variant="ghost"
                        size="xs"
                        colorScheme="red"
                        onClick={(e) => { e.stopPropagation(); handleDeleteStep(s); }}
                        isDisabled={isSubmitting}
                      />
                    </HStack>
                  </Flex>
                ))}
              {steps.length === 0 && (
                <Text fontSize="sm" color="gray.500" fontStyle="italic" px={2} py={3}>No steps yet.</Text>
              )}
            </VStack>
          </Box>

          {/* Step Details & Adding Rules */}
          {selectedStep ? (
            <Box p={4} overflowY="auto" flex={1}>
              <VStack spacing={6} align="stretch">
                {/* Step Info */}
                <Flex align="start" justify="space-between" gap={3}>
                  <Box>
                    <Text fontSize="xs" color="gray.400" textTransform="uppercase" letterSpacing="wider" fontWeight="semibold" mb={1}>Selected Step</Text>
                    <Text fontSize="lg" fontWeight="medium">{selectedStep.name}</Text>
                    <Badge mt={1} colorScheme="purple" rounded="full">{selectedStep.stepType}</Badge>
                  </Box>
                  <HStack spacing={2}>
                    <Button size="xs" variant="outline" leftIcon={<Icon as={Pencil} w={3} h={3} />} onClick={() => openEditModal(selectedStep)}>Edit</Button>
                    <Button size="xs" colorScheme="red" variant="outline" leftIcon={<Icon as={Trash2} w={3} h={3} />} onClick={() => handleDeleteStep(selectedStep)} isDisabled={isSubmitting}>Delete</Button>
                  </HStack>
                </Flex>

                {/* Existing Rules */}
                <Box>
                  <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" fontWeight="semibold" mb={3}>Routing Rules</Text>
                  {stepRules.length === 0 ? (
                    <Text fontSize="sm" color="gray.500" fontStyle="italic">No rules defined.</Text>
                  ) : (
                    <VStack spacing={2} align="stretch">
                      {stepRules.map(r => (
                        <Box key={r.id} p={3} rounded="lg" bg="gray.900" border="1px" borderColor="gray.700">
                          <Flex justify="space-between" align="start" mb={2}>
                            <Badge colorScheme={r.isDefault ? 'purple' : 'blue'} fontSize="2xs">
                              {r.isDefault ? 'Default' : `Pri: ${r.priority}`}
                            </Badge>
                          </Flex>
                          <Text fontSize="sm" fontFamily="mono" color="gray.300" mb={2} wordBreak="break-all">{r.isDefault ? 'DEFAULT' : r.condition}</Text>
                          <Text fontSize="xs" color="gray.400">
                            → {steps.find(s => s.id === r.nextStepId)?.name || 'End Workflow'}
                          </Text>
                        </Box>
                      ))}
                    </VStack>
                  )}
                </Box>

                {/* Add Rule Form */}
                <Box pt={4} borderTop="1px" borderColor="gray.700">
                  <Heading size="sm" mb={4}>Add New Rule</Heading>
                  <form onSubmit={handleAddRule}>
                    <VStack spacing={4} align="stretch">
                      <Checkbox
                        colorScheme="purple"
                        isChecked={ruleIsDefault}
                        onChange={e => setRuleIsDefault(e.target.checked)}
                      >
                        <Text fontSize="sm">Make this the Default Rule</Text>
                      </Checkbox>

                      {!ruleIsDefault && (
                        <FormControl>
                          <FormLabel fontSize="xs" color="gray.400">Condition (JEXL)</FormLabel>
                          <Input
                            required
                            value={ruleCondition}
                            onChange={e => setRuleCondition(e.target.value)}
                            placeholder='e.g., amount > 100 && priority == "High"'
                            fontFamily="mono"
                            fontSize="sm"
                            bg="gray.900"
                          />
                        </FormControl>
                      )}

                      <Flex gap={3}>
                        {!ruleIsDefault && (
                          <FormControl flex={1}>
                            <FormLabel fontSize="xs" color="gray.400">Priority</FormLabel>
                            <Input
                              required
                              type="number"
                              min={1}
                              value={rulePriority}
                              onChange={e => setRulePriority(Number(e.target.value))}
                              fontSize="sm"
                              bg="gray.900"
                            />
                          </FormControl>
                        )}
                        <FormControl flex={ruleIsDefault ? 1 : 1}>
                          <FormLabel fontSize="xs" color="gray.400">Next Step</FormLabel>
                          <Select
                            required
                            value={ruleNextStep}
                            onChange={e => setRuleNextStep(e.target.value)}
                            fontSize="sm"
                            bg="gray.900"
                          >
                            <option value="">-- End Workflow --</option>
                            {steps.filter(s => s.id !== selectedStepId).map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </Select>
                        </FormControl>
                      </Flex>

                      <Button
                        type="submit"
                        colorScheme="purple"
                        isDisabled={isSubmitting}
                        leftIcon={isSubmitting ? <Spinner size="xs" /> : <Icon as={Plus} w={4} h={4} />}
                        w="full"
                      >
                        Save Rule
                      </Button>
                    </VStack>
                  </form>
                </Box>
              </VStack>
            </Box>
          ) : (
            <Box p={6}>
              <Text fontSize="sm" color="gray.500" fontStyle="italic">
                Select a step to view details and add rules.
              </Text>
            </Box>
          )}
        </Box>
      </Flex>

      {/* ── Add Step Modal ── */}
      <Modal isOpen={addStepModal.isOpen} onClose={addStepModal.onClose} isCentered>
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent bg="gray.800" borderColor="gray.700" border="1px" rounded="2xl">
          <ModalHeader>Add New Step</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <form onSubmit={handleAddStep}>
              <VStack spacing={5}>
                <FormControl>
                  <FormLabel fontSize="sm">Step Name</FormLabel>
                  <Input
                    autoFocus
                    required
                    value={newStepName}
                    onChange={e => setNewStepName(e.target.value)}
                    placeholder="e.g., Manager Approval"
                    bg="gray.900"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Step Type</FormLabel>
                  <HStack spacing={3}>
                    {(['APPROVAL', 'TASK', 'NOTIFICATION'] as const).map(type => (
                      <Button
                        key={type}
                        type="button"
                        size="sm"
                        flex={1}
                        variant={newStepType === type ? 'solid' : 'outline'}
                        colorScheme={newStepType === type ? 'purple' : 'gray'}
                        onClick={() => setNewStepType(type)}
                        fontSize="xs"
                        fontWeight="bold"
                        letterSpacing="wider"
                      >
                        {type}
                      </Button>
                    ))}
                  </HStack>
                </FormControl>
                <Button
                  type="submit"
                  colorScheme="purple"
                  w="full"
                  isDisabled={isSubmitting}
                >
                  {isSubmitting ? <Spinner size="sm" /> : 'Create Step'}
                </Button>
              </VStack>
            </form>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* ── Edit Step Modal ── */}
      <Modal isOpen={editStepModal.isOpen} onClose={editStepModal.onClose} isCentered>
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent bg="gray.800" borderColor="gray.700" border="1px" rounded="2xl">
          <ModalHeader>Edit Step</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <form onSubmit={handleUpdateStep}>
              <VStack spacing={5}>
                <FormControl>
                  <FormLabel fontSize="sm">Step Name</FormLabel>
                  <Input
                    autoFocus
                    required
                    value={editStepName}
                    onChange={(e) => setEditStepName(e.target.value)}
                    bg="gray.900"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Step Type</FormLabel>
                  <HStack spacing={3}>
                    {(['APPROVAL', 'TASK', 'NOTIFICATION'] as const).map((type) => (
                      <Button
                        key={type}
                        type="button"
                        size="sm"
                        flex={1}
                        variant={editStepType === type ? 'solid' : 'outline'}
                        colorScheme={editStepType === type ? 'purple' : 'gray'}
                        onClick={() => setEditStepType(type)}
                        fontSize="xs"
                        fontWeight="bold"
                        letterSpacing="wider"
                      >
                        {type}
                      </Button>
                    ))}
                  </HStack>
                </FormControl>
                <HStack w="full" spacing={3}>
                  <Button flex={1} variant="outline" onClick={editStepModal.onClose}>Cancel</Button>
                  <Button flex={1} type="submit" colorScheme="purple" isDisabled={isSubmitting}>
                    {isSubmitting ? <Spinner size="sm" /> : 'Save'}
                  </Button>
                </HStack>
              </VStack>
            </form>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Flex>
  );
}
