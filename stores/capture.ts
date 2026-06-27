import { defineStore } from 'pinia';
import type { CaptureStep, AppErrorCode, ExtractResult } from '../shared/domain';

export const useCaptureStore = defineStore('capture', {
  state: () => ({
    step: 'idle' as CaptureStep,
    errorCode: null as AppErrorCode | null,
    extractResult: null as ExtractResult | null,
    markdown: '',
    progress: 0, // 0-100
  }),
  getters: {
    isIdle: (state) => state.step === 'idle',
    isProcessing: (state) =>
      state.step === 'extracting' || state.step === 'markdown' || state.step === 'saving',
    isSuccess: (state) => state.step === 'success',
    isError: (state) => state.step === 'error',
  },
  actions: {
    setStep(step: CaptureStep) {
      this.step = step;
    },
    setError(code: AppErrorCode) {
      this.step = 'error';
      this.errorCode = code;
    },
    setExtractResult(result: ExtractResult) {
      this.extractResult = result;
    },
    setMarkdown(md: string) {
      this.markdown = md;
    },
    setProgress(p: number) {
      this.progress = p;
    },
    reset() {
      this.step = 'idle';
      this.errorCode = null;
      this.extractResult = null;
      this.markdown = '';
      this.progress = 0;
    },
  },
  persist: false,
});
