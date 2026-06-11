FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Same-origin API base: nginx proxies /api to the backend, so the SPA calls
# /api/... and avoids CORS. Overridable at build time.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN pnpm run build

# Production stage — serve static build with nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
