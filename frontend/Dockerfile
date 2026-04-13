FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration=production

FROM nginx:alpine
COPY --from=build /app/dist/frontend-temp/browser /usr/share/nginx/html

RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
    location = /env.js {\n\
        add_header Cache-Control "no-store, no-cache, must-revalidate";\n\
        expires -1;\n\
    }\n\
    location /api/ {\n\
        proxy_pass http://backend:3000/api/;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Upgrade $http_upgrade;\n\
        proxy_set_header Connection "upgrade";\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
        proxy_cache_bypass $http_upgrade;\n\
        proxy_read_timeout 600s;\n\
        proxy_send_timeout 600s;\n\
        proxy_buffering off;\n\
    }\n\
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)$ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

COPY env.sh /docker-entrypoint.d/40-env.sh
RUN chmod +x /docker-entrypoint.d/40-env.sh

EXPOSE 80
