<script setup lang="ts">
import { ref, h, watch, onMounted } from 'vue';
import type { StreamInfo } from '~/types';
import UiTabs from './ui/Tabs.vue';
import type { Tab } from './ui/Tabs.vue';
import InfoIcon from './icons/InfoIcon.vue';
import ConsumerIcon from './icons/ConsumerIcon.vue';
import MessageIcon from './icons/MessageIcon.vue';
import ConsumerList from './ConsumerList.vue';
import MessageViewer from './MessageViewer.vue';

const props = defineProps<{
  stream: StreamInfo;
  serverId?: number;
}>();

const route = useRoute();
const router = useRouter();
const { handleApiError } = useConnectionHealth();

const navigateToParentStream = () => {
  if (props.stream.parentStream) {
    router.push({ query: { ...route.query, stream: props.stream.parentStream } });
  }
};

// Initialize tab from URL or default to 'info'
const activeTab = ref((route.query.tab as string) || 'info');

// Watch for tab changes and update URL
watch(activeTab, (newTab) => {
  router.push({ query: { ...route.query, tab: newTab } });
});

// Clear subject-specific query params when stream changes
// These params are specific to individual streams and should not persist
watch(() => props.stream.config.name, (newStreamName, oldStreamName) => {
  if (oldStreamName && newStreamName !== oldStreamName) {
    console.log('🔄 Stream changed from', oldStreamName, 'to', newStreamName, '- clearing subject params');
    if (route.query.subject || route.query.expectedCount) {
      const { subject, expectedCount, ...restQuery } = route.query;
      router.replace({ query: restQuery });
    }
  }
});

const tabs: Tab[] = [
  { id: 'info', label: 'Info', icon: () => h(InfoIcon, { class: 'h-5 w-5' }) },
  { id: 'consumers', label: 'Consumers', icon: () => h(ConsumerIcon, { class: 'h-5 w-5' }) },
  { id: 'subjects', label: 'Subjects', icon: () => h(MessageIcon, { class: 'h-5 w-5' }) },
  { id: 'messages', label: 'Messages', icon: () => h(MessageIcon, { class: 'h-5 w-5' }) },
];

// Subjects data
const subjectsData = ref<Array<{ subject: string; count: number }>>([]);
const isLoadingSubjects = ref(false);
const subjectsError = ref<string | null>(null);
const subjectsSortAscending = ref(false); // false = descending (default)

// Fetch subjects data when tab is accessed
const fetchSubjects = async () => {
  // Always reload when switching streams
  subjectsData.value = [];

  isLoadingSubjects.value = true;
  subjectsError.value = null;

  try {
    const streamName = props.stream.isVirtual
      ? props.stream.parentStream
      : props.stream.config.name;

    console.log(`Fetching subjects for stream: ${streamName}`);
    const response = await $fetch<any>(`/api/streams/${streamName}/subjects`);
    console.log(`Received subjects:`, response);

    const entries = Object.entries(response.subjects || {})
      .map(([subject, count]) => ({ subject, count: count as number }));

    // Sort based on current sort order
    subjectsData.value = entries.sort((a, b) =>
      subjectsSortAscending.value ? a.count - b.count : b.count - a.count
    );
  } catch (error: any) {
    console.error('Failed to fetch subjects:', error);
    const isConnectionError = handleApiError(error);
    if (!isConnectionError) {
      // Only show local error if it's not a connection error (connection errors are handled globally)
      subjectsError.value = error.data?.statusMessage || 'Failed to fetch subjects';
    }
  } finally {
    isLoadingSubjects.value = false;
  }
};

// Watch tab changes to load subjects when needed
watch(activeTab, (newTab) => {
  if (newTab === 'subjects') {
    fetchSubjects();
  }
});

// Watch stream changes to reload subjects
watch(() => props.stream.config.name, () => {
  if (activeTab.value === 'subjects') {
    fetchSubjects();
  }
});

// Click handler to search for a subject
const searchSubject = async (subject: string, expectedCount?: number) => {
  console.log('🔍 SearchSubject called with:', subject, 'expectedCount:', expectedCount);
  // First update the URL with the subject query parameter and expected count
  console.log('🔍 Pushing to router with subject:', subject);
  const query: Record<string, any> = { ...route.query, tab: 'messages', subject };
  if (expectedCount !== undefined) {
    query.expectedCount = expectedCount.toString();
  }
  await router.push({ query });
  // Then switch to messages tab AFTER navigation completes
  // This ensures MessageViewer initializes with the query parameter already in the URL
  activeTab.value = 'messages';
};

// Copy subject to clipboard
const copiedSubject = ref<string | null>(null);
const copySubject = async (subject: string, event: Event) => {
  event.stopPropagation(); // Prevent row click
  try {
    await navigator.clipboard.writeText(subject);
    copiedSubject.value = subject;
    setTimeout(() => {
      copiedSubject.value = null;
    }, 2000);
  } catch (error) {
    console.error('Failed to copy subject:', error);
  }
};

// Toggle sort order for subjects
const toggleSubjectsSort = () => {
  subjectsSortAscending.value = !subjectsSortAscending.value;
  // Re-sort the existing data
  subjectsData.value = subjectsData.value.sort((a, b) =>
    subjectsSortAscending.value ? a.count - b.count : b.count - a.count
  );
};

const DetailItem = (props: { label: string; value: any }) =>
  h('div', { class: 'flex flex-col' }, [
    h('dt', { class: 'text-xs font-medium uppercase tracking-wider text-slate-500' }, props.label),
    h('dd', { class: 'mt-1 font-mono text-sm text-slate-200' }, props.value),
  ]);

// Helper to calculate average messages per day
const calculateAvgMessagesPerDay = (stream: StreamInfo) => {
  if (stream.state.messages === 0 || stream.state.messages === -1) return 'N/A';
  if (!stream.state.first_ts || !stream.state.last_ts) return 'N/A';

  // Calculate time span from first to last message
  const startDate = new Date(stream.state.first_ts);
  const endDate = new Date(stream.state.last_ts);
  const ageInDays = Math.max(0.001, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  // Use sequence range to get total messages that have been in the stream
  // This accounts for messages that may have been deleted by retention policy
  const totalMessages = stream.state.last_seq - stream.state.first_seq + 1;

  return (totalMessages / ageInDays).toFixed(0).toLocaleString();
};

// Helper to calculate average messages per second
const calculateAvgMessagesPerSecond = (stream: StreamInfo) => {
  if (stream.state.messages === 0 || stream.state.messages === -1) return 'N/A';
  if (!stream.state.first_ts || !stream.state.last_ts) return 'N/A';

  // Calculate time span from first to last message
  const startDate = new Date(stream.state.first_ts);
  const endDate = new Date(stream.state.last_ts);
  const ageInSeconds = Math.max(0.001, (endDate.getTime() - startDate.getTime()) / 1000);

  // Use sequence range to get total messages that have been in the stream
  const totalMessages = stream.state.last_seq - stream.state.first_seq + 1;

  return (totalMessages / ageInSeconds).toFixed(1);
};

// Helper to format timestamp
const formatTimestamp = (timestamp?: string) => {
  if (!timestamp) return 'Unknown';
  return new Date(timestamp).toLocaleString();
};

const StreamInfoTab = ({ stream, onNavigateToParent }: { stream: StreamInfo; onNavigateToParent?: () => void }) => [
  h('div', { class: 'mt-4' }, [
    ...(stream.isVirtual ? [
      h('div', { class: 'mb-4 rounded-md bg-blue-500/10 border border-blue-500/30 p-3' }, [
        h('div', { class: 'flex items-center justify-between' }, [
          h('div', { class: 'flex items-center space-x-2' }, [
            h('span', { class: 'text-blue-400 font-semibold' }, '🔷 Virtual Stream'),
            h('span', { class: 'text-slate-300 text-sm' }, 'Filtered view of '),
            h('button', {
              class: 'text-blue-400 hover:text-blue-300 underline font-mono text-sm',
              onClick: onNavigateToParent,
            }, stream.parentStream),
          ]),
        ]),
        h('div', { class: 'mt-2 text-xs text-slate-400' }, `Subject: ${stream.virtualSubject}`),
      ])
    ] : []),
    h('div', { class: 'grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3 lg:grid-cols-4' }, [
      h(DetailItem, { label: "Messages", value: stream.state.messages === -1 ? 'Unknown' : stream.state.messages.toLocaleString() }),
      h(DetailItem, { label: "Size", value: stream.state.bytes === -1 ? 'Unknown' : `${(stream.state.bytes / 1024 / 1024).toFixed(2)} MB` }),
      h(DetailItem, { label: "Avg Msgs/Day", value: calculateAvgMessagesPerDay(stream) }),
      h(DetailItem, { label: "Avg Msgs/Sec", value: calculateAvgMessagesPerSecond(stream) }),
      h(DetailItem, { label: "First Message", value: formatTimestamp(stream.state.first_ts) }),
      h(DetailItem, { label: "Last Message", value: formatTimestamp(stream.state.last_ts) }),
      h(DetailItem, { label: "First Sequence", value: stream.state.first_seq.toLocaleString() }),
      h(DetailItem, { label: "Last Sequence", value: stream.state.last_seq.toLocaleString() }),
      h(DetailItem, { label: "Consumers", value: stream.state.consumer_count.toLocaleString() }),
      h(DetailItem, { label: "Storage", value: stream.config.storage }),
      h(DetailItem, { label: "Replicas", value: stream.config.num_replicas }),
      h(DetailItem, { label: "Retention", value: stream.config.retention }),
      h(DetailItem, { label: "Created", value: new Date(stream.created).toLocaleString() }),
    ]),
    h('div', { class: 'mt-6' }, [
      h('h3', { class: 'text-xs font-medium uppercase tracking-wider text-slate-500' }, 'Subjects'),
      stream.config.subjects.length > 0
        ? h('div', { class: 'mt-2 flex flex-wrap gap-2' },
            stream.config.subjects.map(subject =>
              h('span', { key: subject, class: 'rounded-full bg-slate-700 px-3 py-1 font-mono text-xs text-slate-300' }, subject)
            )
          )
        : h('p', { class: 'mt-2 text-sm text-slate-400 italic' }, 'Source stream - aggregates from external streams')
    ])
  ])
];

</script>

<template>
  <div>
    <h1 class="text-2xl font-bold text-white">{{ stream.config.name }}</h1>
    <p class="mt-1 text-sm text-slate-400">
      Details and messages for the <span class="font-semibold text-slate-300">{{ stream.config.name }}</span> stream.
    </p>

    <div class="mt-6">
      <UiTabs :tabs="tabs" v-model:active-tab="activeTab" />
      <div class="mt-4 rounded-b-lg bg-slate-800/50 p-4">
        <StreamInfoTab v-if="activeTab === 'info'" :stream="stream" :onNavigateToParent="navigateToParentStream" />
        <ConsumerList v-if="activeTab === 'consumers'" :stream-name="stream.config.name" />

        <!-- Subjects Tab -->
        <div v-if="activeTab === 'subjects'">
          <div v-if="isLoadingSubjects" class="text-center py-8">
            <p class="text-slate-400">Loading subjects...</p>
          </div>
          <div v-else-if="subjectsError" class="text-center py-8">
            <p class="text-red-400">{{ subjectsError }}</p>
          </div>
          <div v-else-if="subjectsData.length === 0" class="text-center py-8">
            <p class="text-slate-400">No subjects found</p>
          </div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm text-left">
              <thead class="text-xs uppercase bg-slate-700 text-slate-300">
                <tr>
                  <th class="px-4 py-3">Subject</th>
                  <th class="px-4 py-3">Actions</th>
                  <th class="px-4 py-3 text-right cursor-pointer hover:bg-slate-600 transition-colors" @click="toggleSubjectsSort">
                    Messages
                    <span class="ml-1">{{ subjectsSortAscending ? '↑' : '↓' }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in subjectsData"
                  :key="item.subject"
                  class="border-b border-slate-700 hover:bg-slate-700/50 transition-colors"
                >
                  <td class="px-4 py-3 font-mono text-slate-200">{{ item.subject }}</td>
                  <td class="px-4 py-3">
                    <div class="flex items-center space-x-2">
                      <button
                        @click="searchSubject(item.subject, item.count)"
                        class="flex items-center space-x-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-green-400 transition-colors text-xs"
                        :title="`Search for this subject (${item.count} message${item.count !== 1 ? 's' : ''})`"
                      >
                        <span class="text-sm">🔍</span>
                        <span>Search</span>
                      </button>
                      <button
                        @click="copySubject(item.subject, $event)"
                        class="flex items-center space-x-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-green-400 transition-colors text-xs"
                        :title="'Copy subject to clipboard'"
                      >
                        <span v-if="copiedSubject === item.subject" class="text-sm text-green-400">✓</span>
                        <span v-else class="text-sm">📋</span>
                        <span>{{ copiedSubject === item.subject ? 'Copied!' : 'Copy Subject' }}</span>
                      </button>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-right font-mono text-slate-300">{{ item.count.toLocaleString() }}</td>
                </tr>
              </tbody>
              <tfoot class="text-xs uppercase bg-slate-700 text-slate-300">
                <tr>
                  <td colspan="2" class="px-4 py-3 font-semibold">Total Subjects</td>
                  <td class="px-4 py-3 text-right font-semibold">{{ subjectsData.length.toLocaleString() }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div v-if="activeTab === 'messages'">
          <MessageViewer
            :subjects="stream.config.subjects.length > 0 ? stream.config.subjects : [stream.virtualSubject || '>']"
            :stream-name="stream.config.name"
            :server-id="serverId"
          />
        </div>
      </div>
    </div>
  </div>
</template>