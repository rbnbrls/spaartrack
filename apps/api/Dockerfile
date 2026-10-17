FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
RUN corepack enable && pnpm install --no-frozen-lockfile
COPY apps/api/tsconfig.json apps/api/tsconfig.json
COPY apps/api/src apps/api/src
RUN pnpm --filter @spaartrack/api build
RUN pnpm deploy --filter @spaartrack/api --prod /prod

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ARG VCS_REF=local
ARG APP_VERSION=local
LABEL org.opencontainers.image.revision="$VCS_REF" \
      org.opencontainers.image.version="$APP_VERSION" \
      org.opencontainers.image.title="spaartrack-api"
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /prod/node_modules ./node_modules
COPY --from=build /prod/package.json ./package.json
USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
