# Web image: build the Vite bundle, then serve it as static files with nginx.
#
# Built from the REPO ROOT (the workspace lockfile lives there):
#   docker build -f apps/web/Dockerfile .
#
# NOTE: VITE_API_URL is baked in AT BUILD TIME — Vite inlines import.meta.env
# into the bundle, so it is a build arg, not a runtime env var. A different API
# URL means a different build. (This is why prod/staging need separate builds.)
FROM node:24-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace apps/web

COPY apps/web ./apps/web

ARG VITE_API_URL=http://localhost:8181
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build --workspace apps/web


FROM nginx:1.27-alpine AS runtime
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
