FROM node:18-alpine
WORKDIR /app

RUN apk add --no-cache postgresql-client

# Agora buscamos o arquivo no caminho relativo ao novo contexto
COPY api-gateway/package*.json ./

RUN npm install

# Copia tudo da pasta api-gateway para o /app do container
COPY api-gateway/ .

EXPOSE 3000
CMD ["npm", "start"]
