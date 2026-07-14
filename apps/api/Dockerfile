# API image. Node 24 to match .nvmrc and the CI runner.
#
# Built from the REPO ROOT (the workspace lockfile lives there), so:
#   docker build -f apps/api/Dockerfile .
FROM node:24-alpine AS deps
WORKDIR /repo

# Copy only what npm needs to resolve the workspace tree, so this layer is
# cached until a dependency actually changes.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# --omit=dev: the API image ships no test/lint tooling.
RUN npm ci --workspace apps/api --omit=dev


FROM node:24-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY apps/api ./apps/api

# Don't run as root.
USER node

EXPOSE 8181
CMD ["node", "apps/api/src/app.js"]
