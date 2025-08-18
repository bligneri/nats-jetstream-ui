<template>
    <div v-if="loading" class="text-center p-10">Loading stream details...</div>
    <div v-else-if="stream">
        <h1 class="text-3xl font-bold text-jet-light mb-2 flex items-center">
            <Icon name="stream" customClass="w-8 h-8 mr-3 text-jet-accent" />
            Stream: {{ stream.config.name }}
        </h1>
        <p class="text-sm text-jet-text-secondary mb-6">
            Created: {{ new Date(stream.created).toLocaleString() }}
        </p>

        <div class="bg-jet-dark-200 rounded-lg shadow-lg p-6 mb-6">
            <h2 class="text-xl font-semibold mb-4 text-jet-light">
                Stream State
            </h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                    <p class="text-sm text-jet-text-secondary">Messages</p>
                    <p class="text-2xl font-bold">
                        {{ stream.state.messages.toLocaleString() }}
                    </p>
                </div>
                <div>
                    <p class="text-sm text-jet-text-secondary">Size</p>
                    <p class="text-2xl font-bold">
                        {{ (stream.state.bytes / (1024 * 1024)).toFixed(2) }} MB
                    </p>
                </div>
                <div>
                    <p class="text-sm text-jet-text-secondary">First Seq</p>
                    <p class="text-2xl font-bold">
                        {{ stream.state.first_seq }}
                    </p>
                </div>
                <div>
                    <p class="text-sm text-jet-text-secondary">Last Seq</p>
                    <p class="text-2xl font-bold">
                        {{ stream.state.last_seq }}
                    </p>
                </div>
            </div>
        </div>

        <div class="bg-jet-dark-200 rounded-lg shadow-lg">
            <div class="border-b border-jet-dark-300 px-4">
                <nav class="-mb-px flex space-x-4">
                    <button
                        @click="activeTab = 'consumers'"
                        :class="getTabClass('consumers')"
                    >
                        Consumers
                        <span :class="tabCountClasses">{{
                            consumers.length
                        }}</span>
                    </button>
                    <button
                        @click="activeTab = 'messages'"
                        :class="getTabClass('messages')"
                    >
                        Recent Messages
                        <span :class="tabCountClasses">{{
                            messages.length
                        }}</span>
                    </button>
                    <button
                        @click="activeTab = 'config'"
                        :class="getTabClass('config')"
                    >
                        Configuration
                        <span :class="tabCountClasses">{{
                            Object.keys(stream.config).length
                        }}</span>
                    </button>
                </nav>
            </div>
            <div class="p-6">
                <div v-if="activeTab === 'consumers'" class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-jet-dark-400">
                        <thead class="bg-jet-dark-300">
                            <tr>
                                <th class="table-header">Name</th>
                                <th class="table-header">Ack Pending</th>
                                <th class="table-header">Redelivered</th>
                                <th class="table-header">Ack Policy</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-jet-dark-400">
                            <tr v-for="c in consumers" :key="c.name">
                                <td
                                    class="table-cell font-medium text-jet-accent"
                                >
                                    {{ c.name }}
                                </td>
                                <td :class="tableCellClasses">
                                    {{ c.num_ack_pending }}
                                </td>
                                <td :class="tableCellClasses">
                                    {{
                                        consumers.find(
                                            (con) => con.name === c.name,
                                        )?.num_ack_pending || 0
                                    }}
                                </td>
                                <td :class="tableCellClasses">
                                    {{ c.config.ack_policy }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div v-if="activeTab === 'messages'" class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-jet-dark-400">
                        <thead class="bg-jet-dark-300">
                            <tr>
                                <th :class="tableHeaderClasses">Seq</th>
                                <th :class="tableHeaderClasses">Subject</th>
                                <th :class="tableHeaderClasses">Data</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-jet-dark-400">
                            <tr v-for="m in messages" :key="m.seq">
                                <td :class="tableCellClasses">{{ m.seq }}</td>
                                <td class="table-cell text-jet-accent">
                                    {{ m.subject }}
                                </td>
                                <td
                                    class="table-cell font-mono truncate max-w-sm"
                                >
                                    {{ m.data }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <dl v-if="activeTab === 'config'" class="space-y-4">
                    <div class="flex flex-wrap space-y-4 sm:space-y-0">
                        <div class="w-full sm:w-1/2">
                            <dt :class="detailLabelClasses">
                                Retention Policy
                            </dt>
                            <dd :class="detailValueClasses">
                                {{ stream.config.retention }}
                            </dd>
                        </div>
                        <div class="w-full sm:w-1/2">
                            <dt :class="detailLabelClasses">Storage Type</dt>
                            <dd :class="detailValueClasses">
                                {{ stream.config.storage }}
                            </dd>
                        </div>
                    </div>
                    <div class="flex flex-wrap space-y-4 sm:space-y-0">
                        <div class="w-full sm:w-1/2">
                            <dt :class="detailLabelClasses">Replicas</dt>
                            <dd :class="detailValueClasses">
                                {{ stream.config.replicas }}
                            </dd>
                        </div>
                        <div class="w-full sm:w-1/2">
                            <dt :class="detailLabelClasses">Max Age</dt>
                            <dd :class="detailValueClasses">
                                {{ stream.config.max_age }}
                            </dd>
                        </div>
                    </div>
                    <div class="flex flex-wrap space-y-4 sm:space-y-0">
                        <div class="w-full sm:w-1/2">
                            <dt :class="detailLabelClasses">Max Messages</dt>
                            <dd :class="detailValueClasses">
                                {{ stream.config.max_msgs.toLocaleString() }}
                            </dd>
                        </div>
                        <div class="w-full sm:w-1/2">
                            <dt :class="detailLabelClasses">Max Bytes</dt>
                            <dd :class="detailValueClasses">
                                {{ stream.config.max_bytes.toLocaleString() }}
                            </dd>
                        </div>
                    </div>
                    <div>
                        <dt :class="detailLabelClasses">Subjects</dt>
                        <dd class="flex flex-wrap gap-2 mt-1">
                            <span
                                v-for="s in stream.config.subjects"
                                :key="s"
                                class="px-2 py-1 text-xs font-mono bg-jet-dark-400 text-jet-text rounded"
                                >{{ s }}</span
                            >
                        </dd>
                    </div>
                </dl>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from "vue";
import { useRoute } from "vue-router";
import { useNatsStore } from "../stores/nats";
import type { Consumer, Message } from "../types";
import {
    getConsumersForStream,
    getPendingMessagesForStream,
} from "../services/natsService";
import Icon from "./Icon.vue";

const route = useRoute();
const natsStore = useNatsStore();

const consumers = ref<Consumer[]>([]);
const messages = ref<Message[]>([]);
const loading = ref(true);
const activeTab = ref<"consumers" | "messages" | "config">("consumers");

const streamName = computed(() => route.params.name as string);
const stream = computed(() => natsStore.getStreamByName(streamName.value));

const fetchLocalData = async () => {
    if (!stream.value) return;
    try {
        loading.value = true;
        const [consumersData, messagesData] = await Promise.all([
            getConsumersForStream(stream.value.config.name),
            getPendingMessagesForStream(stream.value.config.name),
        ]);
        consumers.value = consumersData;
        messages.value = messagesData;
    } catch (error) {
        console.error("Failed to fetch stream details:", error);
    } finally {
        loading.value = false;
    }
};

onMounted(async () => {
    if (natsStore.streams.length === 0) {
        await natsStore.fetchStreams();
    }
    fetchLocalData();
});

watch(streamName, fetchLocalData);

const getTabClass = (tabName: string) => {
    const baseClasses =
        "px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors";
    if (activeTab.value === tabName) {
        return `${baseClasses} border-jet-accent text-jet-accent`;
    }
    return `${baseClasses} border-transparent text-jet-text-secondary hover:text-jet-text`;
};

const tableHeaderClasses =
    "px-4 py-2 text-left text-xs font-medium text-jet-text-secondary uppercase";
const tableCellClasses = "px-4 py-3 whitespace-nowrap text-sm text-jet-text";
const tabCountClasses =
    "text-xs bg-jet-dark-400 text-jet-text-secondary rounded-full px-2 py-0.5 ml-1";
const detailLabelClasses = "text-sm font-medium text-jet-text-secondary";
const detailValueClasses = "mt-1 text-sm text-jet-light";
</script>
