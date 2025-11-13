<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { StreamInfo } from "~/types";
import StreamList from "~/components/StreamList.vue";
import StreamDetails from "~/components/StreamDetails.vue";
import NatsIcon from "~/components/icons/NatsIcon.vue";
import SpinnerIcon from "~/components/icons/SpinnerIcon.vue";
import { useNatsConnection } from "~/composables/useNatsConnection";
import { definePageMeta } from "#imports";

definePageMeta({
    middleware: [
        defineNuxtRouteMiddleware(async (to, from) => {
            // Get serverId from route
            const serverId = parseInt(to.params.serverId as string, 10);

            // Check server-side connection status
            try {
                const status = await $fetch<{ connected: boolean; hasConnectionDetails: boolean }>('/api/connection-status');

                // If not connected, try to auto-connect to configured server
                if (!status.hasConnectionDetails && serverId > 0) {
                    const serverConfig = await $fetch<any>('/api/servers');
                    const server = serverConfig.servers?.find((s: any) => s.id === serverId);

                    if (server) {
                        // Auto-connect to configured server
                        await $fetch('/api/connect', {
                            method: 'POST',
                            body: {
                                serverUrl: server.url,
                                user: '',
                                password: '',
                            },
                        });
                        return; // Continue to dashboard
                    }
                }

                // If still no connection, redirect to home
                if (!status.hasConnectionDetails) {
                    // For custom server (serverId=0), add hint that they need to connect
                    if (serverId === 0) {
                        return navigateTo("/?custom=true");
                    }
                    return navigateTo("/");
                }
            } catch (error) {
                console.error('Failed to check/establish connection:', error);
                return navigateTo("/");
            }
        }),
    ],
});

const { setConnection } = useNatsConnection();
const router = useRouter();
const route = useRoute();

const serverId = computed(() => parseInt(route.params.serverId as string, 10));
const servers = ref<any[]>([]);
const currentServer = computed(() => servers.value.find(s => s.id === serverId.value));

// Get custom server name from URL query param
const customServerName = computed(() => route.query.serverName as string || '');

const streams = ref<StreamInfo[]>([]);
const selectedStream = ref<StreamInfo>();
const isLoading = ref(true);
const serverUrl = ref<string>(''); // Will be fetched from server

// Format server URL to show only hostname:port (hide credentials)
const formatServerUrl = (url: string): string => {
    try {
        const urlObj = new URL(url);
        // Return just hostname:port
        return `${urlObj.hostname}:${urlObj.port || (urlObj.protocol === 'https:' ? '443' : '4222')}`;
    } catch {
        // If URL parsing fails, try to extract host:port manually
        const match = url.match(/\/\/([^@]+@)?([^\/]+)/);
        if (match && match[2]) {
            return match[2]; // Return host:port without credentials
        }
        return url; // Fallback to original
    }
};

// Get display name for current server
const serverDisplayName = computed(() => {
    if (serverId.value === 0) {
        // For custom servers, use the custom name if provided
        const name = customServerName.value || 'Custom';
        return `${name} (${formatServerUrl(serverUrl.value)})`;
    }
    return currentServer.value?.name || formatServerUrl(serverUrl.value);
});

onMounted(async () => {
    isLoading.value = true;
    try {
        // Fetch servers config, connection info and streams in parallel
        const [serverConfig, connectionInfo, fetchedStreams] = await Promise.all([
            $fetch<any>('/api/servers'),
            $fetch<{ serverUrl: string }>('/api/connection-info'),
            $fetch<StreamInfo[]>("/api/streams")
        ]);

        servers.value = serverConfig.servers;
        serverUrl.value = connectionInfo.serverUrl;
        streams.value = fetchedStreams;

        // Check URL for stream parameter
        const streamParam = route.query.stream as string;
        if (streamParam) {
            const stream = fetchedStreams.find(s => s.config.name === streamParam);
            selectedStream.value = stream || fetchedStreams[0];
        } else if (fetchedStreams.length > 0) {
            selectedStream.value = fetchedStreams[0];
            // Set URL param for default stream
            router.replace({ query: { stream: fetchedStreams[0].config.name } });
        }
    } catch (error) {
        console.error("Failed to fetch streams:", error);
    } finally {
        isLoading.value = false;
    }
});

const handleSelectStream = (stream: StreamInfo) => {
    selectedStream.value = stream;
    // Update URL with selected stream
    router.push({ query: { ...route.query, stream: stream.config.name } });
};

const handleServerSwitch = async (newServerId: number) => {
    if (newServerId === 0) {
        // Manual/Custom server - disconnect and go to connection page
        try {
            await $fetch('/api/disconnect', { method: 'POST' });
        } catch (error) {
            console.error('Failed to disconnect:', error);
        }
        router.push("/?disconnected=true");
    } else {
        // Switch to another configured server
        const server = servers.value.find(s => s.id === newServerId);
        if (server) {
            try {
                // Reconnect to the new server
                await $fetch('/api/connect', {
                    method: 'POST',
                    body: {
                        serverUrl: server.url,
                        user: '',
                        password: '',
                    },
                });
                // Navigate to new server dashboard and reload
                window.location.href = `/${newServerId}/dashboard`;
            } catch (error) {
                console.error('Failed to switch servers:', error);
            }
        }
    }
};
</script>

<template>
    <div class="flex h-screen flex-col">
        <header
            class="flex flex-shrink-0 items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-2 shadow-md"
        >
            <div class="flex items-center space-x-3">
                <NatsIcon class="h-8 w-8 text-green-400" />
                <h1 class="text-xl font-semibold text-white">
                    JetStream Explorer
                </h1>
            </div>
            <div class="flex items-center space-x-4">
                <div class="text-sm text-slate-400">
                    Server:
                    <span class="font-mono text-green-400">{{
                        serverDisplayName
                    }}</span>
                </div>
                <select
                    :value="serverId"
                    @change="handleServerSwitch(parseInt(($event.target as HTMLSelectElement).value))"
                    class="rounded-md bg-slate-700 border border-slate-600 px-3 py-1 text-sm text-slate-200 hover:bg-slate-600 focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400"
                >
                    <option v-for="server in servers" :key="server.id" :value="server.id">
                        {{ server.name }}
                    </option>
                    <option value="0">{{ customServerName || 'Custom' }}</option>
                </select>
            </div>
        </header>

        <main class="flex flex-grow overflow-hidden">
            <div
                v-if="isLoading"
                class="flex h-full w-full items-center justify-center"
            >
                <SpinnerIcon class="h-10 w-10 animate-spin text-green-400" />
            </div>
            <template v-else>
                <aside
                    class="w-1/4 flex-shrink-0 overflow-y-auto border-r border-slate-700 bg-slate-800/50"
                >
                    <StreamList
                        :streams="streams"
                        :selected-stream-name="selectedStream?.config.name"
                        @select-stream="handleSelectStream"
                    />
                </aside>
                <section class="flex-grow overflow-y-auto p-6">
                    <StreamDetails
                        v-if="selectedStream"
                        :stream="selectedStream"
                        :server-id="serverId"
                        :key="selectedStream.config.name"
                    />
                    <div v-else class="flex h-full items-center justify-center">
                        <p class="text-slate-500">
                            Select a stream to view its details.
                        </p>
                    </div>
                </section>
            </template>
        </main>
    </div>
</template>
