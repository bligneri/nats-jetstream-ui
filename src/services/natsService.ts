
import type { Stream, Consumer, Message } from '../types';

const MOCK_STREAMS: Stream[] = [
  {
    config: {
      name: 'ORDERS',
      subjects: ['ORDERS.new', 'ORDERS.updated', 'ORDERS.shipped'],
      retention: 'Limits',
      storage: 'File',
      replicas: 3,
      max_msgs: 1000000,
      max_bytes: 1073741824, // 1 GB
      max_age: '7d',
    },
    state: {
      messages: 15234,
      bytes: 8092345,
      first_seq: 1,
      last_seq: 15234,
      consumer_count: 3,
    },
    created: '2023-10-26T10:00:00Z',
  },
  {
    config: {
      name: 'INVENTORY',
      subjects: ['INVENTORY.adjustments.*'],
      retention: 'Interest',
      storage: 'File',
      replicas: 3,
      max_msgs: 500000,
      max_bytes: 536870912, // 512 MB
      max_age: '30d',
    },
    state: {
      messages: 7890,
      bytes: 2345678,
      first_seq: 1001,
      last_seq: 8891,
      consumer_count: 2,
    },
    created: '2023-10-25T14:30:00Z',
  },
  {
    config: {
      name: 'USER_EVENTS',
      subjects: ['USERS.login', 'USERS.logout', 'USERS.signup'],
      retention: 'WorkQueue',
      storage: 'Memory',
      replicas: 1,
      max_msgs: -1,
      max_bytes: -1,
      max_age: '1h',
    },
    state: {
      messages: 102,
      bytes: 54321,
      first_seq: 5000,
      last_seq: 5102,
      consumer_count: 1,
    },
    created: '2023-10-27T08:00:00Z',
  },
];

const MOCK_CONSUMERS: { [key: string]: Consumer[] } = {
  ORDERS: [
    {
      stream_name: 'ORDERS',
      name: 'order-processor',
      config: { durable_name: 'order-processor', ack_policy: 'Explicit' },
      seq: { stream_seq: 15230, consumer_seq: 15200 },
      num_pending: 4,
      num_ack_pending: 2,
      created: '2023-10-26T10:05:00Z',
    },
    {
      stream_name: 'ORDERS',
      name: 'analytics-service',
      config: { durable_name: 'analytics', ack_policy: 'All' },
      seq: { stream_seq: 15234, consumer_seq: 15234 },
      num_pending: 0,
      num_ack_pending: 0,
      created: '2023-10-26T11:00:00Z',
    },
    {
      stream_name: 'ORDERS',
      name: 'shipping-notifier',
      config: { durable_name: 'notifier', ack_policy: 'Explicit', filter_subject: 'ORDERS.shipped' },
      seq: { stream_seq: 15200, consumer_seq: 450 },
      num_pending: 0,
      num_ack_pending: 10,
      created: '2023-10-26T12:00:00Z',
    },
  ],
  INVENTORY: [
    {
      stream_name: 'INVENTORY',
      name: 'stock-updater',
      config: { durable_name: 'stock-updater', ack_policy: 'Explicit' },
      seq: { stream_seq: 8891, consumer_seq: 7890 },
      num_pending: 0,
      num_ack_pending: 0,
      created: '2023-10-25T15:00:00Z',
    },
    {
        stream_name: 'INVENTORY',
        name: 'audit-log',
        config: { durable_name: 'audit', ack_policy: 'All' },
        seq: { stream_seq: 8891, consumer_seq: 7890 },
        num_pending: 0,
        num_ack_pending: 0,
        created: '2023-10-25T16:00:00Z',
    }
  ],
  USER_EVENTS: [
    {
        stream_name: 'USER_EVENTS',
        name: 'session-tracker',
        config: { durable_name: 'session-tracker', ack_policy: 'Explicit' },
        seq: { stream_seq: 5102, consumer_seq: 102 },
        num_pending: 5,
        num_ack_pending: 3,
        created: '2023-10-27T08:05:00Z',
    }
  ]
};

const MOCK_MESSAGES: { [key: string]: Message[] } = {
  ORDERS: [
    { seq: 15231, subject: 'ORDERS.new', data: '{ "orderId": "xyz-123", "amount": 99.99 }', time: new Date(Date.now() - 10000).toISOString() },
    { seq: 15232, subject: 'ORDERS.updated', data: '{ "orderId": "abc-456", "status": "processing" }', time: new Date(Date.now() - 8000).toISOString() },
    { seq: 15233, subject: 'ORDERS.shipped', data: '{ "orderId": "def-789", "tracking": "1Z..." }', time: new Date(Date.now() - 5000).toISOString() },
    { seq: 15234, subject: 'ORDERS.new', data: '{ "orderId": "ghi-012", "amount": 12.50 }', time: new Date(Date.now() - 2000).toISOString() },
  ],
  USER_EVENTS: [
    { seq: 5100, subject: 'USERS.login', data: '{ "userId": "user-1", "timestamp": "..." }', time: new Date(Date.now() - 60000).toISOString() },
    { seq: 5101, subject: 'USERS.login', data: '{ "userId": "user-2", "timestamp": "..." }', time: new Date(Date.now() - 45000).toISOString() },
    { seq: 5102, subject: 'USERS.logout', data: '{ "userId": "user-1", "timestamp": "..." }', time: new Date(Date.now() - 30000).toISOString() },
  ]
};

const delay = <T,>(data: T, ms = 500): Promise<T> => 
  new Promise(resolve => setTimeout(() => resolve(data), ms));

export const getDashboardStats = async () => {
    const totalMessages = MOCK_STREAMS.reduce((acc, s) => acc + s.state.messages, 0);
    const totalConsumers = MOCK_STREAMS.reduce((acc, s) => acc + s.state.consumer_count, 0);
    return delay({
        streams: MOCK_STREAMS.length,
        consumers: totalConsumers,
        messages: totalMessages,
        serverStatus: 'Connected',
    });
};

export const getStreams = async (): Promise<Stream[]> => {
    return delay(MOCK_STREAMS);
};

export const getStreamDetails = async (streamName: string): Promise<Stream | undefined> => {
    return delay(MOCK_STREAMS.find(s => s.config.name === streamName));
};

export const getConsumersForStream = async (streamName: string): Promise<Consumer[]> => {
    return delay(MOCK_CONSUMERS[streamName] || []);
};

export const getPendingMessagesForStream = async (streamName: string, limit: number = 10): Promise<Message[]> => {
    return delay((MOCK_MESSAGES[streamName] || []).slice(-limit).reverse());
};