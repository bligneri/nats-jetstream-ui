<script setup lang="ts">
import { ref } from 'vue';
import type { NatsConnectionDetails } from '~/types';
import NatsIcon from '~/components/icons/NatsIcon.vue';
import SpinnerIcon from '~/components/icons/SpinnerIcon.vue';
import UiButton from '~/components/ui/Button.vue';
import UiInput from '~/components/ui/Input.vue';

const { setConnection } = useNatsConnection();
const router = useRouter();

const serverUrl = ref('nats://localhost:4222');
const user = ref('');
const password = ref('');
const isConnecting = ref(false);
const error = ref<string | null>(null);

const handleConnect = async () => {
  isConnecting.value = true;
  error.value = null;
  const details: NatsConnectionDetails = {
    serverUrl: serverUrl.value,
    user: user.value,
    password: password.value
  };
  try {
    await $fetch('/api/connect', {
      method: 'POST',
      body: details,
    });
    setConnection(details);
    router.push('/dashboard');
  } catch (err: any) {
    error.value = err.data?.statusMessage || 'An unknown error occurred.';
  } finally {
    isConnecting.value = false;
  }
};
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-4">
    <div class="w-full max-w-md">
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
          <UiInput
            id="serverUrl"
            label="Server URL"
            type="text"
            v-model="serverUrl"
            required
            placeholder="e.g., nats://localhost:4222"
          />
          <div class="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
            <UiInput
              id="user"
              label="Username"
              type="text"
              v-model="user"
              placeholder="(Optional)"
            />
            <UiInput
              id="password"
              label="Password"
              type="password"
              v-model="password"
              placeholder="(Optional)"
            />
          </div>
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

      <div class="mt-8 rounded-lg border border-yellow-400/30 bg-yellow-400/10 p-4 text-center text-sm text-yellow-300">
        <p>
          <span class="font-bold">UI Demonstration:</span> This application uses mock data.
          A backend proxy is required to connect to a live NATS server from a web browser.
        </p>
      </div>
    </div>
  </div>
</template>