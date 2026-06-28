<script lang="ts" setup>
// Thin re-export of reka-ui Select sub-components.
// Only for legacy components that need inline SelectItem with custom styling.
// New code should use Select.vue with the options prop.
export {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectPortal,
  SelectIcon,
  SelectViewport,
} from 'reka-ui'
</script>
