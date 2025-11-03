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

const StreamInfoTab = ({ stream }: { stream: StreamInfo }) => [
  h('div', { class: 'mt-4' }, [
    h('div', { class: 'grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3 lg:grid-cols-4' }, [
      h(DetailItem, { label: "Messages", value: stream.state.messages.toLocaleString() }),
      h(DetailItem, { label: "Size", value: `${(stream.state.bytes / 1024 / 1024).toFixed(2)} MB` }),
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
      h('div', { class: 'mt-2 flex flex-wrap gap-2' },
        stream.config.subjects.map(subject =>
          h('span', { key: subject, class: 'rounded-full bg-slate-700 px-3 py-1 font-mono text-xs text-slate-300' }, subject)
        )
      )
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
        <StreamInfoTab v-if="activeTab === 'info'" :stream="stream" />
        <ConsumerList v-if="activeTab === 'consumers'" :stream-name="stream.config.name" />
        <MessageViewer v-if="activeTab === 'messages'" :subjects="stream.config.subjects" />
      </div>
    </div>
  </div>
</template>