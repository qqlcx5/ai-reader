<template>
  <div class="flex flex-col bg-[var(--background-primary)] border border-[var(--background-modifier-border)]/80 card-rounded shadow-[var(--shadow-card)] overflow-hidden h-full min-h-0">
    <div class="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--background-modifier-border)]/60 shrink-0">
      <div class="flex items-center gap-2">
      <div class="w-3.5 h-3.5 bg-[var(--background-secondary)] skeleton-loading rounded-full"></div>
      <div class="h-3 w-16 skeleton-loading rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)]"></div>
      <div class="h-2.5 w-20 skeleton-loading rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)]"></div>
      </div>
      <div class="h-3 w-12 skeleton-loading rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)]"></div>
    </div>
    <div class="p-3.5 space-y-2 flex-1 min-h-0">
      <div class="h-2.5 skeleton-loading rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] w-full"></div>
      <div class="h-2.5 skeleton-loading rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] w-5/6"></div>
      <div class="h-2.5 skeleton-loading rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] w-4/6"></div>
      <div class="h-2.5 skeleton-loading rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] w-full"></div>
      <div class="h-2.5 skeleton-loading rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] w-3/4"></div>
    </div>
    <div class="px-3.5 py-2 border-t border-[var(--background-modifier-border)]/60 bg-[var(--background-canvas)] shrink-0">
      <div class="flex items-center gap-3">
        <div class="h-2.5 w-12 skeleton-loading rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)]"></div>
        <div class="h-2.5 w-20 skeleton-loading rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)]"></div>
        <div class="ml-auto h-4 w-10 skeleton-loading rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)]"></div>
      </div>
    </div>
  </div>
</template>
