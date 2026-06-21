// M5 - Advanced Workflows public surface.
//
// Canonical location: lib/workflow/. Lives outside modules/ to avoid
// WXT auto-discovery of modules entries as user modules (jiti does not
// resolve tsconfig path aliases).
export type {
  WorkflowType,
  WorkflowNodeSpec,
  WorkflowRuntimeNode,
  WorkflowNodeStatus,
  WorkflowSession,
  WorkflowSessionStatus,
  WorkflowTemplate,
  WorkflowCallbacks,
  RunWorkflowOptions,
  RunWorkflowResult,
} from './types';
export { runRoundtable } from './roundtable';
export type { RunRoundtableOptions } from './roundtable';
export { runRelayChain } from './relay';
export type { RunRelayChainOptions } from './relay';
export { topologicalSort, hasCycle, CycleDetectedError } from './topological-sort';
export {
  BUILTIN_TEMPLATE_DEFS,
  TemplateValidationError,
  validateTemplate,
  assertValidForRun,
} from './templates';
