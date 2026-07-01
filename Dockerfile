FROM node:22-alpine

RUN apk add --no-cache git

WORKDIR /app

COPY package*.json ot-config.json ./
COPY scripts ./scripts
RUN npm install

COPY . .

EXPOSE 3001

# ponytail: re-sincroniza en cada arranque, no solo en build - el volumen
# ~/.ot montado en runtime tapa lo que el postinstall clonó en la imagen.
CMD ["sh", "-c", "node scripts/sync-skills.js && npm start"]
