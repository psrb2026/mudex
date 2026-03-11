FROM node:18-alpine
WORKDIR /app

# Como o Docker já vai estar dentro da pasta pelo Compose, 
# pegamos o arquivo diretamente:
COPY package*.json ./

RUN npm install

# Copia tudo o que está na pasta api-gateway para dentro do container
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
