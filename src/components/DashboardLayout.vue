<template>
  <div class="dashboard-layout" :style="gridStyle">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  cols?: number
  rows?: number
  gap?: number
}>(), {
  cols: 2,
  rows: 2,
  gap: 12
})

const gridStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${props.cols}, 1fr)`,
  gridTemplateRows: `repeat(${props.rows}, 1fr)`,
  gap: `${props.gap}px`,
  height: '100%',
}))
</script>
