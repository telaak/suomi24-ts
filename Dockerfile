FROM node:20-bookworm-slim as base

WORKDIR /app
COPY . .
RUN npm ci
RUN npx tsc

FROM node:20-bookworm-slim as runner
WORKDIR /app
COPY --from=base ./app/dist ./dist
COPY package*.json ./
ENV NODE_ENV production
RUN npm ci

EXPOSE 3000

CMD [ "node", "--insecure-http-parser", "./dist/index.js" ]