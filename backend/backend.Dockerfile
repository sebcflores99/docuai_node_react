FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src/ ./src/

RUN pnpm prisma generate
RUN pnpm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

RUN corepack enable

# Reuse the builder's installed modules so the Prisma CLI + engines are present
# at runtime for `prisma migrate deploy` (run by the entrypoint on startup).
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json pnpm-lock.yaml .npmrc ./
COPY prisma ./prisma
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 8000

CMD ["./docker-entrypoint.sh"]
