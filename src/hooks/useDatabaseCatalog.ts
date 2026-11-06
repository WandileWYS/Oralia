import { useCallback, useEffect, useState } from 'react';
import type { z } from 'zod';
import type { catalogSchema } from '../types/api';
import { api } from '../lib/api';

export function useDatabaseCatalog() {
  const [state, setState] = useState<{ data: z.infer<typeof catalogSchema> | null; error: string; pending: boolean }>({ data: null, error: '', pending: true });
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => {
    setState(current => ({ ...current, error: '', pending: true }));
    setRevision(value => value + 1);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    api.catalog(controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ data, error: '', pending: false });
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setState(current => ({ ...current, pending: false, error: reason instanceof Error ? reason.message : 'Could not load the collection.' }));
    });
    return () => controller.abort();
  }, [revision]);
  return { ...state, isLoading: state.pending && !state.data, isRefreshing: state.pending && !!state.data, retry };
}
