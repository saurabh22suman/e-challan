import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { SPACING, tokens } from '@echallan/theme';
import ChallanReviewPanel from '../features/challans/ChallanReviewPanel';
import MasterDataPanel from '../features/masters/MasterDataPanel';
import ProfilePanel from '../features/profile/ProfilePanel';
import UserAdminPanel from '../features/users/UserAdminPanel';
import { useSession } from '../auth/session';

function NotFound() {
  const navigate = useNavigate();
  return (
    <Card>
      <CardContent>
        <Stack spacing={SPACING.lg} sx={{ alignItems: 'flex-start' }}>
          <Typography component="h2" variant="h2">
            Page not found
          </Typography>
          <Typography variant="body1" sx={{ color: tokens.muted }}>
            That address does not match a dashboard screen.
          </Typography>
          <Button variant="contained" onClick={() => navigate('/challans')}>
            Go to challans
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

/**
 * Admin dashboard landing screen and route table.
 *
 * The URL owns the active section and the selected challan, so Back/Forward and
 * direct links behave predictably. Role guards remain in the API; the routes
 * simply do not render Admin-only sections for Supervisors.
 */
export default function DashboardScreen() {
  const { identity, token, signOut } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const role = identity?.user.role ?? 'Supervisor';
  const section = location.pathname.startsWith('/challans')
    ? 'challans'
    : location.pathname.startsWith('/users')
      ? 'users'
      : location.pathname.startsWith('/masters')
        ? 'masters'
        : location.pathname.startsWith('/profile')
          ? 'profile'
          : false;

  return (
    <Stack spacing={SPACING.lg}>
      <Box>
        <Typography component="h1" variant="h2">
          Demo review workspace
        </Typography>
        <Typography variant="body1" sx={{ color: tokens.muted, mt: SPACING.xs }}>
          Review issued challans for your authorised locations. Start a review, record the action
          and mandatory remarks, then resolve.
        </Typography>
        {identity !== null && (
          <Typography variant="body2" sx={{ color: tokens.muted, mt: SPACING.xs }}>
            Signed in as {identity.user.username} ({identity.user.role}).
          </Typography>
        )}
      </Box>

      <Tabs
        value={section}
        onChange={(_event, value: 'challans' | 'users' | 'masters' | 'profile') => {
          navigate(`/${value}`);
        }}
        aria-label="Administration sections"
      >
        <Tab label="Challans" value="challans" />
        {role === 'Admin' && <Tab label="Users" value="users" />}
        {role === 'Admin' && <Tab label="Masters" value="masters" />}
        <Tab label="Profile" value="profile" />
      </Tabs>

      {token === null ? (
        <Typography variant="body1">Restoring your session…</Typography>
      ) : (
        <Routes>
          <Route path="/" element={<Navigate to="/challans" replace />} />
          <Route
            path="/challans/:challanId?"
            element={<ChallanReviewPanel token={token} role={role} />}
          />
          <Route
            path="/users"
            element={
              role === 'Admin' ? (
                <UserAdminPanel
                  token={token}
                  currentUserId={identity?.user.id ?? ''}
                  onSelfReset={() => void signOut()}
                />
              ) : (
                <Navigate to="/challans" replace />
              )
            }
          />
          <Route
            path="/masters"
            element={
              role === 'Admin' ? (
                <MasterDataPanel token={token} />
              ) : (
                <Navigate to="/challans" replace />
              )
            }
          />
          <Route path="/profile" element={<ProfilePanel token={token} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      )}
    </Stack>
  );
}
