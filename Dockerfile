#syntax=docker/dockerfile:1.4

FROM node:20-alpine

# libc6-compat : requis par certains modules natifs (argon2, sharp)
# hadolint ignore=DL3018
RUN apk add --no-cache libc6-compat

WORKDIR /usr/src/app

# Les manifestes d'abord : la couche npm ci reste en cache tant qu'ils ne changent pas.
# Les devDependencies restent installées : le serveur tourne avec tsx.
COPY package*.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci

COPY . .

# Le front est servi par le serveur Express (même origine) : l'URL de l'API est
# relative. Ces valeurs sont figées dans le bundle au build ; client/.env n'est
# pas dans l'image. VITE_PUBLIC_URL doit être l'URL publique du site, sans
# slash final (surchargeable : --build-arg VITE_PUBLIC_URL=...).
ARG VITE_PUBLIC_URL=http://localhost:3310
ENV VITE_API_URL=""
ENV VITE_PUBLIC_URL=$VITE_PUBLIC_URL

# Compile le client uniquement. Surtout pas `npm run build` à la racine :
# il exécute server/bin/migrate, qui fait un DROP DATABASE.
RUN npm run build --workspace=client

ENV NODE_ENV=production

# Pas de migration au démarrage : le schéma s'applique à la main, une seule fois.
CMD ["npm", "run", "start"]
