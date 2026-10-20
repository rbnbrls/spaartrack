FROM nginx:1.27-alpine
ARG VCS_REF=local
ARG APP_VERSION=local
LABEL org.opencontainers.image.revision="$VCS_REF" \
      org.opencontainers.image.version="$APP_VERSION" \
      org.opencontainers.image.title="spaartrack-web"
COPY apps/web/index.html /usr/share/nginx/html/index.html
COPY apps/web/trading212.js /usr/share/nginx/html/trading212.js
COPY apps/web/manifest.webmanifest /usr/share/nginx/html/manifest.webmanifest
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
