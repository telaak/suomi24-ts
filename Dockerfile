FROM node:18-alpine as base

WORKDIR /app
COPY . .
RUN apk add --no-cache gcompat
RUN npm i
RUN npx tsc

FROM node:18-alpine as runner
WORKDIR /app
COPY --from=base ./app/dist ./dist
COPY package*.json ./
ENV NODE_ENV production
RUN apk add --no-cache gcompat
RUN npm i

EXPOSE 3000

CMD [ "node", "--insecure-http-parser", "./dist/index.js" ]