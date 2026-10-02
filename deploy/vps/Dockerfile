# VPS package only. This does not deploy a Smart Contract.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile
COPY . .
ARG VITE_ONCHAIN_OWNER_WALLET
ENV VITE_ONCHAIN_OWNER_WALLET=$VITE_ONCHAIN_OWNER_WALLET
ARG VITE_ONCHAIN_PROXY_ADDRESS
ENV VITE_ONCHAIN_PROXY_ADDRESS=$VITE_ONCHAIN_PROXY_ADDRESS
ARG VITE_ONCHAIN_QUEUE_ADDRESS
ENV VITE_ONCHAIN_QUEUE_ADDRESS=$VITE_ONCHAIN_QUEUE_ADDRESS
ARG VITE_MAINNET_UPGRADEABLE_PROXY_ADDRESS
ENV VITE_MAINNET_UPGRADEABLE_PROXY_ADDRESS=$VITE_MAINNET_UPGRADEABLE_PROXY_ADDRESS
ARG VITE_ONCHAIN_IMPLEMENTATION_ADDRESS
ENV VITE_ONCHAIN_IMPLEMENTATION_ADDRESS=$VITE_ONCHAIN_IMPLEMENTATION_ADDRESS
ARG VITE_TESTNET_UPGRADEABLE_PROXY_ADDRESS
ENV VITE_TESTNET_UPGRADEABLE_PROXY_ADDRESS=$VITE_TESTNET_UPGRADEABLE_PROXY_ADDRESS
ARG VITE_TESTNET_QUEUE_ADDRESS
ENV VITE_TESTNET_QUEUE_ADDRESS=$VITE_TESTNET_QUEUE_ADDRESS
RUN pnpm check && pnpm exec vite build --config deploy/vps/vite.config.ts \
    && pnpm exec esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
COPY --from=build --chown=node:node /app/package.json /app/pnpm-lock.yaml ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/drizzle.config.ts ./drizzle.config.ts
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
