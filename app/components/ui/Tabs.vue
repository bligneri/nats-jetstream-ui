<script setup lang="ts">
import type { FunctionalComponent, VNode } from "vue";

export interface Tab {
    id: string;
    label: string;
    icon?: FunctionalComponent | VNode;
}

const props = defineProps<{
    tabs: Tab[];
    activeTab: string;
}>();

const emit = defineEmits(["update:activeTab"]);

function setActiveTab(id: string) {
    emit("update:activeTab", id);
}
</script>

<template>
    <div>
        <div class="sm:hidden">
            <label for="tabs" class="sr-only">Select a tab</label>
            <select
                id="tabs"
                name="tabs"
                class="block w-full rounded-md border-slate-600 bg-slate-800 py-2 pl-3 pr-10 text-base text-white focus:border-green-500 focus:outline-none focus:ring-green-500 sm:text-sm"
                :value="activeTab"
                @change="
                    setActiveTab(($event.target as HTMLSelectElement).value)
                "
            >
                <option v-for="tab in tabs" :key="tab.id" :value="tab.id">
                    {{ tab.label }}
                </option>
            </select>
        </div>
        <div class="hidden sm:block">
            <div class="border-b border-slate-700">
                <nav class="-mb-px flex space-x-4" aria-label="Tabs">
                    <button
                        v-for="tab in tabs"
                        :key="tab.id"
                        @click="setActiveTab(tab.id)"
                        :class="[
                            tab.id === activeTab
                                ? 'border-green-400 text-green-400'
                                : 'border-transparent text-slate-400 hover:border-slate-500 hover:text-slate-300',
                            'flex items-center space-x-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition',
                        ]"
                    >
                        <component v-if="tab.icon" :is="tab.icon" />
                        <span>{{ tab.label }}</span>
                    </button>
                </nav>
            </div>
        </div>
    </div>
</template>
