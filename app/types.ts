export interface NatsConnectionDetails {
  serverUrl: string;
  user?: string;
  password?: string;
}

export enum StorageType {
  File = 'file',
  Memory = 'memory',
}

export enum RetentionPolicy {
  Limits = 'limits',
  Interest = 'interest',
  WorkQueue = 'workq',
}

export enum AckPolicy {
  None = 'none',
  All = 'all',
  Explicit = 'explicit',
}

export interface StreamConfig {
  name: string;
  subjects: string[];
  retention: RetentionPolicy;
  max_consumers: number;
  max_msgs: number;
  max_bytes: number;
  max_age: number; // in nanoseconds
  storage: StorageType;
  num_replicas: number;
}

export interface StreamState {
  messages: number;
  bytes: number;
  first_seq: number;
  last_seq: number;
  consumer_count: number;
  first_ts?: string; // ISO date string - timestamp of first message
  last_ts?: string; // ISO date string - timestamp of last message
}

export interface StreamInfo {
  config: StreamConfig;
  state: StreamState;
  created: string; // ISO date string
  // Virtual stream metadata (for source streams expanded by subject patterns)
  isVirtual?: boolean;
  parentStream?: string;
  virtualSubject?: string;
}

export interface ConsumerConfig {
  durable_name?: string;
  ack_policy: AckPolicy;
  ack_wait: number; // in nanoseconds
  max_deliver: number;
  filter_subject: string;
  replay_policy: string;
}

export interface ConsumerInfo {
  stream_name: string;
  name: string;
  config: ConsumerConfig;
  created: string; // ISO date string
  num_ack_pending: number;
  num_redelivered: number;
  num_waiting: number;
}

export interface NatsMessage {
  seq: number;
  subject: string;
  data: string; // base64 encoded
  headers?: { [key: string]: string[] };
  time: string; // ISO date string
}