<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import type { NatsMessage } from '~/types';
import UiInput from './ui/Input.vue';
import UiButton from './ui/Button.vue';
import SpinnerIcon from './icons/SpinnerIcon.vue';
import ChevronDownIcon from './icons/ChevronDownIcon.vue';
import ChevronRightIcon from './icons/ChevronRightIcon.vue';
import { getDecoratorForSubject, extractHighlightedFields, syntaxHighlightJson } from '~/utils/messageDecorators';
import { useDebounceFn } from '@vueuse/core';

const props = defineProps<{
  subjects: string[];
  streamName?: string;
  serverId?: number;
}>();

// Convert first subject to a wildcard pattern that will match all messages
// e.g., "commands.*" stays as "commands.*", "commands.dlq.>" becomes "commands.dlq.*"
const defaultSubject = props.subjects[0] || '';
const subject = ref(defaultSubject);
const debouncedSubject = ref(defaultSubject);
const messages = ref<NatsMessage[]>([]);
const isStreaming = ref(false);
const error = ref<string | null>(null);
const decorators = ref<any[]>([]);
const streamProgress = ref('');
const showMemoryWarning = ref(false);
const hasMoreMessages = ref(false); // Track if more messages are available
const lowestSeqSeen = ref<number | null>(null); // Track lowest sequence we've seen for pagination

// EventSource for streaming
let eventSource: EventSource | null = null;
const MESSAGES_PER_PAGE = 50;

// Load decorators on mount
onMounted(async () => {
  const { loadDecorators } = await import('~/utils/messageDecorators');
  decorators.value = await loadDecorators(props.serverId);
});

// Auto-cancel streaming when component unmounts or user navigates away
onBeforeUnmount(() => {
  cancelStream();
});

function cancelStream() {
  if (eventSource) {
    console.log('🛑 Cancelling stream');
    eventSource.close();
    eventSource = null;
    isStreaming.value = false;
    streamProgress.value = '';
  }
}

async function fetchMessages(loadMore = false) {
  if (!debouncedSubject.value) return;

  // Cancel any existing stream
  cancelStream();

  isStreaming.value = true;
  if (!loadMore) {
    messages.value = [];
    lowestSeqSeen.value = null;
  }
  error.value = null;
  streamProgress.value = 'Connecting...';
  showMemoryWarning.value = false;
  hasMoreMessages.value = false;

  try {
    const params = new URLSearchParams({
      subject: debouncedSubject.value,
      limit: MESSAGES_PER_PAGE.toString(),
    });

    if (props.streamName) {
      params.append('stream', props.streamName);
    }

    // If loading more, tell backend to search before the lowest seq we've seen
    if (loadMore && lowestSeqSeen.value !== null) {
      params.append('beforeSeq', lowestSeqSeen.value.toString());
      console.log(`🔄 Loading more before seq: ${lowestSeqSeen.value}`);
    } else {
      console.log(`🔄 Starting fresh stream for subject: ${debouncedSubject.value}`);
    }

    const url = `/api/messages-stream?${params.toString()}`;
    eventSource = new EventSource(url);

    let messagesInThisBatch = 0;

    eventSource.onopen = () => {
      console.log('✅ Stream connected');
      streamProgress.value = 'Streaming messages...';
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Check for completion or error events
        if (data.type === 'complete') {
          console.log(`✅ Stream complete: ${messagesInThisBatch} messages in this batch`);

          if (data.hasMore) {
            hasMoreMessages.value = true;
            streamProgress.value = `Loaded ${messages.value.length} messages (more available)`;
          } else {
            streamProgress.value = `Complete: ${messages.value.length} messages found`;
          }

          cancelStream();
          return;
        }

        if (data.type === 'error') {
          console.error('❌ Stream error:', data.message);
          error.value = data.message;
          cancelStream();
          return;
        }

        // Regular message data - stop accepting after MESSAGES_PER_PAGE
        if (messagesInThisBatch < MESSAGES_PER_PAGE) {
          messages.value.push(data as NatsMessage);
          messagesInThisBatch++;

          // Track lowest sequence number seen
          if (lowestSeqSeen.value === null || data.seq < lowestSeqSeen.value) {
            lowestSeqSeen.value = data.seq;
          }

          streamProgress.value = `Streaming... ${messages.value.length} messages found`;

          // If we've reached the page limit, wait for completion
          if (messagesInThisBatch === MESSAGES_PER_PAGE) {
            console.log(`📄 Reached page limit (${MESSAGES_PER_PAGE}), waiting for completion event...`);
          }
        }

        // Show memory warning if approaching large counts
        if (messages.value.length >= 3000 && !showMemoryWarning.value) {
          showMemoryWarning.value = true;
          console.warn(`⚠️ Large result set: ${messages.value.length} messages loaded`);
        }
      } catch (e) {
        console.error('❌ Error parsing SSE message:', e);
      }
    };

    eventSource.onerror = (e) => {
      console.error('❌ EventSource error:', e);
      error.value = 'Stream connection error';
      cancelStream();
    };
  } catch (e: any) {
    console.error('❌ Error starting stream:', e);
    error.value = e.message || 'Failed to start message stream';
    isStreaming.value = false;
  }
}

function loadMore() {
  // Continue from where we left off (before the lowest seq we've seen)
  fetchMessages(true);
}

// Debounced update of debouncedSubject
const updateDebouncedSubject = useDebounceFn(() => {
  debouncedSubject.value = subject.value;
}, 500); // Wait 500ms after user stops typing

// Watch subject changes and debounce
watch(subject, () => {
  updateDebouncedSubject();
});

// Auto-fetch messages when debouncedSubject changes
watch(debouncedSubject, () => {
  fetchMessages();
}, { immediate: true });

// Track which messages are expanded
const expandedMessages = ref(new Set<number>());

function toggleMessage(seq: number) {
  if (expandedMessages.value.has(seq)) {
    expandedMessages.value.delete(seq);
  } else {
    expandedMessages.value.add(seq);
  }
}

function formatMessageData(base64Data: string): string {
  try {
    const decoded = atob(base64Data);
    // Try to parse as JSON and pretty-print
    try {
      const parsed = JSON.parse(decoded);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // Not JSON, return as plain text
      return decoded;
    }
  } catch (e) {
    return "Error decoding Base64 data";
  }
}

function getMessageBorderColor(subject: string): string {
  const decorator = getDecoratorForSubject(subject, decorators.value);
  if (!decorator) return 'border-slate-600';

  const colorMap: Record<string, string> = {
    red: 'border-red-500',
    green: 'border-green-500',
    blue: 'border-blue-500',
    yellow: 'border-yellow-500',
    purple: 'border-purple-500',
  };

  return colorMap[decorator.color || ''] || 'border-slate-600';
}

function getHighlightedFieldsPreview(msg: NatsMessage): string {
  const decorator = getDecoratorForSubject(msg.subject, decorators.value);
  if (!decorator) return '';

  try {
    const decoded = atob(msg.data);
    const parsed = JSON.parse(decoded);
    const highlighted = extractHighlightedFields(parsed, decorator);

    // Show first important field in preview (e.g., "Serial: 80085420")
    const firstField = decorator.highlightFields[0];
    if (firstField && highlighted[firstField]) {
      const label = decorator.fieldLabels?.[firstField] || firstField;
      return `${label}: ${highlighted[firstField]}`;
    }
  } catch (e) {
    // Ignore errors
  }

  return '';
}

function getHighlightedFields(msg: NatsMessage): [string, any, string][] {
  const decorator = getDecoratorForSubject(msg.subject, decorators.value);
  if (!decorator) return [];

  try {
    const decoded = atob(msg.data);
    const parsed = JSON.parse(decoded);
    const highlighted = extractHighlightedFields(parsed, decorator);

    return Object.entries(highlighted).map(([key, value]) => [
      key,
      typeof value === 'object' ? JSON.stringify(value) : value,
      decorator.fieldLabels?.[key] || key,
    ]);
  } catch (e) {
    return [];
  }
}

function getColoredJson(base64Data: string): string {
  try {
    const decoded = atob(base64Data);
    const parsed = JSON.parse(decoded);
    const formatted = JSON.stringify(parsed, null, 2);
    return syntaxHighlightJson(formatted);
  } catch (e) {
    return `<pre class="text-xs text-slate-300">${base64Data}</pre>`;
  }
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // If today, show "Today"
  if (diffDays === 0) {
    return 'Today';
  }
  // If yesterday, show "Yesterday"
  if (diffDays === 1) {
    return 'Yesterday';
  }
  // If within last week, show day name
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
  // Otherwise show date
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  // If less than 60 seconds ago, show "Just now"
  if (diffSecs < 60) {
    return 'Just now';
  }
  // If less than 60 minutes ago, show relative time
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  // If less than 24 hours ago, show relative time
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  // Otherwise show time
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function filterByExactSubject(exactSubject: string) {
  // Update the subject input to the exact subject (not a pattern)
  subject.value = exactSubject;
  // Trigger a new fetch
  fetchMessages();
}

// Copy functionality
const copiedField = ref<string | null>(null);

async function copyToClipboard(text: string, fieldId: string) {
  try {
    await navigator.clipboard.writeText(text);
    copiedField.value = fieldId;
    setTimeout(() => {
      copiedField.value = null;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

function copyFullMessage(msg: NatsMessage) {
  const fullData = {
    seq: msg.seq,
    subject: msg.subject,
    time: msg.time,
    data: formatMessageData(msg.data),
    headers: msg.headers || {}
  };
  copyToClipboard(JSON.stringify(fullData, null, 2), `msg-${msg.seq}-full`);
}
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
      <UiButton v-if="isStreaming" @click="cancelStream" class="bg-red-600 hover:bg-red-700">
        Cancel
      </UiButton>
      <UiButton v-else @click="fetchMessages" :disabled="isStreaming || !subject">
        <SpinnerIcon v-if="isStreaming" class="h-5 w-5 animate-spin" />
        <span v-else>Fetch</span>
      </UiButton>
    </div>

    <p v-if="error" class="mt-2 text-sm text-red-400">{{ error }}</p>

    <!-- Streaming progress indicator -->
    <div v-if="isStreaming && streamProgress" class="mt-2 rounded-md bg-blue-900/20 border border-blue-600/30 p-3">
      <p class="text-sm text-blue-400">
        <SpinnerIcon class="inline h-4 w-4 animate-spin mr-2" />
        {{ streamProgress }}
      </p>
    </div>

    <!-- Message count badge (always visible when there are messages) -->
    <div v-if="messages.length > 0 && !isStreaming" class="mt-2 flex items-center justify-between">
      <div class="rounded-md bg-slate-700/50 border border-slate-600 px-3 py-2">
        <p class="text-sm font-medium text-slate-300">
          <span class="text-green-400">{{ messages.length }}</span> messages loaded
          <span v-if="lowestSeqSeen" class="text-slate-500 ml-2">(oldest: seq {{ lowestSeqSeen }})</span>
        </p>
      </div>
    </div>

    <!-- Memory warning -->
    <div v-if="showMemoryWarning && !error" class="mt-2 rounded-md bg-yellow-900/20 border border-yellow-600/30 p-3">
      <p class="text-sm text-yellow-400">
        <span class="font-semibold">⚠️ High memory usage:</span>
        {{ messages.length }} messages loaded. Consider using a more specific subject filter to reduce memory usage.
      </p>
    </div>

    <div class="mt-4 space-y-2">
      <div v-if="isStreaming && messages.length === 0" class="flex justify-center p-8">
        <SpinnerIcon class="h-8 w-8 animate-spin text-green-400" />
      </div>
      <template v-else-if="messages.length > 0">
        <div v-for="msg in messages" :key="msg.seq" :class="[
          'rounded-md border-l-4',
          getMessageBorderColor(msg.subject)
        ]">
          <div class="relative">
            <button @click="toggleMessage(msg.seq)" class="w-full text-left bg-slate-700/50 hover:bg-slate-700/70 transition-colors">
              <!-- Important fields shown at card level -->
              <div class="p-3 space-y-2">
                <div class="flex items-start justify-between">
                  <div class="flex items-center space-x-3">
                    <ChevronDownIcon v-if="expandedMessages.has(msg.seq)" class="h-5 w-5 text-slate-400 flex-shrink-0" />
                    <ChevronRightIcon v-else class="h-5 w-5 text-slate-400 flex-shrink-0" />
                    <!-- Important fields as main content -->
                    <div v-if="getHighlightedFields(msg).length > 0" class="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <div v-for="[key, value, label] in getHighlightedFields(msg)" :key="key" class="group flex items-baseline space-x-2">
                        <span class="text-xs font-medium text-amber-400">{{ label }}:</span>
                        <span class="font-mono text-sm text-white">{{ value }}</span>
                        <button
                          @click.stop="copyToClipboard(String(value), `${msg.seq}-${key}`)"
                          class="opacity-0 group-hover:opacity-100 ml-1 text-slate-400 hover:text-green-400 transition-opacity"
                          :title="`Copy ${label}`"
                        >
                          <span v-if="copiedField === `${msg.seq}-${key}`" class="text-xs text-green-400">✓</span>
                          <span v-else class="text-xs">📋</span>
                        </button>
                      </div>
                    </div>
                    <!-- Fallback to subject if no highlighted fields -->
                    <span v-else class="truncate font-mono text-sm text-slate-300">{{ msg.subject }}</span>
                  </div>
                  <!-- Timestamp - highly readable -->
                  <div class="flex flex-col items-end flex-shrink-0 ml-4">
                    <span class="text-sm font-medium text-slate-200">{{ formatDate(msg.time) }}</span>
                    <span class="text-xs text-slate-400">{{ formatTime(msg.time) }}</span>
                  </div>
                </div>
                <!-- Secondary info: Seq and subject with Copy Message button -->
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-4 text-xs pl-8">
                    <button
                      @click.stop="copyToClipboard(String(msg.seq), `${msg.seq}-seq`)"
                      class="group font-mono text-slate-500 hover:text-green-400 transition-colors"
                      :title="'Copy sequence number'"
                    >
                      Seq: {{ msg.seq }}
                      <span v-if="copiedField === `${msg.seq}-seq`" class="ml-1 text-green-400">✓</span>
                      <span v-else class="ml-1 opacity-0 group-hover:opacity-100">📋</span>
                    </button>
                    <button
                      @click.stop="filterByExactSubject(msg.subject)"
                      class="font-mono text-slate-400 hover:text-green-400 hover:underline transition-colors"
                      :title="`Filter by exact subject: ${msg.subject}`"
                    >
                      {{ msg.subject }}
                    </button>
                    <button
                      @click.stop="copyToClipboard(msg.time, `${msg.seq}-time`)"
                      class="group font-mono text-slate-500 hover:text-green-400 transition-colors"
                      :title="'Copy timestamp'"
                    >
                      {{ msg.time }}
                      <span v-if="copiedField === `${msg.seq}-time`" class="ml-1 text-green-400">✓</span>
                      <span v-else class="ml-1 opacity-0 group-hover:opacity-100">📋</span>
                    </button>
                  </div>
                  <!-- Copy entire message button (right side of secondary info) -->
                  <button
                    @click.stop="copyFullMessage(msg)"
                    class="px-2 py-1 rounded bg-slate-600/50 hover:bg-slate-600 text-slate-300 hover:text-green-400 transition-colors text-xs"
                    :title="'Copy entire message as JSON'"
                  >
                    <span v-if="copiedField === `msg-${msg.seq}-full`" class="text-green-400">✓ Copied</span>
                    <span v-else>📋 Copy Message</span>
                  </button>
                </div>
              </div>
            </button>
          </div>
          <div v-if="expandedMessages.has(msg.seq)" class="border-t border-slate-600 p-3 bg-slate-800/30">
            <div class="space-y-3">
              <div class="relative">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-xs font-semibold uppercase text-slate-400">Full Data</h4>
                  <button
                    @click.stop="copyToClipboard(formatMessageData(msg.data), `${msg.seq}-json`)"
                    class="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-green-400 transition-colors text-xs"
                    :title="'Copy JSON data'"
                  >
                    <span v-if="copiedField === `${msg.seq}-json`" class="text-green-400">✓ Copied</span>
                    <span v-else>📋 Copy JSON</span>
                  </button>
                </div>
                <pre class="overflow-x-auto rounded bg-slate-900 p-3 text-xs"><code v-html="getColoredJson(msg.data)"></code></pre>
              </div>
              <div v-if="msg.headers" class="relative">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-xs font-semibold uppercase text-slate-400">Headers</h4>
                  <button
                    @click.stop="copyToClipboard(JSON.stringify(msg.headers, null, 2), `${msg.seq}-headers`)"
                    class="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-green-400 transition-colors text-xs"
                    :title="'Copy headers'"
                  >
                    <span v-if="copiedField === `${msg.seq}-headers`" class="text-green-400">✓ Copied</span>
                    <span v-else>📋 Copy</span>
                  </button>
                </div>
                <pre class="overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-300"><code>{{ JSON.stringify(msg.headers, null, 2) }}</code></pre>
              </div>
            </div>
          </div>
        </div>
      </template>
      <p v-else-if="!isStreaming" class="text-center text-slate-500">No messages found for this subject.</p>

      <!-- Load More section with message count -->
      <div v-if="hasMoreMessages && !isStreaming" class="pt-4 space-y-2">
        <!-- Message count badge (also shown here for convenience) -->
        <div class="flex items-center justify-center">
          <div class="rounded-md bg-slate-700/50 border border-slate-600 px-3 py-2">
            <p class="text-sm font-medium text-slate-300">
              <span class="text-green-400">{{ messages.length }}</span> messages loaded
              <span v-if="lowestSeqSeen" class="text-slate-500 ml-2">(oldest: seq {{ lowestSeqSeen }})</span>
            </p>
          </div>
        </div>
        <!-- Load More button -->
        <div class="flex justify-center">
          <UiButton @click="loadMore" class="bg-green-600 hover:bg-green-700">
            Load More
          </UiButton>
        </div>
      </div>
    </div>
  </div>
</template>