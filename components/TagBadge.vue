<script setup lang="ts">
const props = defineProps<{
  tag: string
  active?: boolean
  size?: 'sm' | 'md'
}>()

const emit = defineEmits<{ click: [tag: string] }>()
</script>

<template>
  <button
    type="button"
    class="transition-all duration-150"
    :class="[
      size === 'sm' ? 'tag-pill' : 'tag-pill-lg',
      active
        ? 'bg-primary-600 text-white border-primary-600 hover:bg-primary-700 hover:border-primary-700'
        : '',
    ]"
    @click="emit('click', tag)"
  >
    {{ tag }}
  </button>
</template>
