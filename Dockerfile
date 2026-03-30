FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["sh", "-c", "npm run migrate && exec env HOSTNAME=0.0.0.0 PORT=${PORT:-3000} node .next/standalone/server.js"]
