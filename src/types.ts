
export interface StreamConfig {
  name: string;
  subjects: string[];
  retention: 'Limits' | 'Interest' | 'WorkQueue';
  storage: 'File' | 'Memory';
  replicas: number;
  max_msgs: number;
  max_bytes: number;
  max_age: string; // e.g., "7d", "24h"
}

export interface StreamState {
  messages: number;
  bytes: number;
  first_seq: number;
  last_seq: number;
  consumer_count: number;
}

export interface Stream {
  config: StreamConfig;
  state: StreamState;
  created: string;
}

export interface ConsumerConfig {
  durable_name: string;
  ack_policy: 'Explicit' | 'All' | 'None';
  filter_subject?: string;
}

export interface ConsumerState {
  num_ack_pending: number;
  num_redelivered: number;
  num_waiting: number;
  num_pending: number;
}

export interface Consumer {
  stream_name: string;
  name: string;
  config: ConsumerConfig;
  seq: {
    stream_seq: number;
    consumer_seq: number;
  };
  num_pending: number;
  num_ack_pending: number;
  created: string;
}

export interface Message {
  seq: number;
  subject: string;
  data: string;
  time: string;
}