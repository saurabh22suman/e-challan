# Fastify API image for the Dokploy compose stack.
#
# Build from the repository root:
#   docker build -f deploy/docker/api.Dockerfile -t echallan-api .

FROM node:22.23.2-alpine AS build
RUN npm install --global pnpm@11.22.0
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY apps/tablet/package.json apps/tablet/
COPY packages/contracts/package.json packages/contracts/
COPY packages/theme/package.json packages/theme/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @echallan/contracts run build \
  && pnpm --filter @echallan/api run build \
  && pnpm --filter @echallan/api --prod deploy --legacy /prod/api

FROM node:22.23.2-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0 \
    EVIDENCE_ROOT=/data/evidence
WORKDIR /app

# The deployed package keeps a workspace marker above it because env.ts resolves
# the workspace root and demo fixture path by walking up to pnpm-workspace.yaml.
COPY --from=build /prod/api /app/apps/api
COPY --from=build /app/docs/demo-data.json /app/docs/demo-data.json
COPY --from=build /app/docs/deployment-data.json /app/docs/deployment-data.json
RUN printf 'packages:\n  - apps/*\n' > /app/pnpm-workspace.yaml \
  && mkdir -p /data/evidence \
  && chown -R node:node /data

USER node
EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3001/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "apps/api/dist/deploy-start.js"]
