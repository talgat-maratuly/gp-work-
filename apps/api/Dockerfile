FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/

RUN npm ci --workspace=@gp-work/api

COPY apps/api ./apps/api

RUN npm run build -w @gp-work/api

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist

RUN mkdir -p uploads/photos

EXPOSE 3002

CMD ["node", "dist/main"]
