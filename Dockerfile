FROM node:18 as base

WORKDIR /app
COPY . .
RUN npm i
RUN npx tsc

FROM node:18 as runner
WORKDIR /app
COPY --from=base ./app/dist ./dist
COPY package*.json ./
ENV NODE_ENV production
RUN npm i

EXPOSE 3000

CMD [ "node", "./dist/index.js" ]