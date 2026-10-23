import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { SPACING, tokens } from '@echallan/theme';
import { useSyncStatus } from './syncStatus';

/**
 * Slim status strip under the app bar. Deliberately states what is true:
 * connection state plus draft/commit state. It never claims an unsent challan
 * is queued because offline issuance is not implemented.
 */
export default function SyncStatusBar() {
  const { state, online } = useSyncStatus();

  let text: string;
  let colour: string;
  if (!online) {
    text =
      state === 'saved' || state === 'error'
        ? 'Offline — draft kept on this device. Issuance needs a connection.'
        : 'Offline — issuance needs a connection.';
    colour = tokens.severity.major;
  } else if (state === 'sending') {
    text = 'Sending challan…';
    colour = tokens.blue;
  } else if (state === 'sent') {
    text = 'Challan sent to the server.';
    colour = tokens.green;
  } else if (state === 'error') {
    text = 'Send failed — your draft is still on this device.';
    colour = tokens.severity.critical;
  } else if (state === 'saved') {
    text = 'Draft saved on this device.';
    colour = tokens.blue;
  } else {
    text = 'Online';
    colour = tokens.green;
  }

  return (
    <Box sx={{ backgroundColor: tokens.surface, borderBottom: `1px solid ${tokens.lineSoft}` }}>
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
              backgroundColor: colour,
              flexShrink: 0,
            }}
          />
          <Typography variant="caption" sx={{ color: tokens.muted }}>
            {text}
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
