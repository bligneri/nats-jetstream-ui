import {
  NatsConnectionDetails,
  StreamInfo,
  ConsumerInfo,
  NatsMessage,
  StorageType,
  RetentionPolicy,
  AckPolicy,
} from "~/types";

// Mock Data
const mockStreams: StreamInfo[] = [
  {
    config: {
      name: "ORDERS",
      subjects: ["ORDERS.*"],
      retention: RetentionPolicy.Limits,
      max_consumers: -1,
      max_msgs: 1000000,
      max_bytes: 1073741824,
      max_age: 0,
      storage: StorageType.File,
      num_replicas: 1,
    },
    state: {
      messages: 1256,
      bytes: 876543,
      first_seq: 1,
      last_seq: 1256,
      consumer_count: 2,
    },
    created: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    config: {
      name: "EVENTS",
      subjects: ["EVENTS.eu-west-1.*", "EVENTS.us-east-1.*"],
      retention: RetentionPolicy.Interest,
      max_consumers: -1,
      max_msgs: -1,
      max_bytes: -1,
      max_age: 604800000000000, // 1 week in ns
      storage: StorageType.Memory,
      num_replicas: 3,
    },
    state: {
      messages: 8432,
      bytes: 4567890,
      first_seq: 2001,
      last_seq: 10433,
      consumer_count: 1,
    },
    created: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    config: {
      name: "ANALYTICS",
      subjects: ["ANALYTICS.ingest.>", "ANALYTICS.processed.tier1"],
      retention: RetentionPolicy.WorkQueue,
      max_consumers: 5,
      max_msgs: 5000,
      max_bytes: 52428800,
      max_age: 0,
      storage: StorageType.File,
      num_replicas: 1,
    },
    state: {
      messages: 489,
      bytes: 123456,
      first_seq: 1,
      last_seq: 489,
      consumer_count: 3,
    },
    created: new Date().toISOString(),
  },
];

const mockConsumers: { [streamName: string]: ConsumerInfo[] } = {
  ORDERS: [
    {
      stream_name: "ORDERS",
      name: "order-processor",
      config: {
        durable_name: "order-processor",
        ack_policy: AckPolicy.Explicit,
        ack_wait: 30000000000,
        max_deliver: 5,
        filter_subject: "ORDERS.created",
        replay_policy: "instant",
      },
      created: new Date().toISOString(),
      num_ack_pending: 5,
      num_redelivered: 1,
      num_waiting: 10,
    },
    {
      stream_name: "ORDERS",
      name: "order-auditor",
      config: {
        durable_name: "order-auditor",
        ack_policy: AckPolicy.All,
        ack_wait: 60000000000,
        max_deliver: -1,
        filter_subject: "ORDERS.*",
        replay_policy: "original",
      },
      created: new Date(Date.now() - 86400000).toISOString(),
      num_ack_pending: 0,
      num_redelivered: 0,
      num_waiting: 0,
    },
  ],
  EVENTS: [
    {
      stream_name: "EVENTS",
      name: "realtime-dashboard",
      config: {
        ack_policy: AckPolicy.None,
        ack_wait: 0,
        max_deliver: 1,
        filter_subject: "EVENTS.eu-west-1.>",
        replay_policy: "instant",
      },
      created: new Date().toISOString(),
      num_ack_pending: 0,
      num_redelivered: 0,
      num_waiting: 120,
    },
  ],
  ANALYTICS: [],
};

const mockMessages: { [subject: string]: NatsMessage[] } = {
  "ORDERS.created": Array.from({ length: 50 }, (_, i) => ({
    seq: 1256 - i,
    subject: "ORDERS.created",
    data: Buffer.from(
      JSON.stringify({
        orderId: `ORD-${1256 - i}`,
        amount: (Math.random() * 100).toFixed(2),
        currency: "USD",
      }),
    ).toString("base64"),
    headers: {
      "Content-Type": ["application/json"],
      "Trace-Id": [`trace-${Math.random().toString(36).substr(2, 9)}`],
    },
    time: new Date(Date.now() - i * 5000).toISOString(),
  })),
  "ORDERS.*": Array.from({ length: 50 }, (_, i) => ({
    seq: 1256 - i,
    subject: "ORDERS.created",
    data: Buffer.from(
      JSON.stringify({
        orderId: `ORD-${1256 - i}`,
        amount: (Math.random() * 100).toFixed(2),
        currency: "USD",
      }),
    ).toString("base64"),
    headers: {
      "Content-Type": ["application/json"],
      "Trace-Id": [`trace-${Math.random().toString(36).substr(2, 9)}`],
    },
    time: new Date(Date.now() - i * 5000).toISOString(),
  })),
  "EVENTS.eu-west-1.*": Array.from({ length: 20 }, (_, i) => ({
    seq: 10433 - i,
    subject: "EVENTS.eu-west-1.user_login",
    data: Buffer.from(
      JSON.stringify({ userId: `user-${100 + i}`, ip: `192.168.1.${i}` }),
    ).toString("base64"),
    time: new Date(Date.now() - i * 2000).toISOString(),
  })),
  "ANALYTICS.ingest.*": [],
};

const simulateDelay = <T>(data: T, delay = 500): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), delay));

const simulateError = (message: string, delay = 500): Promise<never> =>
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error(message)), delay),
  );

export class NatsService {
  connect(details: NatsConnectionDetails): Promise<void> {
    console.log("Attempting to connect with:", details);
    if (details.serverUrl.includes("fail")) {
      return simulateError("Connection failed: Invalid server credentials.");
    }
    return simulateDelay(undefined, 1000);
  }

  getStreams(): Promise<StreamInfo[]> {
    return simulateDelay(mockStreams);
  }

  getConsumers(streamName: string): Promise<ConsumerInfo[]> {
    return simulateDelay(mockConsumers[streamName] || []);
  }

  getMessages(subject: string): Promise<NatsMessage[]> {
    return simulateDelay(mockMessages[subject] || []);
  }
}

export const natsService = new NatsService();
