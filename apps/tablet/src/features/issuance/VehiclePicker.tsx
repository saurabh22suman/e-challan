import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { RegistryMatch } from '@echallan/contracts';
import {
  ActionButton,
  FONT_MONO,
  Notice,
  RADIUS,
  SPACING,
  TOUCH_TARGET_MIN,
  tokens,
} from '@echallan/theme';
import type { LookupController } from './useLookupController';

/**
 * Vehicle picker (owner decision B-08, 2026-10-17).
 *
 * A searchable dropdown over the session post's registered vehicles:
 *  - opening it lists the location's gate-pass vehicles (list mode, server-scoped);
 *  - typing three or more characters searches the registry (existing debounce,
 *    cancellation and stale-response guards in useLookupController);
 *  - typing one or two characters filters the already-loaded list locally and
 *    sends no request (ENT-02 stays true);
 *  - selecting a candidate fills driver, gate pass and masters, all editable;
 *  - "Enter a new vehicle" switches to one-off manual entry: nothing is written
 *    to the registry and the gate pass number stays required.
 *
 * Large tap rows, a static label, mono identifiers and a labelled chevron keep it
 * usable with gloves and readable in glare.
 */

export interface VehiclePickerProps {
  value: string;
  mode: 'registry' | 'new';
  lookup: LookupController;
  error?: string;
  /** True when switching to manual entry kept values from a registry record. */
  carriedDetails?: boolean;
  /** Increment to open the dropdown (e.g. after coming back from new-vehicle mode). */
  openSignal?: number;
  onTextChange(value: string): void;
  onBlurNormalise(): void;
  onChoose(match: RegistryMatch): void;
  onEnterNewVehicle(): void;
  onSwitchToRegistry(): void;
}

const REGISTRY_HELPER = 'Choose a registered vehicle at this location, or enter a new one.';

export default function VehiclePicker({
  value,
  mode,
  lookup,
  error,
  carriedDetails = false,
  openSignal = 0,
  onTextChange,
  onBlurNormalise,
  onChoose,
  onEnterNewVehicle,
  onSwitchToRegistry,
}: VehiclePickerProps) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // R4: an explicit dismissal applies to the current query; new input or a
  // deliberate reopen shows the panel again.
  const [dismissedQuery, setDismissedQuery] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cachedListRef = useRef<RegistryMatch[] | null>(null);

  const registryState = lookup.lookup;
  const searchActive = lookup.field === 'registration';
  const typed = value.trim();

  useEffect(() => {
    if (registryState.kind === 'list') cachedListRef.current = registryState.matches;
  }, [registryState]);

  const autoShow =
    focused &&
    searchActive &&
    lookup.request === 'search' &&
    typed.length >= 3 &&
    dismissedQuery !== typed;
  const panelVisible = mode === 'registry' && (open || autoShow);

  const openList = useCallback(() => {
    setDismissedQuery(null);
    setOpen(true);
    if (!searchActive || registryState.kind === 'idle') {
      lookup.startList('registration');
    }
  }, [lookup, registryState.kind, searchActive]);

  const closePanel = useCallback(() => {
    setOpen(false);
    setDismissedQuery(typed);
  }, [typed]);

  useEffect(() => {
    if (openSignal > 0) openList();
  }, [openSignal]);

  // One source of truth for what the panel shows, so keyboard navigation and
  // the rendered list can never disagree (UXA-09).
  const baseCached =
    registryState.kind === 'list' ? registryState.matches : (cachedListRef.current ?? []);
  const filtered = filterMatches(baseCached, typed);
  const searchMode = lookup.request === 'search' && typed.length >= 3;
  let visibleMatches: RegistryMatch[] = [];
  if (panelVisible && registryState.kind !== 'loading' && registryState.kind !== 'error') {
    if (searchMode) {
      visibleMatches = registryState.kind === 'results' ? registryState.matches : [];
    } else if (baseCached.length > 0) {
      visibleMatches = filtered;
    }
  }

  // A new query or a reopened panel starts with no active option.
  useEffect(() => {
    setActiveIndex(-1);
  }, [typed, panelVisible]);

  useEffect(() => {
    if (activeIndex < 0) return;
    const id = optionId(visibleMatches[activeIndex]);
    if (id !== null) document.getElementById(id)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, visibleMatches]);

  const choose = useCallback(
    (match: RegistryMatch) => {
      closePanel();
      onChoose(match);
    },
    [closePanel, onChoose],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePanel();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!panelVisible) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            openList();
          }
          return;
        }
        event.preventDefault();
        if (visibleMatches.length === 0) return;
        setActiveIndex((previous) => {
          if (previous < 0) return event.key === 'ArrowDown' ? 0 : visibleMatches.length - 1;
          const next = event.key === 'ArrowDown' ? previous + 1 : previous - 1;
          return Math.min(Math.max(next, 0), visibleMatches.length - 1);
        });
        return;
      }
      if (event.key === 'Enter' && panelVisible) {
        const active = activeIndex >= 0 ? visibleMatches[activeIndex] : undefined;
        if (active !== undefined) {
          event.preventDefault();
          choose(active);
        }
      }
    },
    [activeIndex, choose, closePanel, openList, panelVisible, visibleMatches],
  );

  const handleContainerBlur = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      const next = event.relatedTarget;
      if (next instanceof Node && containerRef.current?.contains(next)) return;
      setFocused(false);
      closePanel();
    },
    [closePanel],
  );

  if (mode === 'new') {
    return (
      <Stack spacing={SPACING.sm}>
        <TextField
          id="vehicle-registration"
          label="Vehicle registration"
          value={value}
          onChange={(event) => onTextChange(event.target.value)}
          onBlur={onBlurNormalise}
          error={error !== undefined && error !== ''}
          helperText={error !== undefined && error !== '' ? error : REGISTRY_HELPER}
          fullWidth
          slotProps={{
            htmlInput: {
              style: { fontFamily: FONT_MONO, fontWeight: 500, letterSpacing: '0.01em' },
            },
          }}
        />
        <Notice severity="info" role="status">
          <strong>Manual entry.</strong> These details apply only to this challan.
          {carriedDetails && <> Existing details kept. Check them before continuing.</>}
          <ActionButton
            tone="ghost"
            onClick={onSwitchToRegistry}
            sx={{ ml: SPACING.md }}
            data-testid="vehicle-switch-registry"
          >
            Search the registry instead
          </ActionButton>
        </Notice>
      </Stack>
    );
  }

  let panelContent: ReactNode;
  if (registryState.kind === 'loading') {
    panelContent = (
      <Typography variant="body2" sx={{ padding: SPACING.lg }}>
        {lookup.request === 'list' ? 'Loading registered vehicles…' : 'Searching the registry…'}
      </Typography>
    );
  } else if (registryState.kind === 'error') {
    panelContent = (
      <Stack spacing={SPACING.sm} sx={{ padding: SPACING.lg, alignItems: 'flex-start' }}>
        <Typography variant="body2" role="alert">
          Couldn&apos;t load the registry. Try again.
        </Typography>
        <ActionButton tone="secondary" onClick={lookup.triggerNow}>
          Retry
        </ActionButton>
      </Stack>
    );
  } else if (searchMode) {
    panelContent =
      visibleMatches.length > 0 ? (
        <OptionList
          matches={visibleMatches}
          activeIndex={activeIndex}
          onActivate={setActiveIndex}
          onChoose={choose}
        />
      ) : (
        <Typography variant="body2" sx={{ padding: SPACING.lg }}>
          No matching gate pass. Check the number, or use “Enter a new vehicle” below.
        </Typography>
      );
  } else if (baseCached.length === 0) {
    panelContent = (
      <Typography variant="body2" sx={{ padding: SPACING.lg }}>
        No registered vehicles at this location yet. Use “Enter a new vehicle” below.
      </Typography>
    );
  } else if (filtered.length === 0) {
    panelContent = (
      <Typography variant="body2" sx={{ padding: SPACING.lg }}>
        No registered vehicles match what you typed. Use “Enter a new vehicle” below if this is a
        new vehicle.
      </Typography>
    );
  } else {
    panelContent = (
      <OptionList
        matches={filtered}
        activeIndex={activeIndex}
        onActivate={setActiveIndex}
        onChoose={choose}
      />
    );
  }

  const activeOptionId =
    activeIndex >= 0 ? (optionId(visibleMatches[activeIndex]) ?? undefined) : undefined;

  return (
    <Stack spacing={0}>
      <Box
        ref={containerRef}
        onFocus={() => setFocused(true)}
        onBlur={handleContainerBlur}
        sx={{ position: 'relative' }}
        data-testid="vehicle-picker"
      >
        <TextField
          id="vehicle-registration"
          label="Vehicle registration"
          value={value}
          onChange={(event) => onTextChange(event.target.value)}
          onClick={openList}
          onKeyDown={handleKeyDown}
          onBlur={onBlurNormalise}
          error={error !== undefined && error !== ''}
          fullWidth
          slotProps={{
            htmlInput: {
              style: { fontFamily: FONT_MONO, fontWeight: 500, letterSpacing: '0.01em' },
              role: 'combobox',
              'aria-autocomplete': 'list',
              'aria-expanded': panelVisible,
              'aria-controls': 'vehicle-options-listbox',
              'aria-activedescendant': activeOptionId,
              'aria-describedby': 'vehicle-registration-helper',
            },
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="Browse registered vehicles"
                    aria-expanded={panelVisible}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (panelVisible) closePanel();
                      else openList();
                    }}
                    data-testid="vehicle-browse"
                    edge="end"
                  >
                    <ExpandMoreIcon
                      sx={{
                        transition: 'transform 150ms ease',
                        transform: panelVisible ? 'rotate(180deg)' : 'none',
                      }}
                    />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />

        {panelVisible && (
          <Paper
            elevation={0}
            data-testid="vehicle-panel"
            // Keep focus in the input while clicking an option so the panel
            // is not closed by the blur before the click lands (combobox
            // pattern: the input owns focus, aria-activedescendant tracks the
            // active option).
            onMouseDown={(event) => event.preventDefault()}
            sx={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 20,
              border: `1px solid ${tokens.line}`,
              borderRadius: RADIUS.control,
              boxShadow: '0 12px 28px rgba(14, 29, 51, 0.18)',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ maxHeight: 384, overflowY: 'auto' }}>{panelContent}</Box>
            <Divider />
            <ActionButton
              tone="ghost"
              fullWidth
              startIcon={<AddCircleOutlineIcon />}
              onClick={() => {
                closePanel();
                onEnterNewVehicle();
              }}
              data-testid="vehicle-new-entry"
              sx={{
                justifyContent: 'flex-start',
                borderRadius: 0,
                paddingX: SPACING.lg,
              }}
            >
              Enter a new vehicle
            </ActionButton>
          </Paper>
        )}
      </Box>
      <FormHelperText id="vehicle-registration-helper" error={error !== undefined && error !== ''}>
        {error !== undefined && error !== '' ? error : REGISTRY_HELPER}
      </FormHelperText>
    </Stack>
  );
}

function optionId(match: RegistryMatch | undefined): string | null {
  return match === undefined ? null : `vehicle-option-${match.gatePassRecordId}`;
}

function OptionList({
  matches,
  activeIndex,
  onActivate,
  onChoose,
}: {
  matches: ReadonlyArray<RegistryMatch>;
  activeIndex: number;
  onActivate(index: number): void;
  onChoose: (match: RegistryMatch) => void;
}) {
  return (
    <Stack
      role="listbox"
      id="vehicle-options-listbox"
      aria-label="Registry suggestions"
      data-testid="vehicle-options"
    >
      {matches.map((match, index) => (
        <Box
          key={match.gatePassRecordId}
          id={`vehicle-option-${match.gatePassRecordId}`}
          component="div"
          role="option"
          aria-selected={false}
          data-active={index === activeIndex ? 'true' : undefined}
          onClick={() => onChoose(match)}
          onMouseEnter={() => onActivate(index)}
          sx={{
            border: 0,
            borderBottom: `1px solid ${tokens.lineSoft}`,
            background: index === activeIndex ? tokens.hover : 'transparent',
            textAlign: 'left',
            cursor: 'pointer',
            minHeight: TOUCH_TARGET_MIN.tabletDropdownRow,
            padding: `${SPACING.sm} ${SPACING.lg}`,
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.md,
            '&:hover': { backgroundColor: tokens.hover },
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              component="span"
              sx={{
                display: 'block',
                fontFamily: FONT_MONO,
                fontWeight: 600,
                letterSpacing: '0.01em',
                color: tokens.ink,
              }}
            >
              {match.vehicleRegistrationNumber}
            </Typography>
            <Typography
              component="span"
              variant="body2"
              sx={{ display: 'block', color: tokens.ink }}
            >
              {match.driverName} · {match.gatePassNumber}
            </Typography>
            <Typography
              component="span"
              variant="caption"
              sx={{ display: 'block', color: tokens.muted }}
            >
              {match.departmentLabel} · {match.vehicleTypeLabel}
              {match.contractorLabel === null ? '' : ` · ${match.contractorLabel}`}
            </Typography>
          </Box>
          {match.status === 'expired' && (
            <Chip
              size="small"
              label="Expired"
              sx={{ borderColor: tokens.severity.major, color: tokens.severity.major }}
            />
          )}
        </Box>
      ))}
    </Stack>
  );
}

/** Local filter for the loaded list at 1–2 typed characters (no request). */
function filterMatches(matches: ReadonlyArray<RegistryMatch>, typed: string): RegistryMatch[] {
  if (typed === '') return [...matches];
  const compact = typed.replace(/\s+/g, '').toUpperCase();
  const loose = typed.toLowerCase();
  return matches.filter(
    (match) =>
      match.vehicleRegistrationNumber.replace(/\s+/g, '').toUpperCase().includes(compact) ||
      match.gatePassNumber.toUpperCase().includes(compact) ||
      match.driverName.toLowerCase().includes(loose),
  );
}
