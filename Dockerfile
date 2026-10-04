# =====================================================================
#  Peluquería HARON - image de production
#
#  Deux etapes : les outils d'installation ne restent pas dans l'image.
#  L'application tourne sous un compte non privilegie. Ce qui persiste est
#  dans PostgreSQL, sauf les photos du salon : /app/data/photos, monte en
#  volume (docker-compose.oci.yml).
# =====================================================================

FROM node:24-alpine AS dependances
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:24-alpine AS production
# tini : recolte les processus orphelins et transmet SIGTERM, ce qui laisse
# l'application fermer proprement ses flux temps reel et son pool.
RUN apk add --no-cache tini
ARG SOURCE_COMMIT=""
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 SOURCE_COMMIT=${SOURCE_COMMIT}
WORKDIR /app
COPY --from=dependances /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY public ./public
COPY scripts ./scripts
# Le dossier des photos existe DANS l'image, au nom de l'utilisateur node : un
# volume nomme en herite le proprietaire, et l'application ne tombe pas sur un
# dossier absent ou a root quand on lance compose sans scripts/deployer.sh.
RUN mkdir -p /app/data/photos && chown -R node:node /app/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# -g : SIGTERM va au GROUPE de processus. Sans cela, un arret pendant la
# migration (lancee comme processus enfant) laissait l'enfant tourner jusqu'au
# SIGKILL de Docker, dix secondes plus tard, au milieu d'une transaction.
ENTRYPOINT ["/sbin/tini", "-g", "--"]
# demarrer.js attend la base, applique le schema et les donnees de reference,
# puis lance le serveur. Les trois etapes sont idempotentes.
CMD ["node", "scripts/demarrer.js"]
