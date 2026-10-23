import { useCallback, useEffect, useState } from 'react';
import {
  MASTER_KINDS,
  type MasterKind,
  MasterListResponseSchema,
  type MasterRecord,
} from '@echallan/contracts';
import { API_PREFIX, authorisedFetch } from '../../auth/api';

/**
 * R5 catalogue controller.
 *
 * The catalogue is consumed via the shared {@link MasterListResponseSchema}
 * which proves each payload is a homogeneous {@link MasterKind} list and
 * (per F-03 M1) each record satisfies the strict per-kind refinement. A
 * malformed payload — wrong kind, missing severity for a violation, mixed
 * master variants — becomes a recoverable {@link CatalogueState.error} with
 * a Retry action, never silently trimmed options. Inactive records are
 * filtered here, so the rest of the app never has to.
 *
 * EM-01 fix: catalogue requests go through {@link authorisedFetch} so the
 * session token is attached; raw `fetch` was returning 401 against the
 * protected routes. The fetcher is still injectable for tests.
 */

export type CatalogueState =
  | { kind: 'loading' }
  | { kind: 'ready'; records: ReadonlyMap<MasterKind, ReadonlyArray<MasterRecord>> }
  | {
      kind: 'error';
      reason: 'network' | 'service_error' | 'invalid_contract' | 'unauthenticated';
      message: string;
    };

const KIND_PATH: Record<MasterKind, string> = {
  'violation-types': 'violation-types',
  departments: 'departments',
  contractors: 'contractors',
  locations: 'locations',
  gates: 'gates',
  'vehicle-types': 'vehicle-types',
};

type CatalogueFetcher = (path: string, init?: RequestInit) => Promise<Response>;

async function loadCatalogue(
  kind: MasterKind,
  fetcher: CatalogueFetcher,
): Promise<
  | { kind: 'ok'; records: MasterRecord[] }
  | { kind: 'network' | 'unauthenticated' | 'invalid_contract' }
  | { kind: 'service_error'; status: number }
> {
  let response: Response;
  try {
    response = await fetcher(`${API_PREFIX}/masters/${KIND_PATH[kind]}`);
  } catch {
    return { kind: 'network' };
  }
  if (response.status === 401 || response.status === 403) return { kind: 'unauthenticated' };
  if (!response.ok) return { kind: 'service_error', status: response.status };
  try {
    const body = (await response.json()) as unknown;
    const parsed = MasterListResponseSchema.safeParse(body);
    if (!parsed.success) return { kind: 'invalid_contract' };
    if (parsed.data.kind !== kind) return { kind: 'invalid_contract' };
    return { kind: 'ok', records: parsed.data.masters };
  } catch {
    return { kind: 'invalid_contract' };
  }
}

export function useCatalogues(args: { fetcher?: CatalogueFetcher } = {}): {
  state: CatalogueState;
  reload(): Promise<void>;
} {
  const fetcherRef = useState(() => args.fetcher ?? authorisedFetch)[0];
  const [state, setState] = useState<CatalogueState>({ kind: 'loading' });

  const reload = useCallback(async () => {
    setState({ kind: 'loading' });
    const map = new Map<MasterKind, ReadonlyArray<MasterRecord>>();
    let networkFailure = false;
    let serviceFailure = false;
    let unauthFailure = false;
    let invalidContract = false;
    let firstNetworkMessage = '';
    let firstServiceMessage = '';
    let firstUnauthMessage = '';
    let firstInvalidMessage = '';
    await Promise.all(
      MASTER_KINDS.map(async (kind) => {
        const result = await loadCatalogue(kind, fetcherRef);
        if (result.kind === 'ok') {
          map.set(
            kind,
            result.records.filter((record) => record.isActive),
          );
          return;
        }
        if (result.kind === 'network') {
          networkFailure = true;
          firstNetworkMessage = `Couldn't load ${kind}.`;
          return;
        }
        if (result.kind === 'service_error') {
          serviceFailure = true;
          if (firstServiceMessage === '') {
            firstServiceMessage = `Couldn't load ${kind}. The server returned an error (HTTP ${result.status}).`;
          }
          return;
        }
        if (result.kind === 'unauthenticated') {
          unauthFailure = true;
          firstUnauthMessage = 'Your session is no longer valid. Sign in again.';
          return;
        }
        invalidContract = true;
        firstInvalidMessage = `Catalogue response for ${kind} did not match the expected contract.`;
      }),
    );
    if (unauthFailure) {
      setState({ kind: 'error', reason: 'unauthenticated', message: firstUnauthMessage });
      return;
    }
    if (invalidContract) {
      setState({ kind: 'error', reason: 'invalid_contract', message: firstInvalidMessage });
      return;
    }
    if (serviceFailure) {
      setState({ kind: 'error', reason: 'service_error', message: firstServiceMessage });
      return;
    }
    if (networkFailure || map.size !== MASTER_KINDS.length) {
      setState({
        kind: 'error',
        reason: 'network',
        message: firstNetworkMessage || "Couldn't load master data.",
      });
      return;
    }
    setState({ kind: 'ready', records: map });
  }, [fetcherRef]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { state, reload };
}

/** Convenience selectors that tolerate a not-yet-loaded catalogue. */
export function selectMasters(
  state: CatalogueState,
  kind: MasterKind,
): ReadonlyArray<MasterRecord> {
  if (state.kind !== 'ready') return [];
  return state.records.get(kind) ?? [];
}
