# syntax=docker/dockerfile:1
FROM --platform=linux/amd64 nginx:alpine

RUN apk upgrade --no-cache

COPY index.html /usr/share/nginx/html/
COPY js/         /usr/share/nginx/html/js/
COPY assets/     /usr/share/nginx/html/assets/

EXPOSE 80
