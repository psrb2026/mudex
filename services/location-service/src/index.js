/**
 * Location Service - Mudex (VERSÃO ORIGINAL RESTAURADA + AJUSTE DE CONEXÃO)
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

// --- AJUSTE PARA O CELULAR ACHAR O MAPA ---
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, '..', 'public', 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            res.send('<h1>📍 Mudex Online</h1><p>Motor rodando, mas index.html não encontrado em /public.</p>');
        }
    });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const RIDE_SERVICE_URL = process.env.RIDE_SERVICE_URL || 'http://localhost:3002';

// REDIS AJUSTADO PARA LOCALHOST (Para rodar fora do Docker)
let redisClient;
async function connectRedis() {
  redisClient = redis.createClient({
    url: 'redis://127.0.0.1:6379' 
  });
  redisClient.on('error', err => console.log("Aguardando Redis..."));
  await redisClient.connect().catch(() => {});
}
connectRedis();

const activeConnections = new Map();
const userSockets = new Map();

io.on('connection', (socket) => {
  logger.info(`Conectado: ${socket.id}`);
  
  socket.on('location:update', async (data) => {
    try {
      const { latitude, longitude, userId, userType } = data;
      if (!latitude || !longitude) return;

      // Mantendo sua lógica original de salvar no Redis
      if (redisClient.isOpen) {
          await redisClient.geoAdd('drivers:online', {
            longitude: parseFloat(longitude),
            latitude: parseFloat(latitude),
            member: String(userId || socket.id)
          });
      }
      socket.emit('location:confirmed', { timestamp: Date.now() });
    } catch (err) { logger.error('Erro no update:', err); }
  });

  socket.on('disconnect', () => {
    activeConnections.delete(socket.id);
  });
});

// --- O AJUSTE QUE MATA O ERRO 502 NO CODESPACES ---
const PORT = 8080; 
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 MUDEX ONLINE NA PORTA ${PORT}`);
  console.log(`🔗 Verifique a aba PORTS e deixe como PUBLIC`);
});
