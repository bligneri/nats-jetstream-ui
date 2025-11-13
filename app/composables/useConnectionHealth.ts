import { ref } from 'vue';

interface ConnectionError {
  message: string;
  timestamp: number;
  canRetry: boolean;
}

// Global state shared across all components
const connectionError = ref<ConnectionError | null>(null);
const isRetrying = ref(false);

export function useConnectionHealth() {
  const setConnectionError = (error: string, canRetry: boolean = true) => {
    connectionError.value = {
      message: error,
      timestamp: Date.now(),
      canRetry,
    };
  };

  const clearConnectionError = () => {
    connectionError.value = null;
  };

  const handleApiError = (error: any) => {
    // Extract error message from various possible structures
    const message = error.data?.statusMessage || error.statusMessage || error.message || 'Connection error';

    // Check if it's a connection-related error
    const isConnectionError =
      message.includes('CONNECTION_REFUSED') ||
      message.includes('Connection failed') ||
      message.includes('ECONNREFUSED') ||
      message.includes('Network') ||
      message.includes('fetch failed') ||
      message.includes('Not connected') ||
      error.statusCode === 502 ||
      error.statusCode === 503 ||
      error.statusCode === 504;

    if (isConnectionError) {
      setConnectionError(`Server connection lost: ${message}`, true);
    }

    return isConnectionError;
  };

  return {
    connectionError,
    isRetrying,
    setConnectionError,
    clearConnectionError,
    handleApiError,
  };
}
