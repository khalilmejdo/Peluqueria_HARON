# =====================================================================
#  Peluquería HARON - image de production
#
#  Deux etapes : les outils d'installation ne restent pas dans l'image.
#  L'application tourne sous un compte non privilegie et ne s'ecrit nulle
#  part : tout ce qui persiste est dans PostgreSQL.
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
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
# demarrer.js attend la base, applique le schema et les donnees de reference,
# puis lance le serveur. Les trois etapes sont idempotentes.
CMD ["node", "scripts/demarrer.js"]
