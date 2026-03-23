/**
 * Location Service - Mudex (ARQUIVO COMPLETO CORRIGIDO)
 * Local: services/location-service/src/index.js
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const redis = require('redis');
const winston = require('winston');
const axios = require('axios');
const path = require('path');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'location-service' },
  transports: [
    new winston.transports.Console()
  ]
});

const app = express();
app.use(express.json());

// Faz o Node encontrar a pasta public (onde está o mapa) subindo um nível
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, '..', 'public', 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            res.send('<h1>📍 Mudex Online</h1><p>Motor rodando! Se o mapa não apareceu, verifique se a pasta /public tem o arquivo index.html.</p>');
        }
    });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const RIDE_SERVICE_URL = process.env.RIDE_SERVICE_URL || 'http://localhost:3002';

// CONFIGURAÇÃO DO REDIS PARA RODAR FORA DO DOCKER
let redisClient;
async function connectRedis() {
  redisClient = redis.createClient({
    url: 'redis://localhost:6379' // Mudado de 'redis' para 'localhost'
  });
  redisClient.on('error', err => console.log('Aguardando Redis...'));
  try {
    await redisClient.connect();
    console.log('✅ Conectado ao Redis com sucesso!');
  } catch (err) {
    console.log('❌ Erro ao conectar no Redis. Certifique-se que o Docker está rodando.');
  }
}
connectRedis();

const activeConnections = new Map();
const userSockets = new Map();

io.on('connection', (socket) => {
  console.log(`📱 Novo dispositivo conectado: ${socket.id}`);
  
  socket.on('location:update', async (data) => {
    try {
      const { latitude, longitude } = data;
      if (latitude && longitude && redisClient.isOpen) {
        // Salva a localização no Redis
        await redisClient.geoAdd('drivers:online', {
          longitude: parseFloat(longitude),
          latitude: parseFloat(latitude),
          member: String(socket.id)
        });
      }
      socket.emit('location:confirmed', { timestamp: Date.now() });
    } catch (err) { console.error('Erro no GPS:', err); }
  });

  socket.on('disconnect', () => {
    console.log('❌ Dispositivo desconectado');
  });
});

// FORÇANDO PORTA 8080 E IP 0.0.0.0 PARA O CODESPACES
const PORT = 8080; 
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n*****************************************`);
  console.log(`🚀 MUDEX NO AR! PORTA: ${PORT}`);
  console.log(`🔗 USE O LINK DO GITHUB NA ABA "PORTS"`);
  console.log(`*****************************************\n`);
});
