// Vue SFC module declarations — allows TypeScript to import .vue files.
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
