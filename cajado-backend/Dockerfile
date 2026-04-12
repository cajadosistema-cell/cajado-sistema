FROM node:20-alpine
WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY index.js ./
COPY public/ ./public/
COPY src/ ./src/

EXPOSE 3000
CMD ["node", "index.js"]
