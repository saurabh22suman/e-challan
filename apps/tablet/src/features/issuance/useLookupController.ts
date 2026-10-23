import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type RegistryLookupField,
  type RegistryLookupResponse,
  RegistryLookupResponseSchema,
  REGISTRY_LOOKUP_MIN_CHARACTERS,
} from '@echallan/contracts';
import { authorisedFetch } from '../../auth/api';

/**
 * Registry lookup controller.
 *
 * The controller owns a per-generation token and an AbortController so every
 * obsolete lookup is dropped before its response can update the UI:
 *
 *  - typing below the three-character threshold starts no search;
 *  - `startList` fetches the session location's registered vehicles with an
 *    empty query (B-08 vehicle dropdown), immediately and without debounce;
 *  - a new query, a new list request, a match selection, route/session exit or
 *    a manual reset() call all abort the in-flight fetch and advance the
 *    generation, so a late result cannot surface a stale `list`, `results`,
 *    `empty` or `error` state;
 *  - retry re-runs the in-flight request kind (search or list) unchanged.
 *
 * The hook consumes the shared {@link RegistryLookupResponseSchema}; a
 * malformed or unexpected body becomes `error`, never a fake suggestion.
 */

export type LookupState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'list'; matches: RegistryLookupResponse['matches'] }
  | { kind: 'results'; matches: RegistryLookupResponse['matches'] }
  | { kind: 'empty' }
  | { kind: 'error' };

export type LookupFetcher = (path: string, init?: RequestInit) => Promise<Response>;

interface UseLookupControllerArgs {
  fetchPath: (field: RegistryLookupField, query: string) => string;
  fetcher?: LookupFetcher;
  debounceMs?: number;
}

interface Inflight {
  generation: number;
  controller: AbortController;
  timer: ReturnType<typeof setTimeout>;
  /** True when this request is the location list, not a three-char search. */
  listing: boolean;
}

export interface LookupController {
  lookup: LookupState;
  field: RegistryLookupField | null;
  query: string;
  /** Which request the current state belongs to: none, a search or the list. */
  request: 'none' | 'search' | 'list';
  start(field: RegistryLookupField, value: string): void;
  /** Fetch the session location's registered vehicles (empty query, list mode). */
  startList(field: RegistryLookupField): void;
  triggerNow(): void;
  reset(): void;
  inflightController(): AbortController | null;
}

export function useLookupController({
  fetchPath,
  fetcher,
  debounceMs = 300,
}: UseLookupControllerArgs): LookupController {
  const [state, setState] = useState<LookupState>({ kind: 'idle' });
  const [field, setField] = useState<RegistryLookupField | null>(null);
  const [request, setRequest] = useState<'none' | 'search' | 'list'>('none');
  const [query, setQuery] = useState('');
  const inflightRef = useRef<Inflight | null>(null);
  const generationRef = useRef(0);
  const fetchRef = useRef<LookupFetcher>(fetcher ?? ((path, init) => authorisedFetch(path, init)));

  if (fetcher !== undefined) fetchRef.current = fetcher;

  const abortCurrent = useCallback(() => {
    const current = inflightRef.current;
    if (current === null) return;
    clearTimeout(current.timer);
    if (!current.controller.signal.aborted) current.controller.abort();
    inflightRef.current = null;
  }, []);

  const runFetch = useCallback(
    (
      fld: RegistryLookupField,
      trimmed: string,
      generation: number,
      controller: AbortController,
      listing: boolean,
    ) => {
      const path = fetchPath(fld, trimmed);
      const promise = (async () => {
        let response: Response;
        try {
          response = await fetchRef.current(path, { signal: controller.signal });
        } catch (error) {
          if (
            error instanceof DOMException &&
            error.name === 'AbortError' &&
            generation !== generationRef.current
          ) {
            return;
          }
          if (generation !== generationRef.current) return;
          setState({ kind: 'error' });
          return;
        }
        if (generation !== generationRef.current) return;
        if (!response.ok) {
          setState({ kind: 'error' });
          return;
        }
        try {
          const body = (await response.json()) as unknown;
          if (generation !== generationRef.current) return;
          const parsed = RegistryLookupResponseSchema.safeParse(body);
          if (!parsed.success) {
            setState({ kind: 'error' });
            return;
          }
          if (listing) {
            setState({ kind: 'list', matches: parsed.data.matches });
            return;
          }
          setState(
            parsed.data.matches.length === 0
              ? { kind: 'empty' }
              : { kind: 'results', matches: parsed.data.matches },
          );
        } catch {
          if (generation !== generationRef.current) return;
          setState({ kind: 'error' });
        }
      })();
      void promise;
    },
    [fetchPath],
  );

  const start = useCallback(
    (fld: RegistryLookupField, value: string) => {
      abortCurrent();
      generationRef.current += 1;
      const generation = generationRef.current;
      const trimmed = value.trim();
      setField(fld);
      setQuery(trimmed);
      if (trimmed.length < REGISTRY_LOOKUP_MIN_CHARACTERS) {
        setRequest('none');
        setState({ kind: 'idle' });
        return;
      }
      setRequest('search');
      setState({ kind: 'loading' });
      const controller = new AbortController();
      const timer = setTimeout(() => {
        if (generation === generationRef.current) {
          runFetch(fld, trimmed, generation, controller, false);
        }
      }, debounceMs);
      inflightRef.current = { generation, controller, timer, listing: false };
    },
    [abortCurrent, debounceMs, runFetch],
  );

  const startList = useCallback(
    (fld: RegistryLookupField) => {
      abortCurrent();
      generationRef.current += 1;
      const generation = generationRef.current;
      setField(fld);
      setRequest('list');
      setQuery('');
      setState({ kind: 'loading' });
      const controller = new AbortController();
      const timer = setTimeout(() => {
        if (generation === generationRef.current) {
          runFetch(fld, '', generation, controller, true);
        }
      }, 0);
      inflightRef.current = { generation, controller, timer, listing: true };
    },
    [abortCurrent, runFetch],
  );

  const triggerNow = useCallback(() => {
    const current = inflightRef.current;
    if (current === null) return;
    if (field === null) return;
    const trimmed = query;
    if (!current.listing && trimmed.length < REGISTRY_LOOKUP_MIN_CHARACTERS) return;
    clearTimeout(current.timer);
    runFetch(field, trimmed, current.generation, current.controller, current.listing);
  }, [field, query, runFetch]);

  const reset = useCallback(() => {
    abortCurrent();
    generationRef.current += 1;
    setState({ kind: 'idle' });
    setField(null);
    setRequest('none');
    setQuery('');
  }, [abortCurrent]);

  useEffect(() => () => abortCurrent(), [abortCurrent]);

  const inflightController = useCallback(() => inflightRef.current?.controller ?? null, []);

  return {
    lookup: state,
    field,
    query,
    request,
    start,
    startList,
    triggerNow,
    reset,
    inflightController,
  };
}
