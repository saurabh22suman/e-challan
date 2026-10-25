import { useEffect, useRef, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { SPACING, tokens, toneStyles, type Tone } from '@echallan/theme';
import { CHARACTER_ASSETS, type CharacterKind } from './characterAssets.js';
import './marshalCharacter.css';

/**
 * Whole-image character states. The illustrations are static PNGs; only the
 * entrance/transition of the image element is animated. No articulated-limb
 * animation is implied.
 */

export interface MarshalCharacterProps {
  kind: CharacterKind;
  /** Changes restart the one-shot success emphasis without changing the state. */
  motionKey?: string | number;
  onLoadFailure?(): void;
}

const TRANSITION_MS = 110;

export function MarshalCharacter({ kind, motionKey, onLoadFailure }: MarshalCharacterProps) {
  const [current, setCurrent] = useState<CharacterKind>(kind);
  const [previous, setPrevious] = useState<CharacterKind | null>(null);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (kind === current) return;
    setPrevious(current);
    setCurrent(kind);
    setFailed(false);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setPrevious(null);
      timerRef.current = null;
    }, TRANSITION_MS);
  }, [current, kind]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const asset = CHARACTER_ASSETS[current];
  const layerClass =
    current === 'processing'
      ? previous === null
        ? 'marshal-character-processing'
        : 'marshal-character-processing-transition'
      : current === 'success'
        ? previous === null
          ? 'marshal-character-success'
          : 'marshal-character-success-transition'
        : previous !== null
          ? 'marshal-character-fade-in'
          : 'marshal-character-enter';

  return (
    <Box
      data-testid="marshal-character"
      data-kind={current}
      {...(failed ? { 'data-failed': 'true' } : {})}
      sx={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', flexShrink: 0 }}
    >
      {previous !== null && (
        <img
          data-testid="marshal-character-previous"
          className="marshal-character-layer marshal-character-previous"
          src={CHARACTER_ASSETS[previous].src}
          alt=""
          aria-hidden="true"
          draggable={false}
          loading="lazy"
          decoding="async"
          width={CHARACTER_ASSETS[previous].width}
          height={CHARACTER_ASSETS[previous].height}
        />
      )}
      <img
        key={`${current}:${motionKey ?? ''}`}
        data-testid="marshal-character-image"
        className={`marshal-character-layer ${layerClass}`}
        src={asset.src}
        alt=""
        aria-hidden="true"
        draggable={false}
        loading={current === 'welcome' || current === 'processing' ? 'eager' : 'lazy'}
        decoding="async"
        width={asset.width}
        height={asset.height}
        hidden={failed}
        onError={() => {
          setFailed(true);
          onLoadFailure?.();
        }}
      />
    </Box>
  );
}

export interface MarshalCalloutProps {
  character: CharacterKind;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  tone?: 'info' | 'success' | 'warning' | 'error';
  role?: 'status' | 'alert';
  motionKey?: string | number;
  /** Stable hook when a state has a more specific name than its illustration. */
  testId?: string;
}

type CalloutTone = NonNullable<MarshalCalloutProps['tone']>;

/** The callout keeps its `error` prop; the shared palette names that tone `danger`. */
const TONE_MAP: Record<CalloutTone, Tone> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'danger',
};

/**
 * A character-led callout: illustration, plain explanation and an optional next
 * action. The illustration is decorative and the text carries the status.
 */
export function MarshalCallout({
  character,
  title,
  children,
  action,
  tone = 'info',
  role,
  motionKey,
  testId,
}: MarshalCalloutProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [character]);
  const palette = toneStyles[TONE_MAP[tone]];

  return (
    <Box
      data-testid={testId ?? `marshal-${character}`}
      {...(failed ? { 'data-failed': 'true' } : {})}
      {...(role === undefined ? {} : { role })}
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: { xs: SPACING.sm, md: SPACING.md },
        padding: { xs: SPACING.md, md: SPACING.lg },
        border: `1px solid ${palette.border}`,
        borderRadius: '10px',
        backgroundColor: palette.bg,
      }}
    >
      <Box
        sx={{
          width: { xs: 48, sm: 56, md: 64 },
          flexShrink: 0,
          display: { xs: 'none', sm: 'block' },
        }}
      >
        <MarshalCharacter
          kind={character}
          {...(motionKey === undefined ? {} : { motionKey })}
          onLoadFailure={() => setFailed(true)}
        />
      </Box>
      <Stack spacing={SPACING.xs} sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, color: palette.fg }}>
          {title}
        </Typography>
        {children !== undefined && (
          <Typography variant="body2" sx={{ color: tokens.ink }}>
            {children}
          </Typography>
        )}
        {action !== undefined && <Box sx={{ marginTop: SPACING.xs }}>{action}</Box>}
      </Stack>
    </Box>
  );
}
