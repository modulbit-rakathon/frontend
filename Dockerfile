FROM docker.io/library/node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_MOCK_API=false
ENV VITE_MOCK_API=$VITE_MOCK_API
RUN npm run build

FROM docker.io/nginxinc/nginx-unprivileged:1.27-alpine
# API_URL and API_KEY are filled in at start, from the App Service settings.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 8080
