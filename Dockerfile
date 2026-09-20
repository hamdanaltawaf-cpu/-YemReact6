FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

FROM base AS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder
COPY . .
RUN NODE_OPTIONS=--max-old-space-size=1024 pnpm build
RUN node -e "const fs=require('node:fs'),ts=require('typescript');fs.writeFileSync('next.config.mjs',ts.transpileModule(fs.readFileSync('next.config.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)"
RUN pnpm prune --prod

FROM base AS runtime
ENV NODE_ENV=production \
    DATA_DIR=/app/data \
    FFPROBE_PATH=/usr/bin/ffprobe
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg gosu ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/data && chown node:node /app/data
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/next.config.mjs ./next.config.mjs
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --chmod=755 scripts/container-entrypoint.sh /usr/local/bin/yemreact-entrypoint
EXPOSE 3000
ENTRYPOINT ["yemreact-entrypoint"]
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"]
