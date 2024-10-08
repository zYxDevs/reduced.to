FROM node:20.17.0-alpine3.20 as dependencies
WORKDIR /app

# Install Python for node-gyp
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

# Build Stage
FROM node:20.17.0-alpine3.20 as build
WORKDIR /app

# Arguments passed from docker-compose.yml / workflow
ARG API_DOMAIN
ARG CLIENTSIDE_API_DOMAIN
ARG DOMAIN
ARG STORAGE_DOMAIN
ARG PUBLIC_PADDLE_KEY

# Set environment variables
ENV NODE_ENV=production

COPY . .
COPY --from=dependencies /app/node_modules ./node_modules

RUN npx nx build frontend --prod --skip-nx-cache \
    && npm prune --production

# Production Stage
FROM node:20.17.0-alpine3.20 as production
WORKDIR /app

COPY --from=build /app/dist/apps/frontend ./frontend
COPY --from=build /app/node_modules ./node_modules

EXPOSE 5000

CMD ["node", "frontend/server/entry.express.js"]
