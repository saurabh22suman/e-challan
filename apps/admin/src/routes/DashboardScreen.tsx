import { Suspense, lazy } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ActionButton, NAV_RAIL_BREAKPOINT, RADIUS, SPACING, tokens } from '@echallan/theme';
import ChallanReviewPanel from '../features/challans/ChallanReviewPanel';
import MasterDataPanel from '../features/masters/MasterDataPanel';
import ProfilePanel from '../features/profile/ProfilePanel';
import UserAdminPanel from '../features/users/UserAdminPanel';
import { useSession } from '../auth/session';

const TrendPanel = lazy(() => import('../features/trend/TrendPanel'));

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
          <ActionButton tone="primary" onClick={() => navigate('/challans')}>
            Go to challans
          </ActionButton>
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
 *
 * The vertical operations rail replaces the repeated page-level workspace
 * header. It keeps the approved `Review workspace` h1 and adds destination-level
 * page titles inside each panel.
 */
export default function DashboardScreen() {
  const { identity, token, signOut } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const railQuery = `(min-width:${NAV_RAIL_BREAKPOINT + 0.05}px)`;
  const verticalRail = useMediaQuery(railQuery, {
    defaultMatches: typeof window !== 'undefined' && window.matchMedia(railQuery).matches,
  });
  const role = identity?.user.role ?? 'Supervisor';
  const section = location.pathname.startsWith('/challans')
    ? 'challans'
    : location.pathname.startsWith('/trend')
      ? 'trend'
      : location.pathname.startsWith('/users')
        ? 'users'
        : location.pathname.startsWith('/masters')
          ? 'masters'
          : location.pathname.startsWith('/profile')
            ? 'profile'
            : false;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: verticalRail ? '232px minmax(0, 1fr)' : 'minmax(0, 1fr)',
        columnGap: verticalRail ? '40px' : 0,
        rowGap: verticalRail ? 0 : SPACING.xl,
        alignItems: 'start',
      }}
    >
      <Box
        component="nav"
        aria-label="Workspace"
        sx={{
          position: verticalRail ? 'sticky' : 'static',
          top: verticalRail ? '88px' : undefined,
          minWidth: 0,
        }}
      >
        <Box sx={{ paddingBottom: verticalRail ? SPACING.xl : SPACING.md }}>
          <Typography
            variant="overline"
            sx={{ color: tokens.muted, fontWeight: 600, letterSpacing: '0.12em' }}
          >
            Operations
          </Typography>
          <Typography component="h1" variant="h2" sx={{ margin: 0, marginTop: SPACING.xs }}>
            Review workspace
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.muted, marginTop: SPACING.xs }}>
            {role === 'Admin' ? 'All locations' : 'Assigned locations'} · {role}
          </Typography>
        </Box>

        <Tabs
          value={section}
          onChange={(_event, value: 'challans' | 'trend' | 'users' | 'masters' | 'profile') => {
            navigate(`/${value}`);
          }}
          orientation={verticalRail ? 'vertical' : 'horizontal'}
          variant={verticalRail ? 'standard' : 'scrollable'}
          scrollButtons={verticalRail ? false : 'auto'}
          aria-label="Administration sections"
          sx={
            verticalRail
              ? {
                  alignItems: 'stretch',
                  borderRight: `1px solid ${tokens.lineSoft}`,
                  '& .MuiTab-root': {
                    alignItems: 'flex-start',
                    justifyContent: 'flex-start',
                    minHeight: 44,
                    padding: `${SPACING.sm} ${SPACING.lg}`,
                    marginBottom: 2,
                    borderRadius: RADIUS.control,
                  },
                  '& .MuiTab-root.Mui-selected': { backgroundColor: tokens.tint },
                  '& .MuiTabs-indicator': { display: 'none' },
                }
              : undefined
          }
        >
          <Tab
            icon={<ListAltOutlinedIcon />}
            iconPosition="start"
            label="Challans"
            value="challans"
          />
          {(role === 'Supervisor' || role === 'Admin') && (
            <Tab icon={<ShowChartIcon />} iconPosition="start" label="Trend" value="trend" />
          )}
          {role === 'Admin' && (
            <Tab icon={<PeopleOutlinedIcon />} iconPosition="start" label="Users" value="users" />
          )}
          {role === 'Admin' && (
            <Tab
              icon={<CategoryOutlinedIcon />}
              iconPosition="start"
              label="Masters"
              value="masters"
            />
          )}
          <Tab icon={<PersonOutlinedIcon />} iconPosition="start" label="Profile" value="profile" />
        </Tabs>

        <Box
          sx={{
            marginTop: verticalRail ? SPACING.xxl : SPACING.md,
            paddingTop: verticalRail ? SPACING.lg : 0,
            borderTop: verticalRail ? `1px solid ${tokens.lineSoft}` : 'none',
          }}
        >
          <Typography variant="caption" sx={{ color: tokens.muted }}>
            Signed in as{' '}
            <Box component="span" sx={{ color: tokens.ink, fontWeight: 600 }}>
              {identity?.user.username ?? '—'}
            </Box>
            {' · '}
            {identity?.user.role}
          </Typography>
        </Box>
      </Box>

      <Box component="section" sx={{ minWidth: 0 }}>
        {token === null ? (
          <Typography variant="body1">Restoring your session…</Typography>
        ) : (
          <Routes>
            <Route path="/" element={<Navigate to="/challans" replace />} />
            <Route
              path="/challans/:challanId?"
              element={
                <ChallanReviewPanel
                  key={`${identity?.user.id ?? 'unknown'}:${role}`}
                  token={token}
                  role={role}
                  userId={identity?.user.id ?? 'unknown'}
                />
              }
            />
            <Route
              path="/trend"
              element={
                role === 'Supervisor' || role === 'Admin' ? (
                  <Suspense fallback={<Typography variant="body1">Loading trend…</Typography>}>
                    <TrendPanel token={token} />
                  </Suspense>
                ) : (
                  <Navigate to="/challans" replace />
                )
              }
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
      </Box>
    </Box>
  );
}
