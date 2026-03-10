FROM node:18-alpine
WORKDIR /app
# Copia o package.json da pasta api-gateway para dentro do container
COPY api-gateway/package*.json ./
RUN npm install
# Copia todo o conteúdo da pasta api-gateway para dentro do container
COPY api-gateway/ .
EXPOSE 3000
CMD ["npm", "start"]
