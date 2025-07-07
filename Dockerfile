FROM node:22.15.1-alpine

WORKDIR /app

# Install nginx and build dependencies for canvas/native modules
RUN apk add --no-cache \
    nginx \
    python3 \
    make \
    g++ \
    build-base \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Copy everything
COPY . .

# Copy and make scripts executable
COPY .docker/install_deps.sh /app/install_deps.sh
COPY .docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/install_deps.sh /app/entrypoint.sh

# Install dependencies for each game folder
RUN /app/install_deps.sh

EXPOSE 80

CMD ["/app/entrypoint.sh"] 