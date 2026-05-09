FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY index.js ./
COPY src/ ./src/

# pasta public opcional (sem erro se não existir)
RUN mkdir -p ./public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "index.js"]
