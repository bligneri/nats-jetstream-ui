<template>
    <div v-if="loading" class="text-center p-10">Loading Dashboard...</div>
    <div v-else-if="stats">
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold text-jet-light">Dashboard</h1>
            <div
                class="flex items-center space-x-2 bg-jet-dark-200 px-3 py-1.5 rounded-lg"
            >
                <Icon name="dot" customClass="w-4 h-4 text-jet-success" />
                <span class="text-sm font-medium text-jet-text">{{
                    stats.serverStatus
                }}</span>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card
                title="Total Streams"
                :value="stats.streams"
                iconName="stream"
                iconColorClass="bg-blue-500"
            />
            <Card
                title="Total Consumers"
                :value="stats.consumers"
                iconName="consumer"
                iconColorClass="bg-green-500"
            />
            <Card
                title="Total Messages"
                :value="stats.messages.toLocaleString()"
                iconName="message"
                iconColorClass="bg-yellow-500"
            />
            <Card
                title="Server"
                value="NATS v2.9.21"
                iconName="server"
                iconColorClass="bg-purple-500"
            />
        </div>

        <div class="mt-10 bg-jet-dark-200 p-6 rounded-lg shadow-lg">
            <h2 class="text-xl font-semibold text-jet-light mb-4">
                Welcome to NATS Jetstream UI
            </h2>
            <p class="text-jet-text-secondary">
                This interface provides a comprehensive overview of your NATS
                Jetstream instance. Use the sidebar to navigate between the
                dashboard and the detailed stream management page. You can
                monitor real-time message flow, inspect stream configurations,
                and manage consumers efficiently.
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from "vue";
import Card from "@/components/Card.vue";
import Icon from "@/components/Icon.vue";
import { useNatsStore } from "@/stores/nats";

const natsStore = useNatsStore();

const stats = computed(() => natsStore.stats);
const loading = computed(() => natsStore.loading.stats);

onMounted(() => {
    natsStore.fetchDashboardStats();
});
</script>
