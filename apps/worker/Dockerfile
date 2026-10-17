FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/package.json
RUN corepack enable && pnpm install --no-frozen-lockfile
COPY apps/worker/tsconfig.json apps/worker/tsconfig.json
COPY apps/worker/src apps/worker/src
RUN pnpm --filter @spaartrack/worker build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ARG VCS_REF=local
ARG APP_VERSION=local
LABEL org.opencontainers.image.revision="$VCS_REF" \
      org.opencontainers.image.version="$APP_VERSION" \
      org.opencontainers.image.title="spaartrack-worker"
COPY --from=build /app/apps/worker/dist ./dist
USER node
CMD ["node", "dist/index.js"]
