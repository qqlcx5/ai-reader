import { computed, ref } from 'vue'
import type { AiJobEntity, AiJobFilter } from '@/types/ai-job'
import type { Ref } from 'vue'

/** Panel-local filter + multi-select state for the analysis queue view. */
export function useAiJobPanel(jobs: Ref<AiJobEntity[]>) {
  const filter = ref<AiJobFilter>({ status: 'all' })
  const selectedIds = ref<Set<string>>(new Set())
  const selectMode = ref(false)

  const filteredJobs = computed(() => {
    let result = jobs.value
    if (filter.value.status && filter.value.status !== 'all') {
      result = result.filter((j) => j.status === filter.value.status)
    }
    if (filter.value.modelId) {
      result = result.filter((j) => j.modelId === filter.value.modelId)
    }
    if (filter.value.batchId) {
      result = result.filter((j) => j.batchId === filter.value.batchId)
    }
    if (filter.value.search) {
      const q = filter.value.search.toLowerCase()
      result = result.filter(
        (j) =>
          j.documentTitle?.toLowerCase().includes(q)
          || j.error?.toLowerCase().includes(q),
      )
    }
    return result
  })

  const hasActiveFilters = computed(
    () =>
      (!!filter.value.status && filter.value.status !== 'all')
      || !!filter.value.modelId
      || !!filter.value.search,
  )

  const selectedCount = computed(() => selectedIds.value.size)

  function setFilter(patch: Partial<AiJobFilter>) {
    filter.value = { ...filter.value, ...patch }
  }

  function resetFilter() {
    filter.value = { status: 'all' }
  }

  function toggleSelect(jobId: string) {
    const next = new Set(selectedIds.value)
    if (next.has(jobId)) next.delete(jobId)
    else next.add(jobId)
    selectedIds.value = next
  }

  function selectAll() {
    selectedIds.value = new Set(filteredJobs.value.map((j) => j.id))
  }

  function selectNone() {
    selectedIds.value = new Set()
  }

  function toggleSelectMode() {
    selectMode.value = !selectMode.value
    if (!selectMode.value) selectNone()
  }

  return {
    filter,
    filteredJobs,
    hasActiveFilters,
    selectedIds,
    selectMode,
    selectedCount,
    setFilter,
    resetFilter,
    toggleSelect,
    selectAll,
    selectNone,
    toggleSelectMode,
  }
}
