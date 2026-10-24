import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { SPACING, toneStyles, type Tone } from '@echallan/theme';
import { useSyncStatus, type SyncState } from './syncStatus';

function resolveTone(state: SyncState, online: boolean): Tone {
  if (!online) return 'warning';
  if (state === 'sending' || state === 'saved') return 'info';
  if (state === 'sent') return 'success';
  if (state === 'error') return 'danger';
  return 'success';
}

/**
 * Slim status strip under the app bar. Deliberately states what is true:
 * connection state plus draft/commit state. It never claims an unsent challan
 * is queued because offline issuance is not implemented.
 */
export default function SyncStatusBar() {
  const { state, online } = useSyncStatus();
  const tone = resolveTone(state, online);
  const palette = toneStyles[tone];

  let text: string;
  if (!online) {
    text =
      state === 'saved' || state === 'error'
        ? 'Offline — draft kept on this device. Issuance needs a connection.'
        : 'Offline — issuance needs a connection.';
  } else if (state === 'sending') {
    text = 'Sending challan…';
  } else if (state === 'sent') {
    text = 'Challan sent to the server.';
  } else if (state === 'error') {
    text = 'Send failed — your draft is still on this device.';
  } else if (state === 'saved') {
    text = 'Draft saved on this device.';
  } else {
    text = 'Online';
  }

  return (
    <Box
      data-tone={tone}
      sx={{ backgroundColor: palette.bg, borderBottom: `1px solid ${palette.border}` }}
    >
      <Container maxWidth={false} sx={{ px: SPACING.lg, py: SPACING.xs }}>
        <Stack
          direction="row"
          spacing={SPACING.sm}
          sx={{ alignItems: 'center' }}
          role="status"
          aria-live="polite"
        >
          <Box
            aria-hidden
            sx={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              backgroundColor: palette.fg,
              flexShrink: 0,
            }}
          />
          <Typography variant="caption" sx={{ color: palette.fg }}>
            {text}
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
