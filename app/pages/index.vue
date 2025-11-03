<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue';
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

onMounted(async () => {
  try {
    const serverConfig = await $fetch<any>('/api/servers');
    servers.value = serverConfig.servers;
    if (servers.value.length > 0 && !config.public.natsUrl) {
      selectedServerId.value = servers.value[0].id;
    }
  } catch (error) {
    console.error('Failed to load server config:', error);
  }
});

const serverUrl = ref(config.public.natsUrl || '');

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

// Check if user manually disconnected (came from dashboard)
const manualDisconnect = ref(route.query.disconnected === 'true');

// Start in connecting state if auto-connect is configured AND not manually disconnected
const shouldAutoConnect = !!config.public.natsUrl && !manualDisconnect.value;
const isConnecting = ref(shouldAutoConnect);
const error = ref<string | null>(null);
const showForm = ref(!shouldAutoConnect);

const handleConnect = async () => {
  isConnecting.value = true;
  error.value = null;

  // Determine which server to connect to
  let url = serverUrl.value;
  let targetServerId = 0; // Custom server by default

  if (!url && selectedServerId.value) {
    // Use selected server from dropdown
    const server = servers.value.find(s => s.id === selectedServerId.value);
    if (server) {
      url = server.url;
      targetServerId = server.id;
    }
  }

  if (!url) {
    error.value = 'Please select a server or enter a custom URL';
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
    const dashboardUrl = `/${targetServerId || selectedServerId.value || 1}/dashboard`;
    window.location.href = dashboardUrl;
  } catch (err: any) {
    error.value = err.data?.statusMessage || 'An unknown error occurred.';
    showForm.value = true; // Show form on error
  } finally {
    isConnecting.value = false;
  }
};

// Auto-connect if NATS_URL is set in environment AND not manually disconnected
if (shouldAutoConnect) {
  nextTick(async () => {
    await handleConnect();
  });
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-4">
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
        <form @submit.prevent="handleConnect" class="space-y-6">
          <!-- Server Selection -->
          <div v-if="servers.length > 0">
            <label for="server-select" class="block text-sm font-medium text-slate-300 mb-2">Select Server</label>
            <select
              id="server-select"
              v-model="selectedServerId"
              class="w-full rounded-md bg-slate-700 border border-slate-600 px-3 py-2 text-slate-200 focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400"
            >
              <option v-for="server in servers" :key="server.id" :value="server.id">
                {{ server.name }} ({{ server.url }})
              </option>
            </select>
          </div>

          <div class="text-center text-sm text-slate-500">— or —</div>

          <UiInput
            id="serverUrl"
            label="Custom Server URL"
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

      <div class="mt-8 rounded-lg border border-green-400/30 bg-green-400/10 p-4 text-center text-sm text-green-300">
        <p>
          <span class="font-bold">Ready to connect:</span> Enter your NATS server details above to explore your JetStream streams, consumers, and messages.
        </p>
      </div>
    </div>
  </div>
</template>