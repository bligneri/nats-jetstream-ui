import type { NatsConnectionDetails } from '~/types';
import { useState } from '#app';

export const useNatsConnection = () => {
  const connection = useState<NatsConnectionDetails | null>('nats-connection', () => null);
  
  const setConnection = (details: NatsConnectionDetails | null) => {
    connection.value = details;
  };
  
  return {
    connection,
    setConnection
  };
};