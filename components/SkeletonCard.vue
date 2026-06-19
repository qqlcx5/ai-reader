<template>
  <div class="flex flex-col bg-[var(--background-primary)] border border-[var(--background-modifier-border)] rounded-[var(--radius-m)] [corner-shape:var(--corner-shape)] overflow-hidden h-full min-h-0 animate-pulse">
    <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--background-modifier-border)] shrink-0">
      <div class="flex items-center gap-2">
        <div class="w-3.5 h-3.5 bg-[var(--background-secondary)] rounded-full"></div>
        <div class="h-3 w-16 bg-[var(--background-secondary)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)]"></div>
        <div class="h-2.5 w-20 bg-[var(--background-secondary)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)]"></div>
      </div>
      <div class="h-3 w-12 bg-[var(--background-secondary)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)]"></div>
    </div>
    <div class="p-3 space-y-2 flex-1 min-h-0">
      <div class="h-2.5 bg-[var(--background-secondary)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] w-full"></div>
      <div class="h-2.5 bg-[var(--background-secondary)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] w-5/6"></div>
      <div class="h-2.5 bg-[var(--background-secondary)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] w-4/6"></div>
      <div class="h-2.5 bg-[var(--background-secondary)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] w-full"></div>
      <div class="h-2.5 bg-[var(--background-secondary)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] w-3/4"></div>
    </div>
    <div class="px-3 py-1.5 border-t border-[var(--background-modifier-border-subtle)] shrink-0">
      <div class="flex items-center gap-3">
        <div class="h-2.5 w-12 bg-[var(--background-secondary)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)]"></div>
        <div class="h-2.5 w-20 bg-[var(--background-secondary)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)]"></div>
      </div>
    </div>
  </div>
</template>
