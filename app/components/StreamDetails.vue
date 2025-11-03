<script setup lang="ts">
import { ref, h, watch } from 'vue';
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
}>();

const route = useRoute();
const router = useRouter();

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

const tabs: Tab[] = [
  { id: 'info', label: 'Info', icon: () => h(InfoIcon, { class: 'h-5 w-5' }) },
  { id: 'consumers', label: 'Consumers', icon: () => h(ConsumerIcon, { class: 'h-5 w-5' }) },
  { id: 'messages', label: 'Messages', icon: () => h(MessageIcon, { class: 'h-5 w-5' }) },
];

const DetailItem = (props: { label: string; value: any }) =>
  h('div', { class: 'flex flex-col' }, [
    h('dt', { class: 'text-xs font-medium uppercase tracking-wider text-slate-500' }, props.label),
    h('dd', { class: 'mt-1 font-mono text-sm text-slate-200' }, props.value),
  ]);

// Helper to calculate average messages per day
const calculateAvgMessagesPerDay = (stream: StreamInfo) => {
  if (stream.state.messages === 0 || stream.state.messages === -1) return 'N/A';

  // Use first message timestamp if available, otherwise use stream creation date
  const startDate = stream.state.first_ts ? new Date(stream.state.first_ts) : new Date(stream.created);
  const now = new Date();
  const ageInDays = Math.max(1, (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  return (stream.state.messages / ageInDays).toFixed(0);
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
        <div v-if="activeTab === 'messages'">
          <MessageViewer
            :subjects="stream.config.subjects.length > 0 ? stream.config.subjects : [stream.virtualSubject || '>']"
            :stream-name="stream.config.name"
          />
        </div>
      </div>
    </div>
  </div>
</template>