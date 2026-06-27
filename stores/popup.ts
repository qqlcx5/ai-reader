import { defineStore } from 'pinia'

export type PopupView = 'capture' | 'library' | 'reader' | 'chat' | 'settings' | 'export'

export const usePopupStore = defineStore('popup', {
  state: () => ({
    activeView: 'capture' as PopupView,
    previousView: 'capture' as PopupView,
  }),
  actions: {
    setView(view: PopupView) {
      this.previousView = this.activeView
      this.activeView = view
    },
    goBack() {
      this.activeView = this.previousView
    },
  },
  persist: false,
})
