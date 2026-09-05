FROM node:26-alpine AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
COPY scripts/check-assets.mjs ./scripts/check-assets.mjs

RUN pnpm build

FROM nginx:1.30.4-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

RUN test -f /usr/share/nginx/html/index.html \
    && test -f /usr/share/nginx/html/PROJECT_LICENSE.txt \
    && test -f /usr/share/nginx/html/THIRD_PARTY_NOTICES.txt \
    && test -f /usr/share/nginx/html/books/flatland/index.html \
    && test -f /usr/share/nginx/html/assets/materials/parchment.png \
    && test -f /usr/share/nginx/html/assets/materials/road-normal.png

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
