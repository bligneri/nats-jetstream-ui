<script setup lang="ts">
defineProps<{
  label: string;
  id: string;
  modelValue: string;
}>();
const emit = defineEmits(['update:modelValue']);

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
}
</script>
<template>
  <div class="w-full">
    <label :for="id" class="block text-sm font-medium leading-6 text-slate-300">
      {{ label }}
    </label>
    <div class="mt-2">
      <input
        :id="id"
        :value="modelValue"
        @input="onInput"
        v-bind="$attrs"
        class="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 transition focus:ring-2 focus:ring-inset focus:ring-green-500 sm:text-sm sm:leading-6"
      />
    </div>
  </div>
</template>