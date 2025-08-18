<template>
    <div v-if="loading" class="text-center p-10">Loading Streams...</div>
    <div v-else>
        <h1 class="text-3xl font-bold text-jet-light mb-6">Streams</h1>
        <div class="mb-4">
            <input
                type="text"
                placeholder="Search streams..."
                class="w-full md:w-1/3 bg-jet-dark-300 border border-jet-dark-400 rounded-lg px-4 py-2 text-jet-text focus:outline-none focus:ring-2 focus:ring-jet-accent"
                v-model="searchTerm"
            />
        </div>
        <div class="bg-jet-dark-200 rounded-lg shadow-lg overflow-hidden">
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-jet-dark-300">
                    <thead class="bg-jet-dark-300">
                        <tr>
                            <th class="table-header">Name</th>
                            <th class="table-header">Messages</th>
                            <th class="table-header">Size</th>
                            <th class="table-header">Consumers</th>
                            <th class="table-header">Storage</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-jet-dark-300">
                        <tr
                            v-for="stream in filteredStreams"
                            :key="stream.config.name"
                            @click="selectStream(stream)"
                            class="hover:bg-jet-dark-300 cursor-pointer transition-colors duration-150"
                        >
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div
                                    class="text-sm font-medium text-jet-accent"
                                >
                                    {{ stream.config.name }}
                                </div>
                            </td>
                            <td class="table-cell">
                                {{ stream.state.messages.toLocaleString() }}
                            </td>
                            <td class="table-cell">
                                {{ formatBytes(stream.state.bytes) }}
                            </td>
                            <td class="table-cell">
                                {{ stream.state.consumer_count }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span
                                    :class="[
                                        'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                                        stream.config.storage === 'File'
                                            ? 'bg-blue-900 text-blue-300'
                                            : 'bg-green-900 text-green-300',
                                    ]"
                                >
                                    {{ stream.config.storage }}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useNatsStore } from "../stores/nats";
import type { Stream } from "../types";

const router = useRouter();
const natsStore = useNatsStore();

const searchTerm = ref("");

const loading = computed(() => natsStore.loading.streams);

onMounted(() => {
    natsStore.fetchStreams();
});

const filteredStreams = computed(() =>
    natsStore.streams.filter((stream) =>
        stream.config.name
            .toLowerCase()
            .includes(searchTerm.value.toLowerCase()),
    ),
);

const selectStream = (stream: Stream) => {
    router.push({
        name: "StreamDetails",
        params: { name: stream.config.name },
    });
};

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};
</script>
