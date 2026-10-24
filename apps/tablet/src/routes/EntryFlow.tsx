import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import NativeSelect from '@mui/material/NativeSelect';
import OutlinedInput from '@mui/material/OutlinedInput';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  CapturedPhotoStoreSchema,
  ChallanCommitResponseSchema,
  ChallanPreviewResponseSchema,
  EntryValidationResponseSchema,
  MAX_PHOTOS,
  RegistryLookupResponseSchema,
  MIN_PHOTOS,
  RefusalSchema,
  REGISTRY_LOOKUP_MIN_CHARACTERS,
  REMARKS_MAX_LENGTH,
  VehicleNumberSchema,
  deriveChallanSeverity,
  isOtherLabel,
  type CapturedPhotoStore,
  type ChallanCommitResponse,
  type ChallanPreviewResponse,
  type Refusal,
  type RegistryLookupField,
  type RegistryMatch,
  type ResolutionActionCode,
  type SignaturePad as SignatureCapture,
} from '@echallan/contracts';
import {
  ActionButton,
  ErrorSummary,
  FONT_MONO,
  FormSection,
  challanStatusKind,
  Notice,
  SeverityChip,
  SPACING,
  StatusBadge,
  TOUCH_TARGET_MIN,
  tokens,
} from '@echallan/theme';
import { API_PREFIX, authorisedFetch } from '../auth/api';
import { useSession } from '../auth/session';
import { TABLET_DRAFT_STORAGE_KEY } from '../auth/unsentState';
import { setSyncState } from '../features/sync/syncStatus';
import {
  DRIVER_LANGUAGES,
  DRIVER_COPY,
  type DriverLanguage,
} from '../features/issuance/driverCopy';
import { MarshalCallout } from '../features/character/MarshalCharacter';
import type { CharacterKind } from '../features/character/characterAssets';
import { useCatalogues, selectMasters } from '../features/issuance/useCatalogues';
import { useLookupController } from '../features/issuance/useLookupController';
import { useDraftRevision } from '../features/issuance/useDraftRevision';
import { applyServerErrors } from '../features/issuance/serverErrors';
import { submitChallan, SubmitApiError } from '../features/issuance/submit';
import VehiclePicker from '../features/issuance/VehiclePicker';

const PhotoCapture = lazy(() => import('../features/photos/PhotoCapture.js'));
const SignaturePad = lazy(() => import('../features/signature/SignaturePad.js'));
const RefusalForm = lazy(() => import('../features/signature/RefusalForm.js'));

const ACTION_LABELS: Record<ResolutionActionCode, string> = {
  warning_issued: 'Warning issued',
  safety_counselling_completed: 'Safety counselling completed',
  referred_to_department_contractor: 'Referred to department/contractor',
  custom: 'Custom action',
};

interface MasterOption {
  id: string;
  label: string;
  severity?: string;
}

interface DraftState {
  vehicleRegistration: string;
  gatePassNumber: string;
  driverName: string;
  departmentId: string;
  contractorId: string;
  vehicleTypeId: string;
  violationTypeIds: string[];
  remarks: string;
  registry: { gatePassRecordId: string; driverId: string; vehicleId: string } | null;
}

interface StoredEntry {
  draft?: Partial<DraftState>;
  operationId?: string;
  issued?: unknown;
}

function readStoredEntry(): StoredEntry | null {
  try {
    const raw = window.sessionStorage.getItem(TABLET_DRAFT_STORAGE_KEY);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Record<string, unknown>;
    return {
      ...(typeof record['draft'] === 'object' && record['draft'] !== null
        ? { draft: record['draft'] as Partial<DraftState> }
        : {}),
      ...(typeof record['operationId'] === 'string' ? { operationId: record['operationId'] } : {}),
      ...(record['issued'] === undefined ? {} : { issued: record['issued'] }),
    };
  } catch {
    return null;
  }
}

const EMPTY_DRAFT: DraftState = {
  vehicleRegistration: '',
  gatePassNumber: '',
  driverName: '',
  departmentId: '',
  contractorId: '',
  vehicleTypeId: '',
  violationTypeIds: [],
  remarks: '',
  registry: null,
};

const EMPTY_PHOTO_STORE: CapturedPhotoStore = { acceptedCount: 0, photos: [] };

/** UUID for one submission operation; reused across retries. */
function newOperationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return '00000000-0000-4000-8000-' + Math.random().toString(16).slice(2, 14).padStart(12, '0');
}

const LOOKUP_DEBOUNCE_MS = 300;

/** Step strip: orients the marshal in the linear entry flow. */
const FLOW_STEPS = ['Enter details', 'Check details', 'Photos and signature'] as const;

/** Error-summary link targets, in display order (UXA-04). */
const ERROR_FIELD_IDS: Record<string, string> = {
  vehicleRegistration: 'vehicle-registration',
  gatePassNumber: 'gate-pass-number',
  driverName: 'driver-name',
  departmentId: 'master-department',
  contractorId: 'master-contractor',
  vehicleTypeId: 'master-vehicle-type',
  violationTypeIds: 'violations-group',
  remarks: 'remarks-input',
};
const ERROR_FIELD_ORDER = [
  'vehicleRegistration',
  'gatePassNumber',
  'driverName',
  'departmentId',
  'contractorId',
  'vehicleTypeId',
  'violationTypeIds',
  'remarks',
] as const;

export default function EntryFlow({
  language,
  onLanguageChange,
}: {
  language: DriverLanguage;
  onLanguageChange: (value: DriverLanguage) => void;
}) {
  const copy = DRIVER_COPY[language];
  const { identity } = useSession();
  const catalogues = useCatalogues();
  const storedEntryRef = useRef<StoredEntry | null | undefined>(undefined);
  if (storedEntryRef.current === undefined) storedEntryRef.current = readStoredEntry();
  const storedEntry = storedEntryRef.current;
  const [draft, setDraft] = useState<DraftState>(() => ({
    ...EMPTY_DRAFT,
    ...(storedEntry?.draft ?? {}),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [connectionFailure, setConnectionFailure] = useState(false);
  const [expiryNotice, setExpiryNotice] = useState<string | null>(null);
  const [vehicleMode, setVehicleMode] = useState<'registry' | 'new'>('registry');
  const [manualCarried, setManualCarried] = useState(false);
  const [pickerOpenSignal, setPickerOpenSignal] = useState(0);
  const [step, setStep] = useState<'form' | 'summary' | 'signature' | 'refusal'>('form');
  const [preview, setPreview] = useState<ChallanPreviewResponse | null>(null);
  const [previewGeneration, setPreviewGeneration] = useState(0);
  const [duplicatePending, setDuplicatePending] = useState(false);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const [duplicateAcknowledgedFor, setDuplicateAcknowledgedFor] = useState<number | null>(null);
  const [photoStore, setPhotoStore] = useState<CapturedPhotoStore>(EMPTY_PHOTO_STORE);
  const [reviewing, setReviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [recentMatches, setRecentMatches] = useState<RegistryMatch[]>([]);
  const [issued, setIssued] = useState<ChallanCommitResponse | null>(() => {
    const parsed = ChallanCommitResponseSchema.safeParse(storedEntry?.issued);
    return parsed.success ? parsed.data : null;
  });
  const [errorFocusNonce, setErrorFocusNonce] = useState(0);
  const [operationId, setOperationId] = useState<string>(
    storedEntry?.operationId ?? newOperationId(),
  );

  useEffect(() => {
    const postId = identity?.post?.id;
    if (postId === undefined) return;
    let cancelled = false;
    void authorisedFetch(`${API_PREFIX}/registry/recent`)
      .then(async (response) => {
        if (!response.ok) return null;
        return RegistryLookupResponseSchema.safeParse(await response.json());
      })
      .then((parsed) => {
        if (!cancelled && parsed !== null && parsed.success) setRecentMatches(parsed.data.matches);
      })
      .catch(() => {
        // Recent shortcuts are optional; the registry picker remains available.
      });
    return () => {
      cancelled = true;
    };
  }, [identity?.post?.id]);
  // R3: signature and refusal carry the summary revision under which
  // they were confirmed, so the parent can invalidate them when the
  // canonical summary changes.
  const [signature, setSignature] = useState<{
    capture: SignatureCapture;
    revision: string;
  } | null>(null);
  const [refusal, setRefusal] = useState<{ value: Refusal; revision: string } | null>(null);
  // CR-01 fix: live canonical references that survive across awaits. The
  // callback's `revision` variable is captured at render time, so it is
  // never fresh after an `await`. These refs are mutated by `materialChange`
  // and by a `useEffect` watching `revision`, so the async closure always
  // sees the most current state.
  const liveRevisionRef = useRef<string>('');
  const liveValidateRequestRef = useRef(0);
  const livePreviewRequestRef = useRef(0);
  const livePreviewRef = useRef<ChallanPreviewResponse | null>(null);
  // R6: single review-request token. Validation and preview share the
  // same counter; a new review, a material edit, or unmount bumps it.
  const reviewRequestRef = useRef(0);

  const lookup = useLookupController({
    debounceMs: LOOKUP_DEBOUNCE_MS,
    fetchPath: (field, query) =>
      `${API_PREFIX}/registry/lookup?field=${field}&q=${encodeURIComponent(query)}`,
  });

  const departments = useMemo<MasterOption[]>(
    () => selectMasters(catalogues.state, 'departments').map(toOption),
    [catalogues.state],
  );
  const contractors = useMemo<MasterOption[]>(
    () => selectMasters(catalogues.state, 'contractors').map(toOption),
    [catalogues.state],
  );
  const vehicleTypes = useMemo<MasterOption[]>(
    () => selectMasters(catalogues.state, 'vehicle-types').map(toOption),
    [catalogues.state],
  );
  const violationTypes = useMemo<MasterOption[]>(
    () => selectMasters(catalogues.state, 'violation-types').map(toOption),
    [catalogues.state],
  );

  const revision = useDraftRevision({
    draft: {
      vehicleRegistration: draft.vehicleRegistration,
      gatePassNumber: draft.gatePassNumber,
      driverName: draft.driverName,
      departmentId: draft.departmentId,
      contractorId: draft.contractorId,
      vehicleTypeId: draft.vehicleTypeId,
      violationTypeIds: draft.violationTypeIds,
      remarks: draft.remarks,
      registry: draft.registry,
    },
    preview,
    locationId: identity?.post?.id ?? 'unknown',
  }).revision;

  // CR-01: keep the live refs in sync with current state so async
  // closures compare against current state, not the render-time closure.
  liveRevisionRef.current = revision;
  livePreviewRef.current = preview;

  /**
   * R3: pure client validation for a candidate draft. `materialChange` reuses
   * it so an edited field is re-evaluated immediately instead of trusting a
   * cached error, while untouched fields keep their unresolved errors.
   */
  const computeClientErrors = useCallback(
    (candidate: DraftState): Record<string, string> => {
      const found: Record<string, string> = {};
      const otherChosen =
        isOtherSelected(departments, candidate.departmentId) ||
        isOtherSelected(vehicleTypes, candidate.vehicleTypeId) ||
        isOtherSelected(contractors, candidate.contractorId) ||
        violationTypes.some(
          (option) => candidate.violationTypeIds.includes(option.id) && isOtherLabel(option.label),
        );
      if (!/^[A-Z0-9]+$/u.test(candidate.vehicleRegistration.replace(/\s+/g, ''))) {
        found.vehicleRegistration = 'Vehicle number should look like GJ05DS4821 or 26BH1234AA';
      }
      if (candidate.gatePassNumber.trim() === '') {
        found.gatePassNumber = 'Gate pass number is required.';
      }
      if (candidate.driverName.trim() === '') found.driverName = 'Driver name is required.';
      if (candidate.departmentId === '') found.departmentId = 'Select a department.';
      if (candidate.vehicleTypeId === '') found.vehicleTypeId = 'Select a vehicle type.';
      if (candidate.violationTypeIds.length === 0) {
        found.violationTypeIds = 'Select at least one violation.';
      }
      if (otherChosen && candidate.remarks.trim() === '') {
        found.remarks = 'Remarks are required when Other is selected.';
      }
      return found;
    },
    [contractors, departments, vehicleTypes, violationTypes],
  );

  const materialChange = useCallback(
    (patch: Partial<DraftState>) => {
      const nextDraft = { ...draft, ...patch };
      setDraft(nextDraft);
      const touched = Object.keys(patch);
      // R3: retain unresolved errors for untouched fields and re-evaluate
      // touched fields against the new draft immediately.
      setErrors((previousErrors) => {
        const retained: Record<string, string> = {};
        for (const [field, message] of Object.entries(previousErrors)) {
          if (message !== '' && !touched.includes(field)) retained[field] = message;
        }
        const recomputed = computeClientErrors(nextDraft);
        for (const field of touched) {
          if (recomputed[field] !== undefined) retained[field] = recomputed[field];
        }
        return retained;
      });
      setSubmitError(null);
      setConnectionFailure(false);
      // R1: a superseded review is no longer pending; do not leave the
      // primary action disabled waiting on a stale completion.
      setReviewing(false);
      // CR-01 / CR-02: any material draft edit invalidates the in-flight
      // validation and preview requests by bumping the live generation
      // counters. The async closure will see the new value on its next
      // `await` and drop the stale response. We also clear the preview and
      // the duplicate acknowledgement so a re-preview is required before
      // advancing to the summary.
      liveValidateRequestRef.current += 1;
      livePreviewRequestRef.current += 1;
      // F3: the unified review-generation token covers validation AND
      // preview. A material edit invalidates the in-flight request
      // regardless of which phase it is in.
      reviewRequestRef.current += 1;
      setPreview(null);
      setDuplicateAcknowledged(false);
      setDuplicateAcknowledgedFor(null);
      setSignature(null);
      setRefusal(null);
      setCommitError(null);
      setOperationId(newOperationId());
    },
    [computeClientErrors, draft],
  );

  const lookupField = useCallback(
    (field: RegistryLookupField, patch: Partial<DraftState>, value: string) => {
      materialChange(patch);
      lookup.start(field, value);
    },
    [lookup, materialChange],
  );

  /**
   * B-08: the vehicle field is a searchable dropdown. Typing three or more
   * characters runs the existing debounced registry search; shorter input only
   * updates the text so the picker can filter its already-loaded list locally
   * (ENT-02: no request below three characters).
   */
  const handleVehicleText = useCallback(
    (value: string) => {
      materialChange({ vehicleRegistration: value });
      if (value.trim().length >= REGISTRY_LOOKUP_MIN_CHARACTERS) {
        lookup.start('registration', value);
      }
    },
    [lookup, materialChange],
  );

  const enterNewVehicle = useCallback(() => {
    setVehicleMode('new');
    // UXA-12: disclose carried values truthfully when a selection existed.
    setManualCarried(
      draft.registry !== null ||
        draft.gatePassNumber.trim() !== '' ||
        draft.driverName.trim() !== '' ||
        draft.departmentId !== '' ||
        draft.vehicleTypeId !== '',
    );
    materialChange({ registry: null });
    lookup.reset();
  }, [draft, lookup, materialChange]);

  const switchToRegistry = useCallback(() => {
    setVehicleMode('registry');
    setPickerOpenSignal((previous) => previous + 1);
  }, []);

  const normaliseRegistration = useCallback(() => {
    const parsed = VehicleNumberSchema.safeParse(draft.vehicleRegistration);
    if (parsed.success) {
      setDraft((previous) => ({ ...previous, vehicleRegistration: parsed.data }));
      setErrors((previous) => ({ ...previous, vehicleRegistration: '' }));
      return;
    }
    setErrors((previous) => ({
      ...previous,
      vehicleRegistration: parsed.error.issues[0]?.message ?? 'Enter a valid vehicle number.',
    }));
  }, [draft.vehicleRegistration]);

  const chooseMatch = useCallback(
    (match: RegistryMatch) => {
      const nextDraft: Partial<DraftState> = {
        vehicleRegistration: match.vehicleRegistrationNumber,
        gatePassNumber: match.gatePassNumber,
        driverName: match.driverName,
        departmentId: match.departmentId,
        contractorId: match.contractorId ?? '',
        vehicleTypeId: match.vehicleTypeId,
        registry: {
          gatePassRecordId: match.gatePassRecordId,
          driverId: match.driverId,
          vehicleId: match.vehicleId,
        },
      };
      materialChange(nextDraft);
      setVehicleMode('registry');
      setManualCarried(false);
      lookup.reset();
      setExpiryNotice(
        match.status === 'expired'
          ? `This gate pass expired on ${match.validUntil?.slice(0, 10) ?? 'an earlier date'}.`
          : null,
      );
    },
    [lookup, materialChange],
  );

  const selectedViolations = useMemo(
    () => violationTypes.filter((option) => draft.violationTypeIds.includes(option.id)),
    [violationTypes, draft.violationTypeIds],
  );

  // UXA-14: "Other" is shown last without changing ids or semantics.
  const orderedViolationTypes = useMemo(
    () =>
      [...violationTypes].sort(
        (a, b) => (isOtherLabel(a.label) ? 1 : 0) - (isOtherLabel(b.label) ? 1 : 0),
      ),
    [violationTypes],
  );

  const derivedSeverity = useMemo(() => {
    const severities = selectedViolations
      .map((option) => option.severity)
      .filter((value): value is string => value !== undefined);
    if (severities.length === 0) return null;
    try {
      return deriveChallanSeverity(severities);
    } catch {
      return null;
    }
  }, [selectedViolations]);

  const otherSelected = useMemo(
    () =>
      isOtherSelected(departments, draft.departmentId) ||
      isOtherSelected(vehicleTypes, draft.vehicleTypeId) ||
      isOtherSelected(contractors, draft.contractorId) ||
      selectedViolations.some((option) => isOtherLabel(option.label)),
    [departments, vehicleTypes, contractors, draft, selectedViolations],
  );

  const draftForApi = useCallback(
    () => ({
      vehicleRegistration: draft.vehicleRegistration,
      gatePassNumber: draft.gatePassNumber,
      driverName: draft.driverName,
      vehicleTypeId: draft.vehicleTypeId,
      departmentId: draft.departmentId,
      contractorId: draft.contractorId === '' ? null : draft.contractorId,
      violationTypeIds: draft.violationTypeIds,
      remarks: draft.remarks,
      registry: draft.registry,
    }),
    [draft],
  );

  const clientErrors = useCallback(
    (): Record<string, string> => computeClientErrors(draft),
    [computeClientErrors, draft],
  );

  /** UXA-04: one linked summary entry per unresolved validation error. */
  const errorItems = useMemo(
    () =>
      ERROR_FIELD_ORDER.filter((field) => (errors[field] ?? '') !== '').map((field) => ({
        id: ERROR_FIELD_IDS[field] ?? field,
        message: errors[field] ?? '',
      })),
    [errors],
  );

  const focusErrorField = useCallback((item: { id: string }) => {
    const element = document.getElementById(item.id);
    if (element instanceof HTMLElement) {
      element.focus();
      element.scrollIntoView?.({ block: 'center' });
    }
  }, []);

  const focusVehicleField = useCallback(() => {
    const element = document.getElementById('vehicle-registration');
    if (element instanceof HTMLElement) {
      element.focus();
      element.scrollIntoView?.({ block: 'center' });
    }
  }, []);

  // UXA-01: each stage change moves focus to its heading.
  useEffect(() => {
    const titleId =
      step === 'form'
        ? 'entry-flow-form'
        : step === 'summary'
          ? 'entry-flow-summary'
          : step === 'refusal'
            ? 'entry-flow-refusal'
            : 'entry-flow-signature';
    document.getElementById(titleId)?.focus();
  }, [step]);

  // UXA-04: a failed validation action focuses the linked summary.
  useEffect(() => {
    if (errorFocusNonce === 0) return;
    const summary = document.querySelector<HTMLElement>('[data-testid="error-summary"]');
    summary?.focus();
  }, [errorFocusNonce]);

  // R2 / EM-02: every async response checks the captured request generation
  // AND a live revision reference (resolved after every await) before
  // applying results. The captured revision is read after `await` rather
  // than from the closure, so a material edit / registry selection that
  // fires between request and response cannot be silently overwritten.
  // CR-01 follow-up: the legacy `validateRequestRef` / `previewRequestRef`
  // counters remain in state for diagnostic readability; the live refs are
  // the authoritative source for the async path.

  const reviewSummary = useCallback(async () => {
    setSubmitError(null);
    setConnectionFailure(false);
    const found = clientErrors();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      // UXA-04: focus the linked summary on every failed check.
      setErrorFocusNonce((previous) => previous + 1);
      return;
    }
    // R6: single-flight control. One review generation covers the
    // entire validation + preview chain. A new review, a material
    // edit, or an unmount bumps this counter; stale completions are
    // dropped on every await (including catch paths).
    reviewRequestRef.current += 1;
    const reviewRequest = reviewRequestRef.current;
    // V3: also bump the per-phase refs so an older preview or
    // validation response that resolves after a new review is
    // dropped at the live-ref comparison.
    liveValidateRequestRef.current += 1;
    livePreviewRequestRef.current += 1;
    setReviewing(true);
    try {
      const sentRevision = liveRevisionRef.current;
      const draftSnapshot = draftForApi();
      const acknowledgedAtStart = duplicateAcknowledged;

      let validateResult: Response;
      try {
        validateResult = await authorisedFetch(`${API_PREFIX}/challans/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftSnapshot),
        });
      } catch {
        if (reviewRequestRef.current === reviewRequest) {
          setSubmitError("Couldn't reach the API. Try again.");
          setConnectionFailure(true);
        }
        return;
      }
      if (reviewRequestRef.current !== reviewRequest) return;
      if (liveRevisionRef.current !== sentRevision) return;

      if (validateResult.status === 422) {
        let body: unknown;
        try {
          body = await validateResult.json();
        } catch {
          if (
            reviewRequestRef.current === reviewRequest &&
            liveRevisionRef.current === sentRevision
          ) {
            setSubmitError("Couldn't read the validation response.");
          }
          return;
        }
        if (reviewRequestRef.current !== reviewRequest) return;
        if (liveRevisionRef.current !== sentRevision) return;
        const display = applyServerErrors(body);
        setErrors(display.fieldErrors);
        setErrorFocusNonce((previous) => previous + 1);
        if (display.fallback !== null) setSubmitError(display.fallback);
        return;
      }
      if (!validateResult.ok) {
        if (
          reviewRequestRef.current === reviewRequest &&
          liveRevisionRef.current === sentRevision
        ) {
          setSubmitError("Couldn't validate the challan. Try again.");
        }
        return;
      }
      let validateBody: unknown;
      try {
        validateBody = await validateResult.json();
      } catch {
        if (
          reviewRequestRef.current === reviewRequest &&
          liveRevisionRef.current === sentRevision
        ) {
          setSubmitError('The API returned an unreadable validation response.');
        }
        return;
      }
      if (reviewRequestRef.current !== reviewRequest) return;
      if (liveRevisionRef.current !== sentRevision) return;
      const validationParsed = EntryValidationResponseSchema.safeParse(validateBody);
      if (!validationParsed.success) {
        if (
          reviewRequestRef.current === reviewRequest &&
          liveRevisionRef.current === sentRevision
        ) {
          setSubmitError('The API returned an unexpected validation response.');
        }
        return;
      }

      // V3: the preview check uses the same review-generation token as
      // the validation phase. An older preview response that resolves
      // after a new review is dropped here.
      const previewRequest = reviewRequest;
      let previewResult: Response;
      try {
        previewResult = await authorisedFetch(`${API_PREFIX}/challans/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draft: draftSnapshot,
            warningAcknowledged: acknowledgedAtStart,
          }),
        });
      } catch {
        if (livePreviewRequestRef.current === previewRequest) {
          setSubmitError("Couldn't reach the API. Try again.");
          setConnectionFailure(true);
        }
        return;
      }
      if (livePreviewRequestRef.current !== previewRequest) return;
      if (liveRevisionRef.current !== sentRevision) return;

      if (previewResult.status === 422) {
        let body: unknown;
        try {
          body = await previewResult.json();
        } catch {
          if (
            livePreviewRequestRef.current === previewRequest &&
            liveRevisionRef.current === sentRevision
          ) {
            setSubmitError("Couldn't read the preview response.");
          }
          return;
        }
        if (livePreviewRequestRef.current !== previewRequest) return;
        if (liveRevisionRef.current !== sentRevision) return;
        const display = applyServerErrors(body);
        setErrors(display.fieldErrors);
        setErrorFocusNonce((previous) => previous + 1);
        if (display.fallback !== null) setSubmitError(display.fallback);
        return;
      }
      if (!previewResult.ok) {
        if (
          livePreviewRequestRef.current === previewRequest &&
          liveRevisionRef.current === sentRevision
        ) {
          setSubmitError("Couldn't load the repeat check. Try again.");
        }
        return;
      }
      let previewBody: unknown;
      try {
        previewBody = await previewResult.json();
      } catch {
        if (
          livePreviewRequestRef.current === previewRequest &&
          liveRevisionRef.current === sentRevision
        ) {
          setSubmitError('The API returned an unreadable preview response.');
        }
        return;
      }
      if (livePreviewRequestRef.current !== previewRequest) return;
      if (liveRevisionRef.current !== sentRevision) return;
      const previewParsed = ChallanPreviewResponseSchema.safeParse(previewBody);
      if (!previewParsed.success) {
        if (
          livePreviewRequestRef.current === previewRequest &&
          liveRevisionRef.current === sentRevision
        ) {
          setSubmitError('The API returned an unexpected preview response.');
        }
        return;
      }

      // CR-02: only this preview is "current". If the duplicate-warning
      // information changed, the previously captured acknowledgement
      // (bound to a previous preview) must be invalidated.
      setPreview((previous) => {
        const changed =
          previous === null ||
          previous.severity !== previewParsed.data.severity ||
          previous.occurrenceNumber !== previewParsed.data.occurrenceNumber ||
          previous.recommendedAction !== previewParsed.data.recommendedAction ||
          previous.duplicateWarning.required !== previewParsed.data.duplicateWarning.required ||
          previous.duplicateWarning.matchedCount !==
            previewParsed.data.duplicateWarning.matchedCount;
        if (changed) {
          setDuplicateAcknowledged(false);
          setDuplicateAcknowledgedFor(null);
        }
        return previewParsed.data;
      });
      setPreviewGeneration((previous) => previous + 1);
      // V2: gate the summary transition on the full material-preview
      // change. A change in severity, occurrence, recommended action
      // or duplicate information requires renewed acknowledgement even
      // if the duplicate required/count is unchanged. The acknowledgement
      // is bound to the same review-generation token; editing the
      // draft, re-reviewing, or re-previewing all clear it.
      const previousPreview = livePreviewRef.current;
      const previewChangedFull =
        previousPreview === null ||
        previousPreview.severity !== previewParsed.data.severity ||
        previousPreview.occurrenceNumber !== previewParsed.data.occurrenceNumber ||
        previousPreview.recommendedAction !== previewParsed.data.recommendedAction ||
        previousPreview.duplicateWarning.required !==
          previewParsed.data.duplicateWarning.required ||
        previousPreview.duplicateWarning.matchedCount !==
          previewParsed.data.duplicateWarning.matchedCount;
      if (previewChangedFull) {
        setDuplicateAcknowledged(false);
        setDuplicateAcknowledgedFor(null);
      }
      if (previewParsed.data.duplicateWarning.required) {
        // V2: a material preview change (severity, occurrence,
        // recommended action, duplicate required/count) requires
        // renewed acknowledgement. The same duplicate information
        // carries over across re-reviews; an absent acknowledgement
        // also requires renewal. Re-binding to the current review
        // generation keeps the acknowledgement tied to the request
        // that produced the current preview.
        if (!acknowledgedAtStart || previewChangedFull) {
          setDuplicateAcknowledged(false);
          setDuplicateAcknowledgedFor(null);
          setDuplicatePending(true);
          return;
        }
        setDuplicateAcknowledgedFor(reviewRequest);
      }
      setDuplicatePending(false);
      setStep('summary');
    } finally {
      if (reviewRequestRef.current === reviewRequest) setReviewing(false);
    }
  }, [clientErrors, draftForApi, duplicateAcknowledged, duplicateAcknowledgedFor]);

  const proceedAfterDuplicate = useCallback(() => {
    // CR-02 fix: the warning Continue button may only advance to the
    // summary if a current, validated preview exists. The acknowledgement
    // is bound to the current preview generation; editing the draft or
    // producing a new preview invalidates it.
    if (preview === null) {
      setSubmitError('Review the summary to refresh the repeat check before continuing.');
      return;
    }
    if (preview.duplicateWarning.required !== true) {
      setDuplicateAcknowledged(false);
      setDuplicateAcknowledgedFor(null);
      setStep('summary');
      return;
    }
    if (!duplicateAcknowledged) return;
    setDuplicateAcknowledgedFor(previewGeneration);
    setDuplicatePending(false);
    setStep('summary');
  }, [preview, previewGeneration, duplicateAcknowledged]);

  const handleSignatureChange = useCallback(
    (capture: SignatureCapture | null) => {
      if (capture === null) {
        setSignature(null);
      } else {
        setSignature({ capture, revision });
      }
      if (capture !== null) setRefusal(null);
    },
    [revision],
  );

  const handleRefusalChange = useCallback(
    (value: Refusal | null) => {
      if (value === null) {
        setRefusal(null);
      } else {
        setRefusal({ value, revision });
      }
      if (value !== null) setSignature(null);
    },
    [revision],
  );

  const handlePhotoChange = useCallback((store: CapturedPhotoStore) => {
    setPhotoStore(store);
    // V1: delete-last invalidates the captured acknowledgement.
    if (store.acceptedCount === 0) {
      setSignature(null);
      setRefusal(null);
    }
  }, []);

  // V1: a revision change invalidates the captured signature and
  // refusal state in the parent. The child components also clear
  // themselves on a new `summaryRevision` prop, but the parent is
  // authoritative and must clear the acknowledged state even if the
  // child is unmounted.
  useEffect(() => {
    setSignature(null);
    setRefusal(null);
  }, [revision]);

  const handleInvalidateMedia = useCallback(() => {
    setSignature(null);
    setRefusal(null);
  }, []);

  const currentAcknowledgement = useMemo(() => {
    if (signature !== null && signature.revision === revision) return signature.capture;
    if (refusal !== null && refusal.revision === revision) return refusal.value;
    return null;
  }, [signature, refusal, revision]);

  const canCommit =
    preview !== null &&
    photoStore.acceptedCount >= MIN_PHOTOS &&
    currentAcknowledgement !== null &&
    !committing;

  const resetEntry = useCallback(() => {
    setDraft(EMPTY_DRAFT);
    setErrors({});
    setSubmitError(null);
    setConnectionFailure(false);
    setExpiryNotice(null);
    setVehicleMode('registry');
    setManualCarried(false);
    setPickerOpenSignal(0);
    setStep('form');
    setPreview(null);
    setPreviewGeneration(0);
    setDuplicatePending(false);
    setDuplicateAcknowledged(false);
    setDuplicateAcknowledgedFor(null);
    setPhotoStore(EMPTY_PHOTO_STORE);
    setSignature(null);
    setRefusal(null);
    setReviewing(false);
    setCommitting(false);
    setCommitError(null);
    setIssued(null);
    setErrorFocusNonce(0);
    setOperationId(newOperationId());
    setSyncState('idle');
    lookup.reset();
  }, [lookup]);

  const commit = useCallback(async () => {
    if (preview === null) {
      setCommitError('Review the driver summary before issuing the challan.');
      return;
    }
    if (photoStore.acceptedCount < MIN_PHOTOS) {
      setCommitError('Capture at least one evidence photo before issuing the challan.');
      return;
    }
    if (currentAcknowledgement === null) {
      setCommitError(
        'Confirm the driver signature or record a refusal before issuing the challan.',
      );
      return;
    }

    setCommitting(true);
    setCommitError(null);
    setSyncState('sending');
    try {
      const result = await submitChallan({
        operationId,
        draft: draftForApi(),
        photos: photoStore.photos,
        signature: signature !== null && signature.revision === revision ? signature.capture : null,
        refusal: refusal !== null && refusal.revision === revision ? refusal.value : null,
        summaryRevision: revision,
        duplicateWarningAcknowledged: duplicateAcknowledged,
      });
      setIssued(result);
      setSyncState('sent');
    } catch (error) {
      if (error instanceof SubmitApiError) {
        if (error.status === 422 && error.fields.length > 0) {
          const display = applyServerErrors({
            error: 'invalid_draft',
            message: error.message,
            fields: error.fields,
          });
          setErrors(display.fieldErrors);
          setSubmitError(display.fallback ?? error.message);
          setCommitError(null);
          setSyncState('saved');
          setStep('form');
        } else if (error.status === 409) {
          // The server rechecked the final repeat/duplicate state or the
          // operation key. Do not imply issuance: return to details, clear the
          // stale acknowledgement and require a fresh review.
          setCommitError(error.message);
          setSubmitError(error.message);
          setSyncState('saved');
          setPreview(null);
          setSignature(null);
          setRefusal(null);
          setDuplicateAcknowledged(false);
          setDuplicateAcknowledgedFor(null);
          setDuplicatePending(false);
          setStep('form');
        } else {
          setCommitError(error.message);
          setSyncState('error');
        }
      } else {
        setCommitError("Couldn't issue the challan. Nothing was confirmed. Try again.");
        setSyncState('error');
      }
    } finally {
      setCommitting(false);
    }
  }, [
    currentAcknowledgement,
    draftForApi,
    duplicateAcknowledged,
    photoStore,
    preview,
    operationId,
    refusal,
    revision,
    signature,
  ]);

  useEffect(() => {
    if (issued !== null) {
      setSyncState('sent');
      return;
    }
    const entered =
      draft.vehicleRegistration.trim() !== '' ||
      draft.gatePassNumber.trim() !== '' ||
      draft.driverName.trim() !== '' ||
      draft.departmentId !== '' ||
      draft.contractorId !== '' ||
      draft.vehicleTypeId !== '' ||
      draft.violationTypeIds.length > 0 ||
      draft.remarks.trim() !== '' ||
      draft.registry !== null;
    setSyncState(entered ? 'saved' : 'idle');
  }, [draft, issued]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        TABLET_DRAFT_STORAGE_KEY,
        JSON.stringify({ draft, operationId, issued }),
      );
    } catch {
      /* storage unavailable: the current tab still works */
    }
  }, [draft, issued, operationId]);

  const locationLabel = identity?.post?.label ?? 'your authorised post';
  const shiftLabel = identity?.shift?.label ?? 'your authorised shift';
  const activeStepIndex = step === 'form' ? 0 : step === 'summary' ? 1 : 2;
  const formCharacter: CharacterKind = reviewing
    ? 'processing'
    : connectionFailure
      ? 'connection'
      : errorItems.length > 0
        ? 'error'
        : 'welcome';
  const formCharacterRole: 'status' | 'alert' | undefined =
    formCharacter === 'processing'
      ? 'status'
      : formCharacter === 'connection'
        ? 'alert'
        : undefined;
  const showLocalAcknowledgement =
    signature !== null || (photoStore.acceptedCount > 0 && refusal === null);
  const localAcknowledgement =
    signature !== null
      ? photoStore.acceptedCount > 0
        ? 'Photo captured and signature confirmed on this device. No challan has been submitted.'
        : 'Signature confirmed on this device. No challan has been submitted.'
      : `Photo captured on this device. No challan has been submitted. Photos held locally: ${photoStore.acceptedCount} of ${MAX_PHOTOS}.`;

  if (issued !== null) {
    return (
      <Container maxWidth={false} sx={{ py: SPACING.xl, px: SPACING.lg }}>
        <Stack spacing={SPACING.lg} sx={{ width: '100%' }}>
          <StepStrip activeIndex={2} />
          <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
            <TextField
              select
              size="small"
              label={copy.languageLabel}
              value={language}
              onChange={(event) => onLanguageChange(event.target.value as DriverLanguage)}
              sx={{ minWidth: 210 }}
            >
              {DRIVER_LANGUAGES.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <MarshalCallout
            character="success"
            tone="success"
            role="status"
            testId="challan-issued"
            title={copy.issuedTitle}
          >
            {issued.replayed ? copy.replayedText : copy.issuedText}
          </MarshalCallout>
          <FormSection title={copy.issuedTitle} titleId="entry-flow-issued">
            <Stack spacing={SPACING.lg}>
              <Box>
                <Typography variant="caption" sx={{ color: tokens.muted }}>
                  {copy.number}
                </Typography>
                <Typography
                  component="p"
                  variant="h1"
                  data-testid="issued-challan-number"
                  sx={{ fontFamily: FONT_MONO, fontWeight: 700, wordBreak: 'break-all' }}
                >
                  {issued.challanNumber}
                </Typography>
              </Box>
              <Box component="dl" sx={{ margin: 0 }}>
                <SummaryRow label={copy.status}>
                  <StatusBadge
                    status={challanStatusKind(issued.status)}
                    label={copy.statusValues[issued.status]}
                  />
                </SummaryRow>
                <SummaryRow label={copy.driver}>{draft.driverName}</SummaryRow>
                <SummaryRow label={copy.vehicle} mono>
                  {draft.vehicleRegistration}
                </SummaryRow>
                <SummaryRow label={copy.gatePass} mono>
                  {draft.gatePassNumber}
                </SummaryRow>
                <SummaryRow label={copy.severity}>
                  <SeverityChip
                    severity={issued.severity}
                    label={copy.severityValues[issued.severity]}
                  />
                </SummaryRow>
                <SummaryRow label={copy.occurrence}>{String(issued.occurrenceNumber)}</SummaryRow>
                <SummaryRow label={copy.issued}>{formatIssuedAt(issued.issuedAt)}</SummaryRow>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={SPACING.md}>
                <ActionButton tone="secondary" onClick={resetEntry}>
                  {copy.createAnother}
                </ActionButton>
              </Stack>
            </Stack>
          </FormSection>
        </Stack>
      </Container>
    );
  }

  if (catalogues.state.kind === 'loading') {
    return (
      <Container maxWidth={false} sx={{ py: SPACING.xl, px: SPACING.lg }}>
        <LoadingPanel label="Loading master data…" />
      </Container>
    );
  }
  if (catalogues.state.kind === 'error') {
    if (catalogues.state.reason === 'unauthenticated') {
      return (
        <Container maxWidth={false} sx={{ py: SPACING.xl, px: SPACING.lg }}>
          <Notice severity="error" role="alert">
            {catalogues.state.message}
          </Notice>
        </Container>
      );
    }
    if (catalogues.state.reason === 'service_error') {
      return (
        <Container maxWidth={false} sx={{ py: SPACING.xl, px: SPACING.lg }}>
          <MarshalCallout
            character="error"
            tone="error"
            role="alert"
            testId="marshal-service-error"
            title="The server returned an error"
            action={
              <ActionButton tone="secondary" onClick={() => void catalogues.reload()}>
                Retry
              </ActionButton>
            }
          >
            {`${catalogues.state.message} The tablet reached the server; the lists could not be loaded. Retry, or ask your supervisor if it continues.`}
          </MarshalCallout>
        </Container>
      );
    }
    if (catalogues.state.reason === 'network') {
      return (
        <Container maxWidth={false} sx={{ py: SPACING.xl, px: SPACING.lg }}>
          <MarshalCallout
            character="connection"
            tone="error"
            role="alert"
            title="The tablet can't reach the server"
            action={
              <ActionButton tone="secondary" onClick={() => void catalogues.reload()}>
                Retry
              </ActionButton>
            }
          >
            {`${catalogues.state.message} Check the network connection, then try again.`}
          </MarshalCallout>
        </Container>
      );
    }
    return (
      <Container maxWidth={false} sx={{ py: SPACING.xl, px: SPACING.lg }}>
        <Notice severity="error" role="alert">
          {catalogues.state.message}
          <ActionButton
            tone="ghost"
            onClick={() => void catalogues.reload()}
            sx={{ ml: SPACING.md }}
          >
            Retry
          </ActionButton>
        </Notice>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: SPACING.xl, px: SPACING.lg }}>
      <Stack spacing={SPACING.lg} sx={{ width: '100%' }}>
        <StepStrip activeIndex={activeStepIndex} />

        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: SPACING.md,
            padding: `${SPACING.sm} ${SPACING.lg}`,
            border: `1px solid ${tokens.line}`,
            borderRadius: 2,
            backgroundColor: tokens.surface,
          }}
          role="status"
        >
          <Typography variant="body2" sx={{ color: tokens.muted }}>
            Post
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {locationLabel}
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.muted }}>
            ·
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.muted }}>
            Shift
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {shiftLabel}
          </Typography>
        </Box>

        {step === 'form' && (
          <MarshalCallout
            key={
              formCharacter === 'processing'
                ? 'processing'
                : formCharacter === 'connection'
                  ? 'connection'
                  : 'passive'
            }
            character={formCharacter}
            role={formCharacterRole}
            tone={formCharacter === 'error' || formCharacter === 'connection' ? 'error' : 'info'}
            title={
              formCharacter === 'processing'
                ? 'Checking the details'
                : formCharacter === 'connection'
                  ? "The tablet can't reach the server"
                  : formCharacter === 'error'
                    ? 'Some details need attention'
                    : 'Welcome'
            }
            action={
              formCharacter === 'processing' ? (
                <Stack direction="row" spacing={SPACING.sm} sx={{ alignItems: 'center' }}>
                  <CircularProgress size={22} aria-label="Checking details" />
                  <Typography variant="body2">Please wait.</Typography>
                </Stack>
              ) : formCharacter === 'connection' ? (
                <ActionButton tone="secondary" onClick={() => void reviewSummary()}>
                  Try again
                </ActionButton>
              ) : formCharacter === 'welcome' ? (
                <ActionButton tone="ghost" onClick={focusVehicleField} sx={{ px: 0 }}>
                  Go to vehicle number
                </ActionButton>
              ) : undefined
            }
          >
            {formCharacter === 'processing'
              ? 'This can take a moment. Your entries are kept.'
              : formCharacter === 'connection'
                ? `${submitError ?? "Couldn't reach the API."} Nothing has been submitted.`
                : formCharacter === 'error'
                  ? 'Fix the items listed below, then choose Check details again. Your entries are kept.'
                  : 'Start with the vehicle number or gate pass. Check the details with the driver before anything is signed.'}
          </MarshalCallout>
        )}

        {preview !== null && (
          <Notice severity="warning" role="status">
            <strong>Occurrence {preview.occurrenceNumber}.</strong> This gate pass appears{' '}
            {preview.occurrenceNumber} {preview.occurrenceNumber === 1 ? 'time' : 'times'} in the
            last 90 days, counting this entry. Recommended action:{' '}
            {ACTION_LABELS[preview.recommendedAction]}. This is a recommendation only — no action
            has been taken yet.
          </Notice>
        )}

        {(preview?.duplicateWarning.required === true || duplicatePending) && (
          <Notice severity="warning" role="alert">
            This vehicle was already recorded at this location within 15 minutes.
            <FormControlLabel
              control={
                <Checkbox
                  checked={duplicateAcknowledged}
                  onChange={(event) => {
                    const next = event.target.checked;
                    setDuplicateAcknowledged(next);
                    // CR-02 fix: bind the acknowledgement to the
                    // current preview generation so a new preview
                    // (or material edit) invalidates it.
                    setDuplicateAcknowledgedFor(next ? previewGeneration : null);
                  }}
                />
              }
              label="I acknowledge the duplicate warning"
            />
            <ActionButton
              tone="primary"
              onClick={proceedAfterDuplicate}
              disabled={!duplicateAcknowledged}
              sx={{ ml: SPACING.md }}
            >
              Continue
            </ActionButton>
          </Notice>
        )}

        {expiryNotice !== null && <Notice severity="warning">{expiryNotice}</Notice>}
        {submitError !== null && !connectionFailure && (
          <Notice severity="error" role="alert">
            {submitError}
          </Notice>
        )}
        {step === 'form' && errorItems.length > 0 && (
          <ErrorSummary key={errorFocusNonce} items={errorItems} onNavigate={focusErrorField} />
        )}

        {step === 'form' && (
          <Stack spacing={SPACING.lg}>
            <FormSection title="Vehicle & driver" titleId="entry-flow-form">
              <Stack spacing={SPACING.lg}>
                {recentMatches.length > 0 && (
                  <Stack spacing={SPACING.sm}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Recent at this post
                    </Typography>
                    <Typography variant="caption" sx={{ color: tokens.muted }}>
                      Tap a recent vehicle to fill the known details. Everything stays editable.
                    </Typography>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: '1fr',
                          sm: 'repeat(auto-fit, minmax(190px, 1fr))',
                        },
                        gap: SPACING.sm,
                      }}
                    >
                      {recentMatches.map((match) => (
                        <ActionButton
                          key={match.gatePassRecordId}
                          tone="secondary"
                          onClick={() => chooseMatch(match)}
                          sx={{
                            width: '100%',
                            justifyContent: 'flex-start',
                            textAlign: 'left',
                            whiteSpace: 'normal',
                            py: SPACING.sm,
                          }}
                        >
                          <Stack sx={{ alignItems: 'flex-start', minWidth: 0, width: '100%' }}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily: FONT_MONO,
                                fontWeight: 700,
                                overflowWrap: 'anywhere',
                              }}
                            >
                              {match.vehicleRegistrationNumber}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: tokens.muted,
                                whiteSpace: 'normal',
                                overflowWrap: 'anywhere',
                                textAlign: 'left',
                              }}
                            >
                              {match.driverName} · {match.gatePassNumber}
                            </Typography>
                          </Stack>
                        </ActionButton>
                      ))}
                    </Box>
                  </Stack>
                )}
                <VehiclePicker
                  value={draft.vehicleRegistration}
                  mode={vehicleMode}
                  lookup={lookup}
                  error={errors.vehicleRegistration}
                  openSignal={pickerOpenSignal}
                  onTextChange={handleVehicleText}
                  onBlurNormalise={normaliseRegistration}
                  onChoose={chooseMatch}
                  onEnterNewVehicle={enterNewVehicle}
                  carriedDetails={manualCarried}
                  onSwitchToRegistry={switchToRegistry}
                />

                <div>
                  <TextField
                    id="gate-pass-number"
                    label="Gate pass number"
                    value={draft.gatePassNumber}
                    onChange={(event) =>
                      lookupField(
                        'gatePassNumber',
                        { gatePassNumber: event.target.value },
                        event.target.value,
                      )
                    }
                    error={(errors.gatePassNumber ?? '') !== ''}
                    helperText={errors.gatePassNumber ?? ' '}
                    fullWidth
                    slotProps={{
                      htmlInput: {
                        style: { fontFamily: FONT_MONO, fontWeight: 500, letterSpacing: '0.01em' },
                      },
                    }}
                  />
                  {lookup.field === 'gatePassNumber' && (
                    <SuggestionList
                      lookup={lookup.lookup}
                      onChoose={chooseMatch}
                      onRetry={() => lookup.start('gatePassNumber', lookup.query)}
                    />
                  )}
                </div>

                <div>
                  <TextField
                    id="driver-name"
                    label="Driver name"
                    value={draft.driverName}
                    onChange={(event) =>
                      lookupField(
                        'driverName',
                        { driverName: event.target.value },
                        event.target.value,
                      )
                    }
                    error={(errors.driverName ?? '') !== ''}
                    helperText={errors.driverName ?? ' '}
                    fullWidth
                  />
                  {lookup.field === 'driverName' && (
                    <SuggestionList
                      lookup={lookup.lookup}
                      onChoose={chooseMatch}
                      onRetry={() => lookup.start('driverName', lookup.query)}
                    />
                  )}
                </div>

                <MasterSelect
                  id="master-department"
                  label="Department"
                  value={draft.departmentId}
                  options={departments}
                  error={errors.departmentId}
                  onChange={(value) => materialChange({ departmentId: value })}
                />
                <MasterSelect
                  id="master-contractor"
                  label="Contractor"
                  value={draft.contractorId}
                  options={contractors}
                  error={errors.contractorId}
                  onChange={(value) => materialChange({ contractorId: value })}
                />
                <MasterSelect
                  id="master-vehicle-type"
                  label="Vehicle type"
                  value={draft.vehicleTypeId}
                  options={vehicleTypes}
                  error={errors.vehicleTypeId}
                  onChange={(value) => materialChange({ vehicleTypeId: value })}
                />
              </Stack>
            </FormSection>

            <FormSection title="Violation details">
              <Stack spacing={SPACING.lg}>
                <FormGroup
                  aria-label="Violations"
                  role="group"
                  id="violations-group"
                  tabIndex={-1}
                  {...(errors.violationTypeIds !== undefined
                    ? { 'aria-describedby': 'violations-error' }
                    : {})}
                  sx={{ outline: 'none' }}
                >
                  <InputLabel component="legend">Violations</InputLabel>
                  {orderedViolationTypes.map((option) => (
                    <FormControlLabel
                      key={option.id}
                      sx={{ minHeight: TOUCH_TARGET_MIN.tabletCheckBoxRow, alignItems: 'center' }}
                      control={
                        <Checkbox
                          checked={draft.violationTypeIds.includes(option.id)}
                          onChange={(event) =>
                            materialChange({
                              violationTypeIds: event.target.checked
                                ? [...draft.violationTypeIds, option.id]
                                : draft.violationTypeIds.filter((id) => id !== option.id),
                            })
                          }
                        />
                      }
                      label={option.label}
                    />
                  ))}
                </FormGroup>
                {errors.violationTypeIds !== undefined && (
                  <Typography color="error" role="alert" id="violations-error">
                    {errors.violationTypeIds}
                  </Typography>
                )}

                <div>
                  <TextField
                    id="remarks-input"
                    label="Remarks"
                    value={draft.remarks}
                    onChange={(event) => materialChange({ remarks: event.target.value })}
                    error={(errors.remarks ?? '') !== ''}
                    helperText={
                      errors.remarks ??
                      (otherSelected ? 'Required because Other is selected.' : 'Optional.')
                    }
                    multiline
                    minRows={2}
                    fullWidth
                  />
                  <Typography variant="caption" sx={{ color: tokens.muted }}>
                    {draft.remarks.length}/{REMARKS_MAX_LENGTH}
                  </Typography>
                </div>

                {derivedSeverity !== null && <SeverityChip severity={derivedSeverity} />}
              </Stack>
            </FormSection>

            <Stack
              direction="row"
              spacing={SPACING.md}
              sx={{ alignItems: 'center', flexWrap: 'wrap' }}
            >
              <ActionButton
                tone="primary"
                onClick={() => void reviewSummary()}
                disabled={reviewing}
                loading={reviewing}
                loadingLabel="Checking details…"
                data-testid="check-details"
                sx={{
                  width: { xs: '100%', sm: 'auto' },
                  px: SPACING.xl,
                }}
              >
                Check details
              </ActionButton>
            </Stack>
          </Stack>
        )}

        {step === 'summary' && (
          <Stack spacing={SPACING.lg}>
            <MarshalCallout character="check-details" title={copy.checkTitle}>
              {copy.checkBody}
            </MarshalCallout>
            <FormSection title={copy.summaryTitle} titleId="entry-flow-summary">
              <Stack spacing={SPACING.lg}>
                <Typography variant="body1">{copy.summaryIntro}</Typography>
                <Box component="dl" sx={{ margin: 0 }}>
                  <SummaryRow label={copy.driver}>{draft.driverName}</SummaryRow>
                  <SummaryRow label={copy.vehicle} mono>
                    {draft.vehicleRegistration}
                  </SummaryRow>
                  <SummaryRow label={copy.gatePass} mono>
                    {draft.gatePassNumber}
                  </SummaryRow>
                  <SummaryRow label={copy.department}>
                    {departments.find((option) => option.id === draft.departmentId)?.label ?? '—'}
                  </SummaryRow>
                  {draft.contractorId !== '' && (
                    <SummaryRow label={copy.contractor}>
                      {contractors.find((option) => option.id === draft.contractorId)?.label ?? '—'}
                    </SummaryRow>
                  )}
                  <SummaryRow label={copy.vehicleType}>
                    {vehicleTypes.find((option) => option.id === draft.vehicleTypeId)?.label ?? '—'}
                  </SummaryRow>
                  <SummaryRow label={copy.violations}>
                    {selectedViolations.map((v) => v.label).join(', ')}
                  </SummaryRow>
                  {draft.remarks.trim() !== '' && (
                    <SummaryRow label={copy.remarks}>{draft.remarks}</SummaryRow>
                  )}
                  <SummaryRow label={copy.severity}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: SPACING.md }}>
                      <SeverityChip
                        severity={preview?.severity ?? derivedSeverity ?? 'Minor'}
                        label={copy.severityValues[preview?.severity ?? derivedSeverity ?? 'Minor']}
                      />
                      {vehicleMode === 'new' && (
                        <StatusBadge label={copy.manualEntry} tone="info" />
                      )}
                    </Box>
                  </SummaryRow>
                  <SummaryRow label={copy.locationShift}>
                    {locationLabel} · {shiftLabel}
                  </SummaryRow>
                </Box>
                <Typography variant="body2" role="status">
                  Evidence photos: {photoStore.acceptedCount} of {MAX_PHOTOS} (minimum 1).
                </Typography>
                {signature !== null && (
                  <Notice severity="success" role="status">
                    Driver signature captured.
                  </Notice>
                )}
                {refusal !== null && (
                  <Notice severity="success" role="status">
                    Refusal recorded with witness {refusal.value.witnessName} (
                    {refusal.value.witnessStaffId}).
                  </Notice>
                )}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={SPACING.md}>
                  <ActionButton
                    tone="secondary"
                    onClick={() => setStep('form')}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >
                    Change details
                  </ActionButton>
                  <ActionButton
                    tone="primary"
                    onClick={() => setStep('signature')}
                    disabled={preview === null}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >
                    Continue to photos
                  </ActionButton>
                </Stack>
              </Stack>
            </FormSection>
          </Stack>
        )}

        {step === 'signature' && (
          <Stack spacing={SPACING.lg}>
            {showLocalAcknowledgement && (
              <MarshalCallout
                character="success"
                tone="success"
                role="status"
                testId="marshal-acknowledgement"
                motionKey={`${photoStore.acceptedCount}:${signature !== null}`}
                title={signature !== null ? 'Signature confirmed locally' : 'Photo captured'}
              >
                {localAcknowledgement}
              </MarshalCallout>
            )}
            <FormSection title="Capture evidence and sign" titleId="entry-flow-signature">
              <Stack spacing={SPACING.lg}>
                <Suspense fallback={<LoadingPanel label="Loading camera…" compact />}>
                  <PhotoCapture onChange={handlePhotoChange} initialStore={photoStore} />
                </Suspense>
                <Suspense fallback={<LoadingPanel label="Loading signature pad…" compact />}>
                  <SignaturePad
                    summaryRevision={revision}
                    initialCapture={signature?.capture ?? null}
                    onChange={handleSignatureChange}
                    onInvalidate={handleInvalidateMedia}
                  />
                </Suspense>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={SPACING.md}>
                  <ActionButton
                    tone="secondary"
                    onClick={() => setStep('refusal')}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >
                    Driver refuses to sign
                  </ActionButton>
                  <ActionButton
                    tone="secondary"
                    onClick={() => setStep('summary')}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >
                    Back to summary
                  </ActionButton>
                </Stack>
                <CommitPanel
                  disabled={!canCommit}
                  submitting={committing}
                  error={commitError}
                  onCommit={() => void commit()}
                />
              </Stack>
            </FormSection>
          </Stack>
        )}

        {step === 'refusal' && (
          <FormSection title="Record refusal to sign" titleId="entry-flow-refusal">
            <Stack spacing={SPACING.lg}>
              <Suspense fallback={<LoadingPanel label="Loading…" compact />}>
                <RefusalForm
                  summaryRevision={revision}
                  onChange={handleRefusalChange}
                  onInvalidate={handleInvalidateMedia}
                />
              </Suspense>
              <Stack direction="row" spacing={SPACING.md}>
                <ActionButton tone="secondary" onClick={() => setStep('signature')}>
                  Back to signature
                </ActionButton>
              </Stack>
              <CommitPanel
                disabled={!canCommit}
                submitting={committing}
                error={commitError}
                onCommit={() => void commit()}
              />
            </Stack>
          </FormSection>
        )}
      </Stack>
    </Container>
  );
}

function LoadingPanel({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        py: compact ? SPACING.lg : SPACING.xxxl,
      }}
      role="status"
    >
      <Stack spacing={SPACING.md} sx={{ alignItems: 'center' }}>
        <CircularProgress size={28} />
        <Typography variant="body2" sx={{ color: tokens.muted }}>
          {label}
        </Typography>
      </Stack>
    </Box>
  );
}

function CommitPanel({
  disabled,
  submitting,
  error,
  onCommit,
}: {
  disabled: boolean;
  submitting: boolean;
  error: string | null;
  onCommit: () => void;
}) {
  return (
    <Stack spacing={SPACING.md}>
      {error !== null && (
        <Notice severity="error" role="alert">
          {error}
        </Notice>
      )}
      <ActionButton
        tone="commit"
        fullWidth
        data-testid="commit-challan"
        onClick={onCommit}
        disabled={disabled}
        loading={submitting}
        loadingLabel="Issuing challan…"
      >
        Generate challan
      </ActionButton>
      {disabled && !submitting && (
        <Typography variant="body2" sx={{ color: tokens.muted }}>
          Capture at least one evidence photo and confirm the driver signature or record a refusal
          before issuing.
        </Typography>
      )}
    </Stack>
  );
}

function formatIssuedAt(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

function StepStrip({ activeIndex }: { activeIndex: number }) {
  const current = FLOW_STEPS[activeIndex] ?? FLOW_STEPS[0];
  return (
    <>
      <Stack
        direction="row"
        spacing={SPACING.sm}
        component="ol"
        sx={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: { xs: 'none', md: 'flex' },
        }}
        aria-label="Entry progress"
      >
        {FLOW_STEPS.map((label, index) => {
          const active = index === activeIndex;
          const done = index < activeIndex;
          return (
            <Stack
              key={label}
              component="li"
              direction="row"
              spacing={SPACING.sm}
              sx={{
                alignItems: 'center',
                padding: `${SPACING.sm} ${SPACING.lg}`,
                borderRadius: 999,
                border: `1px solid ${active || done ? tokens.blue : tokens.line}`,
                backgroundColor: active ? tokens.navy : tokens.surface,
                color: active ? tokens.surface : tokens.muted,
                flex: 1,
                minHeight: TOUCH_TARGET_MIN.interactive,
              }}
              aria-current={active ? 'step' : undefined}
            >
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 14,
                  backgroundColor: active || done ? tokens.blue : tokens.lineSoft,
                  color: active || done ? tokens.surface : tokens.muted,
                }}
              >
                {index + 1}
              </Box>
              <Typography
                variant="body2"
                sx={{ fontWeight: active ? 700 : 500, color: 'inherit', whiteSpace: 'nowrap' }}
              >
                {label}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
      <Box
        component="ol"
        sx={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: { xs: 'block', md: 'none' },
        }}
        aria-label="Entry progress"
      >
        <Box
          component="li"
          aria-current="step"
          sx={{
            padding: `${SPACING.sm} ${SPACING.lg}`,
            borderRadius: 2,
            border: `1px solid ${tokens.blue}`,
            backgroundColor: tokens.navy,
            color: tokens.surface,
            fontWeight: 700,
            minHeight: TOUCH_TARGET_MIN.interactive,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          Step {activeIndex + 1} of 3: {current}
        </Box>
      </Box>
    </>
  );
}

function SummaryRow({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '240px 1fr' },
        gap: SPACING.sm,
        paddingBottom: SPACING.sm,
        borderBottom: `1px solid ${tokens.lineSoft}`,
      }}
    >
      <Typography component="dt" variant="body2" sx={{ color: tokens.muted, fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography
        component="dd"
        variant="body1"
        sx={
          mono
            ? { margin: 0, fontFamily: FONT_MONO, fontWeight: 600 }
            : { margin: 0, fontWeight: 600 }
        }
      >
        {children}
      </Typography>
    </Box>
  );
}

function SuggestionList({
  lookup,
  onChoose,
  onRetry,
}: {
  lookup: ReturnType<typeof useLookupController>['lookup'];
  onChoose: (match: RegistryMatch) => void;
  onRetry: () => void;
}) {
  if (lookup.kind === 'loading') {
    return (
      <Typography variant="body2" sx={{ mt: SPACING.sm }}>
        Searching…
      </Typography>
    );
  }
  if (lookup.kind === 'empty') {
    return (
      <Typography variant="body2" sx={{ mt: SPACING.sm }}>
        No matching gate pass.
      </Typography>
    );
  }
  if (lookup.kind === 'error') {
    return (
      <Typography variant="body2" role="alert" sx={{ mt: SPACING.sm }}>
        Couldn&apos;t load suggestions. Try again.{' '}
        <ActionButton tone="ghost" onClick={onRetry}>
          Retry
        </ActionButton>
      </Typography>
    );
  }
  if (lookup.kind !== 'results') return null;
  return (
    <Stack
      role="listbox"
      aria-label="Registry suggestions"
      spacing={SPACING.xs}
      sx={{ mt: SPACING.sm }}
    >
      {lookup.matches.map((match) => (
        <ActionButton
          key={match.gatePassRecordId}
          tone="secondary"
          role="option"
          aria-selected={false}
          onClick={() => onChoose(match)}
          sx={{
            justifyContent: 'flex-start',
            textAlign: 'left',
            whiteSpace: 'normal',
            lineHeight: 1.35,
            py: SPACING.sm,
          }}
        >
          {`${match.driverName} — ${match.gatePassNumber} — ${match.vehicleRegistrationNumber}`}
        </ActionButton>
      ))}
    </Stack>
  );
}

function MasterSelect({
  id,
  label,
  value,
  options,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: ReadonlyArray<MasterOption>;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <FormControl fullWidth variant="outlined" error={error !== undefined}>
      <InputLabel id={`${id}-label`} shrink>
        {label}
      </InputLabel>
      <NativeSelect
        id={id}
        input={<OutlinedInput />}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputProps={{
          'aria-label': label,
          'aria-describedby': error === undefined ? undefined : `${id}-error`,
        }}
      >
        <option value="" />
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
      {error !== undefined && <FormHelperText id={`${id}-error`}>{error}</FormHelperText>}
    </FormControl>
  );
}

function toOption(record: { id: string; label: string; severity?: string }): MasterOption {
  return { id: record.id, label: record.label, severity: record.severity };
}

function isOtherSelected(options: ReadonlyArray<MasterOption>, selectedId: string): boolean {
  if (selectedId === '') return false;
  const match = options.find((option) => option.id === selectedId);
  return match !== undefined && isOtherLabel(match.label);
}

// Re-export to silence unused-import warnings while keeping the API
// consistent with prior revisions.
export { CapturedPhotoStoreSchema, RefusalSchema };
