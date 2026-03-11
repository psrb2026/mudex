FROM node:18-alpine
WORKDIR /app

# Agora o arquivo existe, então o COPY vai funcionar!
COPY package*.json ./

RUN npm install

# Copia o index.js e o resto
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
