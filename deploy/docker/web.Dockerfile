# Static admin or tablet image. APP selects the Vite workspace package.
#
#   docker build -f deploy/docker/web.Dockerfile --build-arg APP=admin -t echallan-admin .
#   docker build -f deploy/docker/web.Dockerfile --build-arg APP=tablet -t echallan-tablet .

ARG APP

FROM node:22.23.2-alpine AS build
ARG APP
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
RUN pnpm run build:packages \
  && pnpm --filter "@echallan/${APP}" run build

FROM nginx:1.27-alpine AS runtime
ARG APP
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build "/app/apps/${APP}/dist" /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1/"]
