# Foundation compatibility research — 2026-10-01

Verified package metadata and official docs, not an install/build pass. A separate
research agent checked npm versions/engines/peers. Local Node22.23.2, pnpm11.22.0,
Docker29.7.2 daemon and uv are available. Keep Node22.23.2 for the local baseline;
record any deliberate patch update. Python3.12 is available for planner checks.

Candidate exact pins:

| Component | Version |
|---|---|
| React / react-dom / react-is | 18.3.1 |
| @types/react / @types/react-dom | 18.3.31 / 18.3.7 |
| Vite / @vitejs/plugin-react | 8.3.2 / 6.1.1 |
| TypeScript | 6.0.3 |
| @mui/material / @mui/icons-material | 9.4.0 |
| @emotion/react / @emotion/styled | 11.14.0 / 11.14.1 |
| Fastify | 5.12.5 |
| Drizzle ORM / Kit | 0.45.3 / 0.31.11 |
| pg / @types/pg | 8.23.1 / 8.23.1 |
| Zod | 4.6.5 |
| Vitest | 5.0.3 |
| React Testing Library / DOM Testing Library | 16.3.3 / 10.4.2 |
| jest-dom / user-event / jsdom | 7.0.1 / 14.6.7 / 30.1.1 |
| @playwright/test | 1.63.0 |
| ESLint / @eslint/js / typescript-eslint | 10.11.0 / 10.0.1 / 8.71.0 |
| @types/node | 22.20.4 |

Material quirks:
- MUI9.4 accepts React18, but requires a pnpm react-is override to React's version
  (18.3.1), per MUI installation docs. Verify via installed dependency graph.
- TypeScript latest is 7.0.2 while typescript-eslint supports <6.1; retain 6.0.3.
- Vite8/plugin6 fit Node>=22.12; jsdom30 requires >=22.22.2 on Node22.
- Drizzle getting-started currently promotes an RC; use stable-pair APIs rather
  than blindly copy RC examples. Choose pg explicitly.
- Fastify does not natively consume Zod as JSON schema. For foundation health
  contracts, parse responses explicitly; defer type-provider choice until F-01.
- Playwright binaries/system libraries must be installed and verified locally.

Sources:
- https://registry.npmjs.org/ (npm view version/engines/peerDependencies for each pin)
- https://mui.com/material-ui/getting-started/installation/
- https://vite.dev/guide/
- https://fastify.dev/docs/latest/Reference/LTS/
- https://orm.drizzle.team/docs/get-started-postgresql
- https://zod.dev/
- https://vitest.dev/guide/
- https://playwright.dev/docs/intro#system-requirements
- https://eslint.org/docs/latest/use/getting-started
- https://typescript-eslint.io/users/dependency-versions/

Implementer must resolve/install the graph and verify peer compatibility. Any
unavailable pin or real incompatibility is an evidence-backed deviation request,
not permission to switch frameworks or weaken tests.
