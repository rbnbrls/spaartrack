FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/agent-control-plane/package.json apps/agent-control-plane/package.json
RUN corepack enable && pnpm install --no-frozen-lockfile
COPY apps/agent-control-plane/tsconfig.json apps/agent-control-plane/tsconfig.json
COPY apps/agent-control-plane/src apps/agent-control-plane/src
RUN pnpm --filter @spaartrack/agent-control-plane build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/apps/agent-control-plane/dist ./dist
USER node
CMD ["node", "dist/index.js"]
