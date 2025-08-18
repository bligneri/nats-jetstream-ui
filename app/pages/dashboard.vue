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
        function () {
            const { connection } = useNatsConnection();
            if (!connection.value) {
                return navigateTo("/");
            }
        },
    ],
});

const { connection, setConnection } = useNatsConnection();
const router = useRouter();

const streams = ref<StreamInfo[]>([]);
const selectedStream = ref<StreamInfo>();
const isLoading = ref(true);

onMounted(async () => {
    isLoading.value = true;
    try {
        const fetchedStreams = await $fetch<StreamInfo[]>("/api/streams");
        streams.value = fetchedStreams;
        if (fetchedStreams.length > 0) {
            selectedStream.value = fetchedStreams[0];
        }
    } catch (error) {
        console.error("Failed to fetch streams:", error);
    } finally {
        isLoading.value = false;
    }
});

const handleSelectStream = (stream: StreamInfo) => {
    selectedStream.value = stream;
};

const handleDisconnect = () => {
    setConnection(null);
    router.push("/");
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
                    Connected to
                    <span class="font-mono text-green-400">{{
                        connection?.serverUrl
                    }}</span>
                </div>
                <button
                    @click="handleDisconnect"
                    class="rounded-md bg-red-600 px-3 py-1 text-sm font-semibold text-white transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-800"
                >
                    Disconnect
                </button>
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
