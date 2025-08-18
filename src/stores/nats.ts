import { defineStore } from 'pinia';
import { getDashboardStats, getStreams } from '../services/natsService';
import type { Stream } from '../types';

interface DashboardStats {
  streams: number;
  consumers: number;
  messages: number;
  serverStatus: string;
}

interface NatsState {
  streams: Stream[];
  stats: DashboardStats | null;
  loading: {
    streams: boolean;
    stats: boolean;
  };
}

export const useNatsStore = defineStore('nats', {
  state: (): NatsState => ({
    streams: [],
    stats: null,
    loading: {
      streams: false,
      stats: false,
    },
  }),

  getters: {
    getStreamByName: (state) => {
      return (name: string): Stream | undefined => {
        return state.streams.find(stream => stream.config.name === name);
      };
    },
  },

  actions: {
    async fetchDashboardStats() {
      this.loading.stats = true;
      try {
        this.stats = await getDashboardStats();
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
      } finally {
        this.loading.stats = false;
      }
    },
    async fetchStreams() {
      this.loading.streams = true;
      try {
        this.streams = await getStreams();
      } catch (error) {
        console.error('Failed to fetch streams:', error);
      } finally {
        this.loading.streams = false;
      }
    },
  },
});
