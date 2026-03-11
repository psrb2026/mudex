FROM node:18-alpine

WORKDIR /app

# Adicionei essas bibliotecas caso você use criptografia de senha (bcrypt)
RUN apk add --no-cache postgresql-client python3 make g++

COPY package*.json ./
RUN npm install

COPY . .

# Mudando para 3002 para não bater com o Gateway
EXPOSE 3002

CMD ["npm", "start"]
