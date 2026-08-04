FROM node:20-alpine AS build

WORKDIR /app

COPY mcp-gateway/package.json ./
COPY mcp-gateway/tsconfig.json ./
COPY mcp-gateway/eslint.config.js ./
COPY mcp-gateway/src ./src
COPY mcp-gateway/test ./test

RUN npm install
RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY mcp-gateway/package.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 8080

CMD ["node", "dist/index.js"]