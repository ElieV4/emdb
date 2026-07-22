# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/db/package.json packages/db/package.json

RUN npm install --workspaces --if-present

COPY . .

WORKDIR /app/apps/worker

CMD ["npm", "run", "start:dev"]
