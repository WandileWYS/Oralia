import { useCallback, useEffect, useState } from 'react';
import type { z } from 'zod';
import type { catalogSchema } from '../types/api';
import { api } from '../lib/api';

export function useDatabaseCatalog(filters?:{collection?:string;language?:string}, revisionKey:unknown=0) {
  const filterKey=JSON.stringify(filters||{});
  const [state, setState] = useState<{ data: z.infer<typeof catalogSchema> | null; error: string; pending: boolean; key:string }>({ key:filterKey,data: null, error: '', pending: true });
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => {
    setState(current => ({ ...current, error: '', pending: true }));
    setRevision(value => value + 1);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setState(current=>({...current,data:filters?null:current.data,pending:true,error:''}));
    api.catalog(controller.signal,filters).then(data => {
      if (!controller.signal.aborted) setState({ key:filterKey,data, error: '', pending: false });
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setState(current => ({ ...current, key:filterKey,pending: false, error: reason instanceof Error ? reason.message : 'Could not load the collection.' }));
    });
    return () => controller.abort();
  }, [revision,filterKey,revisionKey]);
  const current=state.key===filterKey?state:{...state,data:null,pending:true,error:''};
  return { ...current, isLoading: current.pending && !current.data, isRefreshing: current.pending && !!current.data, retry };
}
