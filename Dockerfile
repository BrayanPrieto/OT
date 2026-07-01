FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

# ponytail: solo el paquete base de markitdown (PDF/DOCX/PPTX/XLSX/HTML/texto).
# Extras de audio/OCR (markitdown[all]) se agregan acá si algún día se necesitan.
RUN pip install --no-cache-dir --break-system-packages markitdown

WORKDIR /app

COPY package*.json ot-config.json ./
COPY scripts ./scripts
RUN npm install

COPY . .

EXPOSE 3001

# ponytail: re-sincroniza en cada arranque, no solo en build - el volumen
# ~/.ot montado en runtime tapa lo que el postinstall clonó en la imagen.
CMD ["sh", "-c", "node scripts/sync-skills.js && npm start"]
