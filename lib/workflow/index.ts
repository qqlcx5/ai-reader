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

// Variable resolver
export {
  extractVariableNames,
  validateTemplateVars,
  resolveVariables,
} from './variable-resolver';
export type { PageContext, ResolveOptions } from './variable-resolver';

// Filters
export { FILTERS, FILTER_NAMES } from './filters';
export type { FilterFn } from './filters';

// Filter pipeline
export {
  parseFilterToken,
  parseFilters,
  applyFilterChain,
  runFilterPipeline,
  FilterError,
} from './filter-pipeline';
export type { ParsedFilter } from './filter-pipeline';

// Template manager (prompt templates)
export {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listTemplates,
  getTemplate,
  matchTemplate,
  matchTemplateBySchema,
  exportTemplates,
  downloadTemplatesJson,
  importTemplates,
  syncTemplatesToStorage,
  loadTemplatesFromStorage,
  seedDefaultTemplates,
} from './template-manager';
