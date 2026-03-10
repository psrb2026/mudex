FROM node:18-alpine
WORKDIR /app

# FORÇANDO O CAMINHO DA PASTA NO CONTEXTO DA RAIZ
COPY api-gateway/package*.json ./

RUN npm install

# COPIANDO TODO O CONTEÚDO (INCLUINDO O SEU INDEX.JS NOVO)
COPY api-gateway/ .

EXPOSE 3000
CMD ["npm", "start"]
