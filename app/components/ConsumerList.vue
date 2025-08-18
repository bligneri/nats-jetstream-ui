<script setup lang="ts">
import type { ConsumerInfo } from '~/types';
import SpinnerIcon from './icons/SpinnerIcon.vue';

const props = defineProps<{
  streamName: string;
}>();

const { data: consumers, pending: isLoading, error } = await useFetch<ConsumerInfo[]>(`/api/streams/${props.streamName}/consumers`);

</script>

<template>
  <div>
    <div v-if="isLoading" class="flex justify-center p-8">
      <SpinnerIcon class="h-8 w-8 animate-spin text-green-400" />
    </div>
    <div v-else-if="error">
        <p class="text-center text-red-400">Failed to load consumers.</p>
    </div>
    <div v-else-if="!consumers || consumers.length === 0">
      <p class="text-center text-slate-500">No consumers found for this stream.</p>
    </div>
    <div v-else class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-700">
        <thead class="bg-slate-800">
          <tr>
            <th scope="col" class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Name</th>
            <th scope="col" class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Ack Policy</th>
            <th scope="col" class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Filter Subject</th>
            <th scope="col" class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Pending</th>
            <th scope="col" class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Waiting</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-700/50">
          <tr v-for="consumer in consumers" :key="consumer.name" class="hover:bg-slate-700/30">
            <td class="whitespace-nowrap px-4 py-3 font-mono text-sm text-green-300">{{ consumer.name }}</td>
            <td class="whitespace-nowrap px-4 py-3 font-mono text-sm uppercase">{{ consumer.config.ack_policy }}</td>
            <td class="whitespace-nowrap px-4 py-3 font-mono text-sm">{{ consumer.config.filter_subject || 'N/A' }}</td>
            <td class="whitespace-nowrap px-4 py-3 font-mono text-sm">{{ consumer.num_ack_pending }}</td>
            <td class="whitespace-nowrap px-4 py-3 font-mono text-sm">{{ consumer.num_waiting }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>