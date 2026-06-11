# syntax=docker/dockerfile:1
FROM --platform=linux/amd64 nginx:alpine

COPY index.html /usr/share/nginx/html/
COPY js/         /usr/share/nginx/html/js/
COPY assets/     /usr/share/nginx/html/assets/

EXPOSE 80
