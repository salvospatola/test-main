# ----------------------------
# Stage 1: Frontend Build
# ----------------------------
FROM node:20 AS client_build
WORKDIR /app

# Kopiere die Root-package.json (für die Version)
COPY package.json ./

# Frontend build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install

COPY client/ ./
RUN npm run build

# ----------------------------
# Stage 2: Backend & Final Image
# ----------------------------
FROM node:20
WORKDIR /app

# Das volle Image hat git/python/make schon an Bord,
# wir brauchen also kein apt-get mehr.

COPY package*.json ./

# Installiere Dependencies
RUN npm install --omit=dev

COPY src ./src
COPY templates ./templates

# Frontend kopieren
COPY --from=client_build /app/client/dist ./client/dist

RUN mkdir -p /app/uploads

ENV PORT=3000
ENV TZ=Europe/Berlin
ENV UPLOADS_DIR=/app/uploads

EXPOSE 3000

CMD ["node", "src/index.js"]
