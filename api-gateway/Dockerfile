FROM node:18-alpine
WORKDIR /app

RUN apk add --no-cache postgresql-client

# Buscamos o arquivo dentro da subpasta api-gateway
COPY api-gateway/package*.json ./

RUN npm install

# Copia todo o conteúdo da pasta api-gateway para o container
COPY api-gateway/ .

EXPOSE 3000
CMD ["npm", "start"]
