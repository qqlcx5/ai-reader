import { toast as sonner } from 'vue-sonner'
import 'vue-sonner/style.css'

type ToastOptions = { category?: 'clip' | 'ai' | 'sync' | 'rss' | 'system' }

export const toast = {
  success: (message: string, _options?: ToastOptions) => sonner.success(message, { duration: 3000 }),
  error: (message: string, _options?: ToastOptions) => sonner.error(message, { duration: 5000 }),
  warning: (message: string, _options?: ToastOptions) => sonner.warning(message, { duration: 4000 }),
  info: (message: string, _options?: ToastOptions) => sonner(message, { duration: 3000 }),
  loading: (message: string, _options?: ToastOptions) => sonner.loading(message, { duration: Infinity }),
  dismiss: (id?: string | number) => sonner.dismiss(id),
}
