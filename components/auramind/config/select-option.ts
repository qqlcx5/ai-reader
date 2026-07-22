/** Shared option shape used by all analysis config tabs. Built once in the
 *  parent and passed down, so the 4 children don't each recompute from the
 *  model/prompt stores. */
export interface SelectOption {
  value: string
  label: string
}
