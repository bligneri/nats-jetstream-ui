<script setup lang="ts">
import { ref, nextTick, onMounted, computed } from 'vue';
import type { NatsConnectionDetails } from '~/types';
import NatsIcon from '~/components/icons/NatsIcon.vue';
import SpinnerIcon from '~/components/icons/SpinnerIcon.vue';
import UiButton from '~/components/ui/Button.vue';
import UiInput from '~/components/ui/Input.vue';

const { setConnection } = useNatsConnection();
const router = useRouter();
const config = useRuntimeConfig();
const route = useRoute();

// Load servers from config
const servers = ref<any[]>([]);
const selectedServerId = ref<number | null>(null);
const useCustomServer = ref(false);

const serverUrl = ref(config.public.natsUrl || '');
const serverName = ref('Custom'); // Default to "Custom" so users don't have to enter it

// Check if user is trying to access custom server without connection
const needsCustomServer = ref(route.query.custom === 'true');

// Check if user explicitly disconnected (should not auto-connect)
const wasDisconnected = ref(route.query.disconnected === 'true');

// Start in connecting state if auto-connect is configured (but not if user disconnected or needs custom)
const shouldAutoConnect = !!config.public.natsUrl && !needsCustomServer.value && !wasDisconnected.value;
const isConnecting = ref(shouldAutoConnect);
const error = ref<string | null>(null);
const showForm = ref(!shouldAutoConnect);

// Get the selected configured server (if any)
const selectedServer = computed(() => {
  if (selectedServerId.value) {
    return servers.value.find(s => s.id === selectedServerId.value);
  }
  return null;
});

// Watch for custom URL input - if user types, switch to custom mode
watch(serverUrl, (newVal) => {
  if (newVal) {
    useCustomServer.value = true;
    selectedServerId.value = null;
  }
});

// Watch for server selection - clear custom URL
watch(selectedServerId, (newVal) => {
  if (newVal) {
    useCustomServer.value = false;
    serverUrl.value = '';
  }
});

onMounted(async () => {
  try {
    // Disconnect any existing connection when landing on connection page
    // (unless we're auto-connecting via NATS_URL env var)
    if (!shouldAutoConnect) {
      try {
        await $fetch('/api/disconnect', { method: 'POST' });
      } catch {
        // Ignore disconnect errors
      }
    }

    const serverConfig = await $fetch<any>('/api/servers');
    servers.value = serverConfig.servers;
    // Don't auto-select any server - wait for user input
    selectedServerId.value = null;
  } catch (error) {
    console.error('Failed to load server config:', error);
  }
});

const handleConnect = async () => {
  isConnecting.value = true;
  error.value = null;

  // Determine which server to connect to
  let url = serverUrl.value;
  let targetServerId = 0; // Custom server by default

  // Check if a configured server is selected
  if (selectedServer.value) {
    url = selectedServer.value.url;
    targetServerId = selectedServer.value.id;
  }

  if (!url) {
    error.value = 'Please select a server or enter a custom URL';
    isConnecting.value = false;
    return;
  }

  // For custom servers, require a name
  if (targetServerId === 0 && !serverName.value.trim()) {
    error.value = 'Please enter a name for your custom server';
    isConnecting.value = false;
    return;
  }

  const details: NatsConnectionDetails = {
    serverUrl: url,
    user: '',
    password: ''
  };
  try {
    await $fetch('/api/connect', {
      method: 'POST',
      body: details,
    });
    setConnection(details);
    // Redirect to server-specific dashboard with full page reload
    // Use targetServerId (which is 0 for custom servers)
    // For custom servers, include the name in the URL
    let dashboardUrl = `/${targetServerId}/dashboard`;
    if (targetServerId === 0 && serverName.value.trim()) {
      dashboardUrl += `?serverName=${encodeURIComponent(serverName.value.trim())}`;
    }
    window.location.href = dashboardUrl;
  } catch (err: any) {
    // Extract error message from various possible error structures
    error.value = err.data?.statusMessage || err.statusMessage || err.message || 'Connection failed. Please check your server URL and try again.';
    showForm.value = true; // Show form on error
    console.error('Connection error:', err);
  } finally {
    isConnecting.value = false;
  }
};

// Auto-connect if NATS_URL is set in environment
if (shouldAutoConnect) {
  nextTick(async () => {
    await handleConnect();
  });
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-slate-900">
    <!-- Header with server navigation -->
    <header v-if="showForm && servers.length > 0" class="flex flex-shrink-0 items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-2 shadow-md">
      <div class="flex items-center space-x-3">
        <NatsIcon class="h-8 w-8 text-green-400" />
        <h1 class="text-xl font-semibold text-white">
          JetStream Explorer
        </h1>
      </div>
      <div class="flex items-center space-x-4">
        <div class="text-sm text-slate-400">
          Select Server:
        </div>
        <select
          v-model="selectedServerId"
          class="rounded-md bg-slate-700 border border-slate-600 px-3 py-1 text-sm text-slate-200 hover:bg-slate-600 focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400"
        >
          <option :value="null">Custom Server</option>
          <option v-for="server in servers" :key="server.id" :value="server.id">
            {{ server.name }}
          </option>
        </select>
      </div>
    </header>

    <!-- Main content area -->
    <div class="flex flex-grow items-center justify-center p-4">
      <!-- Auto-connecting loading screen -->
      <div v-if="isConnecting" class="w-full max-w-md text-center">
      <NatsIcon class="mx-auto h-20 w-20 text-green-400 animate-pulse" />
      <h1 class="mt-4 text-2xl font-bold text-white">
        Connecting to NATS...
      </h1>
      <p class="mt-2 text-slate-400 font-mono text-sm">
        {{ serverUrl }}
      </p>
      <SpinnerIcon class="mx-auto mt-6 h-10 w-10 animate-spin text-green-400" />
    </div>

    <!-- Connection form -->
    <div v-else-if="showForm" class="w-full max-w-md">
      <div class="mb-8 flex flex-col items-center text-center">
        <NatsIcon class="h-20 w-20 text-green-400" />
        <h1 class="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          NATS JetStream Explorer
        </h1>
        <p class="mt-2 text-slate-400">
          Connect to your JetStream instance to get started.
        </p>
      </div>

      <div class="rounded-lg bg-slate-800/50 p-8 shadow-2xl backdrop-blur-sm">
        <!-- Configured server selected - simple connect button -->
        <div v-if="selectedServer" class="space-y-6">
          <div class="text-center">
            <p class="text-slate-300 mb-2">Selected server:</p>
            <p class="text-xl font-semibold text-green-400">{{ selectedServer.name }}</p>
            <p class="text-sm text-slate-500 font-mono mt-1">{{ selectedServer.url }}</p>
          </div>
          <p v-if="error" class="text-sm text-red-400 text-center">{{ error }}</p>
          <UiButton @click="handleConnect" :disabled="isConnecting" class="w-full">
            <span v-if="isConnecting" class="flex items-center justify-center">
              <SpinnerIcon class="mr-2 h-5 w-5 animate-spin" />
              Connecting...
            </span>
            <span v-else>
              Connect to {{ selectedServer.name }}
            </span>
          </UiButton>
        </div>

        <!-- Custom server form -->
        <div v-else>
          <!-- Custom server hint -->
          <div v-if="needsCustomServer" class="mb-4 rounded-md bg-blue-500/10 border border-blue-500/30 p-3">
            <p class="text-sm text-blue-300">
              <span class="font-semibold">Custom Server Required:</span> Please enter your NATS server URL below to connect.
            </p>
          </div>

          <form @submit.prevent="handleConnect" class="space-y-6">
            <UiInput
              id="serverName"
              label="Server Name"
              type="text"
              v-model="serverName"
              placeholder="e.g., Production, Local Dev"
            />

            <UiInput
              id="serverUrl"
              label="Server URL"
              type="text"
              v-model="serverUrl"
              placeholder="e.g., nats://user:pass@localhost:4222"
            />
            <p v-if="error" class="text-sm text-red-400">{{ error }}</p>
            <UiButton type="submit" :disabled="isConnecting" class="w-full">
              <span v-if="isConnecting" class="flex items-center justify-center">
                <SpinnerIcon class="mr-2 h-5 w-5 animate-spin" />
                Connecting...
              </span>
              <span v-else>
                Connect
              </span>
            </UiButton>
          </form>
        </div>
      </div>

      <div class="mt-8 rounded-lg border border-green-400/30 bg-green-400/10 p-4 text-center text-sm text-green-300">
        <p>
          <span class="font-bold">Ready to connect:</span> Enter your NATS server details above to explore your JetStream streams, consumers, and messages.
        </p>
      </div>
    </div>
    </div>
  </div>
</template>