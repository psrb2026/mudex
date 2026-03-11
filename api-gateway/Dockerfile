FROM node:18-alpine
WORKDIR /app

RUN apk add --no-cache postgresql-client

# Como o contexto no compose é a raiz (.), buscamos dentro da pasta:
COPY api-gateway/package*.json ./

RUN npm install

# Copia o conteúdo da pasta api-gateway para o /app do container
COPY api-gateway/ .

EXPOSE 3000
CMD ["npm", "start"]
