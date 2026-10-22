export type OperationRequestEvent =
  | { type: 'start'; id: string }
  | { type: 'end'; id: string };

type OperationRequestListener = (event: OperationRequestEvent) => void;

const listeners = new Set<OperationRequestListener>();
let nextRequestId = 0;

export const subscribeToOperationRequests = (listener: OperationRequestListener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const startOperationRequest = () => {
  const id = `operation-${++nextRequestId}`;
  listeners.forEach(listener => listener({ type: 'start', id }));
  return id;
};

export const finishOperationRequest = (id: string | undefined) => {
  if (!id) return;
  listeners.forEach(listener => listener({ type: 'end', id }));
};

export const installFetchOperationTracking = () => {
  const trackedWindow = window as Window & { __umsFetchTrackingInstalled?: boolean };
  if (trackedWindow.__umsFetchTrackingInstalled) return;

  const originalFetch = window.fetch.bind(window);
  trackedWindow.__umsFetchTrackingInstalled = true;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toLowerCase();
    const requestId = ['post', 'put', 'patch', 'delete'].includes(method)
      ? startOperationRequest()
      : undefined;
    try {
      return await originalFetch(input, init);
    } finally {
      finishOperationRequest(requestId);
    }
  };
};
