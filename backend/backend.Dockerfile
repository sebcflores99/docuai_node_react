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

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --prod --frozen-lockfile

# Bring over the generated Prisma client (hoisted layout makes this clean)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
COPY --from=builder /app/dist ./dist

EXPOSE 8000

CMD ["node", "dist/index.js"]
