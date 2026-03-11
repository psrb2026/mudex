FROM node:18-alpine

# Instala bibliotecas necessárias para compilar o bcrypt no alpine
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copia os arquivos de dependência
COPY package*.json ./

RUN npm install

# Copia o restante dos arquivos do serviço
COPY . .

EXPOSE 3001
CMD ["npm", "start"]
