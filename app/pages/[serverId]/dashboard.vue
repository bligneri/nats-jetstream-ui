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
            console.log('🛂 Middleware: Navigating to serverId:', serverId, 'from:', from?.params?.serverId);

            // For custom servers (serverId=0), check if there's an active connection
            // If not, redirect to connection page
            if (serverId === 0) {
                try {
                    const status = await $fetch<{ connected: boolean; hasConnectionDetails: boolean }>('/api/connection-status');
                    if (!status.connected) {
                        console.log('🛂 Middleware: Custom server not connected, redirecting to connection page');
                        return navigateTo('/?custom=true');
                    }
                } catch (error) {
                    console.error('🛂 Middleware: Failed to check connection status:', error);
                    return navigateTo('/?custom=true');
                }
                return; // Connection exists, continue to dashboard
            }

            // For configured servers (serverId > 0), try to connect
            try {
                const serverConfig = await $fetch<any>('/api/servers');
                const server = serverConfig.servers?.find((s: any) => s.id === serverId);
                console.log('🛂 Middleware: Found server config for serverId', serverId, ':', server);

                if (server) {
                    try {
                        console.log('🛂 Middleware: Attempting to connect to', server.url);
                        // Always try to connect to ensure we're on the right server
                        await $fetch('/api/connect', {
                            method: 'POST',
                            body: {
                                serverUrl: server.url,
                                user: '',
                                password: '',
                            },
                        });
                        console.log('🛂 Middleware: Connection successful');
                        return; // Connection successful, continue to dashboard
                    } catch (connectError) {
                        // Connection failed - let the page load so it can show the error banner
                        console.error('🛂 Middleware: Connection failed, will show error banner:', connectError);
                        return; // Continue to dashboard which will detect the error and show banner
                    }
                } else {
                    // Server not found in config, redirect to connection page
                    console.log('🛂 Middleware: Server not found, redirecting to connection page');
                    return navigateTo('/');
                }
            } catch (error) {
                console.error('🛂 Middleware: Failed in middleware:', error);
                // Let the page load anyway, it will handle the error
            }
        }),
    ],
});

const { setConnection } = useNatsConnection();
const { connectionError, isRetrying, handleApiError, clearConnectionError } = useConnectionHealth();
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
const serverSelectRef = ref<HTMLSelectElement | null>(null);

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
        // Always fetch server config first (this doesn't require connection)
        const serverConfig = await $fetch<any>('/api/servers');
        servers.value = serverConfig.servers;

        // Set serverUrl based on serverId (for error display)
        if (serverId.value > 0) {
            const server = servers.value.find(s => s.id === serverId.value);
            if (server) {
                serverUrl.value = server.url;
            }
        }

        // Try to fetch connection info and streams
        const [connectionInfo, fetchedStreams] = await Promise.all([
            $fetch<{ serverUrl: string }>('/api/connection-info'),
            $fetch<StreamInfo[]>("/api/streams")
        ]);

        // Update serverUrl from connection info (might be different for custom servers)
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
    } catch (error: any) {
        console.error("Failed to fetch dashboard data:", error);
        handleApiError(error);
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
    console.log('🔄 handleServerSwitch called with newServerId:', newServerId);
    clearConnectionError(); // Clear connection health errors

    if (newServerId === 0) {
        console.log('🔄 Switching to custom server (0), redirecting to connection page');
        // Manual/Custom server - disconnect and go to connection page
        try {
            await $fetch('/api/disconnect', { method: 'POST' });
        } catch (error) {
            console.error('Failed to disconnect:', error);
        }
        window.location.href = "/?disconnected=true";
    } else {
        // Switch to another configured server
        const server = servers.value.find(s => s.id === newServerId);
        console.log('🔄 Found server config:', server);
        if (server) {
            // Always navigate to the new server's dashboard WITHOUT query params
            // Each server has its own streams, so old stream/subject params don't make sense
            console.log(`🔄 Navigating to /${newServerId}/dashboard (clearing query params)`);
            window.location.href = `/${newServerId}/dashboard`;
        } else {
            console.error('❌ Server not found in config for id:', newServerId);
        }
    }
};

// Retry connection for configured servers
const handleRetry = async () => {
    clearConnectionError();
    isRetrying.value = true;

    try {
        if (serverId.value === 0) {
            // Custom server - redirect to connection page to enter new URL
            window.location.href = "/?custom=true";
            return;
        } else {
            // Configured server - attempt to reconnect
            const server = servers.value.find(s => s.id === serverId.value);
            if (server) {
                await $fetch('/api/connect', {
                    method: 'POST',
                    body: {
                        serverUrl: server.url,
                        user: '',
                        password: '',
                    },
                });
                // Reload page to refresh all data
                window.location.reload();
            }
        }
    } catch (error: any) {
        console.error('Retry failed:', error);
        handleApiError(error);
    } finally {
        isRetrying.value = false;
    }
};

// Navigate to connection page to change URL
const handleChangeUrl = () => {
    window.location.href = "/?disconnected=true";
};

// Disconnect from current server and go to connection page
const handleDisconnect = async () => {
    try {
        await $fetch('/api/disconnect', { method: 'POST' });
    } catch (error) {
        console.error('Failed to disconnect:', error);
    }
    // Use full page navigation to clear all client-side state
    // Add ?disconnected=true to prevent auto-reconnect if NATS_URL env var is set
    window.location.href = "/?disconnected=true";
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
                    ref="serverSelectRef"
                    :value="serverId"
                    @change="(event) => {
                        const value = (event.target as HTMLSelectElement).value;
                        const parsedValue = parseInt(value);
                        console.log('🔄 Dropdown changed - raw value:', value, 'parsed:', parsedValue);
                        handleServerSwitch(parsedValue);
                    }"
                    class="rounded-md bg-slate-700 border border-slate-600 px-3 py-1 text-sm text-slate-200 hover:bg-slate-600 focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400"
                >
                    <option v-for="server in servers" :key="server.id" :value="server.id">
                        {{ server.name }}
                    </option>
                    <option value="0">{{ customServerName || 'Custom' }}</option>
                </select>
                <button
                    @click="handleDisconnect"
                    class="rounded-md bg-red-500/20 border border-red-500/50 px-3 py-1 text-sm text-red-400 hover:bg-red-500/30 hover:text-red-300 transition-colors"
                >
                    Disconnect
                </button>
            </div>
        </header>

        <main class="flex flex-grow overflow-hidden">
            <!-- Connection lost error banner with retry options -->
            <div
                v-if="connectionError"
                class="flex h-full w-full flex-col items-center justify-center bg-slate-900 p-8"
            >
                <div class="w-full max-w-2xl rounded-lg border border-red-500/30 bg-red-500/10 p-8 text-center">
                    <div class="mb-6">
                        <h2 class="text-2xl font-bold text-red-400 mb-2">Connection Lost</h2>
                        <p class="text-red-300 mb-4">{{ connectionError.message }}</p>
                        <div class="text-sm text-slate-400 font-mono">
                            Server: {{ formatServerUrl(serverUrl) }}
                        </div>
                    </div>

                    <div class="flex flex-col gap-3 items-center">
                        <!-- Retry button for configured servers -->
                        <button
                            v-if="serverId !== 0"
                            @click="handleRetry"
                            :disabled="isRetrying"
                            class="px-6 py-3 rounded-md bg-green-500 hover:bg-green-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[200px]"
                        >
                            <span v-if="isRetrying" class="flex items-center justify-center">
                                <SpinnerIcon class="mr-2 h-5 w-5 animate-spin" />
                                Reconnecting...
                            </span>
                            <span v-else>Retry Connection</span>
                        </button>

                        <!-- Change URL button for custom servers -->
                        <button
                            v-if="serverId === 0"
                            @click="handleChangeUrl"
                            class="px-6 py-3 rounded-md bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors min-w-[200px]"
                        >
                            Change Server URL
                        </button>

                        <!-- Alternative: Go to connection page -->
                        <button
                            @click="() => window.location.href = '/?disconnected=true'"
                            class="px-6 py-3 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold transition-colors min-w-[200px]"
                        >
                            Go to Connection Page
                        </button>
                    </div>
                </div>
            </div>

            <!-- Normal content when connected -->
            <div
                v-else-if="isLoading"
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
