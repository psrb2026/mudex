FROM node:18-alpine

WORKDIR /app

# Copia os arquivos de dependências
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia todo o conteúdo da pasta user-service para dentro do container
COPY . .

# Expõe a porta 3000 (padrão do serviço)
EXPOSE 3000

# Comando para rodar
CMD ["node", "index.js"]
