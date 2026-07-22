# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app

# Copie des manifests pour profiter du cache Docker sur l'install
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY packages/db/package.json packages/db/package.json

RUN npm install --workspaces --if-present

# Copie du reste du monorepo (utile en build ; en dev, volumes montés par compose)
COPY . .

WORKDIR /app/apps/api
EXPOSE 3001

CMD ["npm", "run", "start:dev"]
