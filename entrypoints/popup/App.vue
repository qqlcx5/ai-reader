<script lang="ts" setup>
import { ref } from 'vue';
import {
  SwitchRoot,
  SwitchThumb,
  TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
  SliderRoot,
  SliderTrack,
  SliderRange,
  SliderThumb,
  DialogRoot,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
  CheckboxRoot,
  CheckboxIndicator,
  AccordionRoot,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  ToggleGroupRoot,
  ToggleGroupItem,
  ProgressRoot,
  Separator,
} from 'reka-ui';

const count = ref(0);
const darkMode = ref(true);
const sliderVal = ref([50]);
const checked = ref(true);
const toggleVal = ref('center');
const progress = ref(65);

let progressTimer: ReturnType<typeof setInterval>;
function animateProgress() {
  progress.value = 0;
  clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    if (progress.value >= 100) {
      clearInterval(progressTimer);
    } else {
      progress.value += 2;
    }
  }, 40);
}
</script>

<template>
  <TooltipProvider :delay-duration="200">
    <div class="w-400px max-h-600px overflow-y-auto flex flex-col items-center gap-8 p-6 bg-zinc-900 text-white/90">
      <!-- Header -->
      <div class="flex items-center gap-4">
        <img src="/wxt.svg" class="h-12 hover:drop-shadow-green transition-all duration-300 cursor-pointer" alt="WXT" />
        <span class="text-2xl font-bold text-white/50">+</span>
        <img src="@/assets/vue.svg" class="h-12 hover:drop-shadow-green transition-all duration-300 cursor-pointer" alt="Vue" />
        <span class="text-2xl font-bold text-white/50">+</span>
        <div class="px-3 py-1 rounded-full bg-violet-500/20 text-violet-400 text-sm font-semibold border border-violet-500/30">
          UnoCSS
        </div>
      </div>

      <!-- Gradient Title -->
      <h1 class="text-3xl font-extrabold bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent tracking-tight">
        Reka UI + UnoCSS
      </h1>

      <!-- Counter -->
      <div class="flex items-center gap-4">
        <button
          class="px-5 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-medium hover:bg-emerald-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          @click="count++"
        >
          count is {{ count }}
        </button>
        <span class="text-sm text-white/40">UnoCSS utilities</span>
      </div>

      <Separator class="w-full h-px bg-white/10" />

      <!-- ========== Reka UI Components Demo ========== -->

      <div class="w-full flex flex-col gap-6">

        <!-- Switch + Checkbox Row -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <SwitchRoot
              v-model:checked="darkMode"
              class="relative w-11 h-6 rounded-full bg-white/15 data-[state=checked]:bg-emerald-500 transition-colors"
            >
              <SwitchThumb
                class="block absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-md transform transition-transform data-[state=checked]:translate-x-5"
              />
            </SwitchRoot>
            <span class="text-sm text-white/70">Dark Mode</span>
          </div>

          <TooltipRoot>
            <TooltipTrigger as-child>
              <div class="flex items-center gap-2">
                <CheckboxRoot
                  v-model:checked="checked"
                  class="w-5 h-5 rounded-md border border-white/30 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500 transition-colors flex items-center justify-center"
                >
                  <CheckboxIndicator class="text-white text-xs">
                    ✓
                  </CheckboxIndicator>
                </CheckboxRoot>
                <span class="text-sm text-white/70">Subscribe</span>
              </div>
            </TooltipTrigger>
            <TooltipContent
              class="bg-white/10 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg border border-white/10 shadow-lg"
              :side-offset="6"
            >
              Get notified about updates
            </TooltipContent>
          </TooltipRoot>
        </div>

        <!-- Slider -->
        <div class="flex flex-col gap-2">
          <div class="flex justify-between text-sm">
            <span class="text-white/60">Volume</span>
            <span class="text-cyan-400 font-mono">{{ sliderVal[0] }}%</span>
          </div>
          <SliderRoot
            v-model="sliderVal"
            :max="100"
            :step="1"
            class="relative flex items-center select-none touch-none h-5 w-full"
          >
            <SliderTrack class="relative grow h-1.5 rounded-full bg-white/10">
              <SliderRange class="absolute h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400" />
            </SliderTrack>
            <SliderThumb
              class="block w-4 h-4 bg-white rounded-full shadow-lg hover:scale-125 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-transform"
            />
          </SliderRoot>
        </div>

        <!-- Progress -->
        <div class="flex flex-col gap-2">
          <div class="flex justify-between text-sm">
            <span class="text-white/60">Progress</span>
            <span class="text-emerald-400 font-mono">{{ progress }}%</span>
          </div>
          <ProgressRoot
            :model-value="progress"
            class="relative overflow-hidden h-3 rounded-full bg-white/10"
          >
            <div
              class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-200"
              :style="{ width: `${progress}%` }"
            />
          </ProgressRoot>
          <button
            class="self-start px-3 py-1 text-xs rounded-md bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80 transition-all cursor-pointer"
            @click="animateProgress"
          >
            Replay
          </button>
        </div>

        <!-- Toggle Group -->
        <div class="flex flex-col gap-2">
          <span class="text-sm text-white/60">Alignment</span>
          <ToggleGroupRoot
            v-model="toggleVal"
            type="single"
            class="inline-flex rounded-lg bg-white/5 border border-white/10 overflow-hidden"
          >
            <ToggleGroupItem
              value="left"
              class="px-4 py-2 text-sm text-white/50 hover:bg-white/10 data-[state=on]:bg-violet-500/30 data-[state=on]:text-violet-400 transition-colors"
            >
              Left
            </ToggleGroupItem>
            <ToggleGroupItem
              value="center"
              class="px-4 py-2 text-sm text-white/50 hover:bg-white/10 data-[state=on]:bg-violet-500/30 data-[state=on]:text-violet-400 transition-colors border-x border-white/10"
            >
              Center
            </ToggleGroupItem>
            <ToggleGroupItem
              value="right"
              class="px-4 py-2 text-sm text-white/50 hover:bg-white/10 data-[state=on]:bg-violet-500/30 data-[state=on]:text-violet-400 transition-colors"
            >
              Right
            </ToggleGroupItem>
          </ToggleGroupRoot>
        </div>

        <!-- Tabs -->
        <TabsRoot default-value="code" class="w-full">
          <TabsList class="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
            <TabsTrigger
              value="code"
              class="flex-1 px-4 py-2 text-sm rounded-md text-white/50 data-[state=active]:bg-white/10 data-[state=active]:text-white font-medium transition-all"
            >
              Code
            </TabsTrigger>
            <TabsTrigger
              value="preview"
              class="flex-1 px-4 py-2 text-sm rounded-md text-white/50 data-[state=active]:bg-white/10 data-[state=active]:text-white font-medium transition-all"
            >
              Preview
            </TabsTrigger>
            <TabsTrigger
              value="output"
              class="flex-1 px-4 py-2 text-sm rounded-md text-white/50 data-[state=active]:bg-white/10 data-[state=active]:text-white font-medium transition-all"
            >
              Output
            </TabsTrigger>
          </TabsList>

          <TabsContent value="code" class="mt-3">
            <pre class="p-4 rounded-lg bg-zinc-800 border border-white/5 text-sm font-mono text-emerald-400 overflow-x-auto"><code>import { ref } from 'vue'
const msg = ref('Hello UnoCSS!')</code></pre>
          </TabsContent>

          <TabsContent value="preview" class="mt-3">
            <div class="p-4 rounded-lg bg-zinc-800 border border-white/5 text-sm text-white/70">
              <p class="text-emerald-400 font-medium">Hello UnoCSS!</p>
              <p class="mt-2 text-white/40">Live preview renders here...</p>
            </div>
          </TabsContent>

          <TabsContent value="output" class="mt-3">
            <div class="p-4 rounded-lg bg-zinc-800 border border-white/5 text-sm text-white/70 font-mono">
              <p class="text-cyan-400">Build: <span class="text-white/60">success</span></p>
              <p class="text-cyan-400">Time: <span class="text-white/60">42ms</span></p>
              <p class="text-cyan-400">Size: <span class="text-white/60">1.2kB</span></p>
            </div>
          </TabsContent>
        </TabsRoot>

        <!-- Accordion -->
        <AccordionRoot type="single" collapsible class="w-full rounded-lg border border-white/10 overflow-hidden">
          <AccordionItem value="item-1" class="border-b border-white/10">
            <AccordionTrigger class="w-full px-4 py-3 flex items-center justify-between text-sm text-white/70 hover:bg-white/5 transition-colors">
              What is UnoCSS?
            </AccordionTrigger>
            <AccordionContent class="px-4 pb-3 text-sm text-white/50 leading-relaxed">
              UnoCSS is an instant atomic CSS engine. Flexible and extensible, everything via presets.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2" class="border-b border-white/10">
            <AccordionTrigger class="w-full px-4 py-3 flex items-center justify-between text-sm text-white/70 hover:bg-white/5 transition-colors">
              Why Reka UI?
            </AccordionTrigger>
            <AccordionContent class="px-4 pb-3 text-sm text-white/50 leading-relaxed">
              Unstyled accessible primitives. Pair with UnoCSS for full styling control.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger class="w-full px-4 py-3 flex items-center justify-between text-sm text-white/70 hover:bg-white/5 transition-colors">
              How does WXT integrate?
            </AccordionTrigger>
            <AccordionContent class="px-4 pb-3 text-sm text-white/50 leading-relaxed">
              WXT's <code class="px-1.5 py-0.5 rounded bg-white/10 text-cyan-400/80">@wxt-dev/unocss</code> module auto-configures UnoCSS.
            </AccordionContent>
          </AccordionItem>
        </AccordionRoot>

        <!-- Dialog -->
        <DialogRoot>
          <DialogTrigger
            class="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-500/20 to-cyan-500/20 text-violet-300 border border-violet-500/30 font-medium hover:from-violet-500/30 hover:to-cyan-500/30 transition-all cursor-pointer"
          >
            Open Demo Dialog
          </DialogTrigger>
          <DialogContent
            class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-90 p-6 rounded-2xl bg-zinc-800 border border-white/10 shadow-2xl shadow-black/50"
          >
            <DialogTitle class="text-lg font-bold text-white">Confirm Action</DialogTitle>
            <DialogDescription class="mt-2 text-sm text-white/50">
              This is a demo dialog styled with UnoCSS and powered by Reka UI. It handles focus trapping and keyboard events automatically.
            </DialogDescription>
            <div class="flex justify-end gap-3 mt-6">
              <DialogClose
                class="px-4 py-2 text-sm rounded-lg text-white/60 hover:bg-white/10 transition-colors cursor-pointer"
              >
                Cancel
              </DialogClose>
              <DialogClose
                class="px-4 py-2 text-sm rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors cursor-pointer"
              >
                Confirm
              </DialogClose>
            </div>
          </DialogContent>
        </DialogRoot>
      </div>

      <!-- Footer -->
      <p class="text-xs text-white/20">
        Edit <code class="px-1.5 py-0.5 rounded bg-white/5 text-white/30">App.vue</code> to test HMR
      </p>
    </div>
  </TooltipProvider>
</template>
