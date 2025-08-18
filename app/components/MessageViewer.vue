<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { NatsMessage } from '~/types';
import UiInput from './ui/Input.vue';
import UiButton from './ui/Button.vue';
import SpinnerIcon from './icons/SpinnerIcon.vue';
import ChevronDownIcon from './icons/ChevronDownIcon.vue';
import ChevronRightIcon from './icons/ChevronRightIcon.vue';

const props = defineProps<{
  subjects: string[];
}>();

const subject = ref(props.subjects[0]?.replace('>', '*').replace('.*', '.*') || '');
const messages = ref<NatsMessage[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

async function fetchMessages() {
  if (!subject.value) return;
  isLoading.value = true;
  error.value = null;
  try {
    const data = await $fetch<NatsMessage[]>('/api/messages', {
      query: { subject: subject.value },
    });
    messages.value = data;
  } catch (e: any) {
    error.value = e.data?.statusMessage || 'Failed to fetch messages';
  } finally {
    isLoading.value = false;
  }
}

watch(subject, fetchMessages, { immediate: true });

const MessageItem = {
  props: {
    message: {
      type: Object as () => NatsMessage,
      required: true,
    },
  },
  setup(props: { message: NatsMessage }) {
    const isOpen = ref(false);
    
    const decodedData = computed(() => {
        try {
            return atob(props.message.data);
        } catch (e) {
            return "Error decoding Base64 data";
        }
    });

    const isJsonString = (str: string) => {
        try { JSON.parse(str); } catch (e) { return false; }
        return true;
    };
    
    const formattedData = computed(() => {
        if (isJsonString(decodedData.value)) {
            return JSON.stringify(JSON.parse(decodedData.value), null, 2);
        }
        return decodedData.value;
    });

    return { isOpen, formattedData };
  },
  template: `
    <div class="rounded-md bg-slate-700/50">
      <button @click="isOpen = !isOpen" class="flex w-full items-center justify-between p-3 text-left">
        <div class="flex items-center space-x-4">
          <ChevronDownIcon v-if="isOpen" class="h-5 w-5" />
          <ChevronRightIcon v-else class="h-5 w-5" />
          <span class="font-mono text-sm text-green-300">Seq: {{ message.seq }}</span>
          <span class="truncate font-mono text-sm text-slate-300">{{ message.subject }}</span>
        </div>
        <span class="text-xs text-slate-400">{{ new Date(message.time).toLocaleString() }}</span>
      </button>
      <div v-if="isOpen" class="border-t border-slate-600 p-3">
        <div class="space-y-3">
          <div>
            <h4 class="text-xs font-semibold uppercase text-slate-400">Data</h4>
            <pre class="overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-300"><code>{{ formattedData }}</code></pre>
          </div>
          <div v-if="message.headers">
            <h4 class="text-xs font-semibold uppercase text-slate-400">Headers</h4>
            <pre class="overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-300"><code>{{ JSON.stringify(message.headers, null, 2) }}</code></pre>
          </div>
        </div>
      </div>
    </div>
  `
};
</script>

<template>
  <div>
    <div class="flex items-end space-x-2">
      <UiInput
        id="subject"
        label="Subject to view"
        v-model="subject"
        placeholder="e.g., ORDERS.*"
        class="font-mono"
      />
      <UiButton @click="fetchMessages" :disabled="isLoading || !subject">
        <SpinnerIcon v-if="isLoading" class="h-5 w-5 animate-spin" />
        <span v-else>Fetch</span>
      </UiButton>
    </div>

    <p v-if="error" class="mt-2 text-sm text-red-400">{{ error }}</p>
    
    <div class="mt-4 space-y-2">
      <div v-if="isLoading" class="flex justify-center p-8">
        <SpinnerIcon class="h-8 w-8 animate-spin text-green-400" />
      </div>
      <template v-else-if="messages.length > 0">
        <MessageItem v-for="msg in messages" :key="msg.seq" :message="msg" />
      </template>
      <p v-else class="text-center text-slate-500">No messages found for this subject.</p>
    </div>
  </div>
</template>