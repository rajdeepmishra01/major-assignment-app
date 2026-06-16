FROM node:22-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force


FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

RUN apk update && apk upgrade --no-cache \
    && addgroup -S appgroup \
    && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src

USER appuser

EXPOSE 5001

CMD ["node", "src/server.js"]