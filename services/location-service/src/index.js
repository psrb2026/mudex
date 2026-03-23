/**
 * Location Service - Mudex (Versão Corrigida para Codespaces)
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
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/location-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/location-combined.log' })
  ]
});

const app = express();
app.use(express.json());

// --- AJUSTE DE CAMINHO PARA ESTRUTURA /SRC ---
// Como o arquivo está em /src, precisamos subir um nível (..) para achar a pasta /public
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
    // Tenta carregar o mapa. Se não existir, avisa que o serviço está online.
    const indexPath = path.join(__dirname, '..', 'public', 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            res.send('<h1>📍 Mudex Online</h1><p>Motor rodando, mas index.html não encontrado em /public.</p>');
        }
    });
});
// ---------------------------------------------

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000
});

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const RIDE_SERVICE_URL = process.env.RIDE_SERVICE_URL || 'http://localhost:3002';

let redisClient;
async function connectRedis() {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });
  redisClient.on('error', err => logger.error('Redis Error:', err));
  await redisClient.connect().catch(() => logger.error('Redis offline - verifique o container.'));
  logger.info('Location Service conectado ao Redis');
}
connectRedis();

const activeConnections = new Map();
const userSockets = new Map();

io.use(async (socket, next) => {
  try {
    const userId = socket.handshake.auth?.userId;
    const userType = socket.handshake.auth?.userType;
    if (!userId || !userType) return next(new Error('Autenticação necessária'));
    socket.userId = userId;
    socket.userType = userType;
    next();
  } catch (err) { next(new Error('Erro na autenticação')); }
});

io.on('connection', (socket) => {
  logger.info(`Conectado: ${socket.id} (User: ${socket.userId})`);
  activeConnections.set(socket.id, { userId: socket.userId, userType: socket.userType });
  userSockets.set(socket.userId, socket.id);

  socket.on('location:update', async (data) => {
    try {
      const { latitude, longitude, heading, speed } = data;
      if (latitude === undefined || longitude === undefined) return;

      if (socket.userType === 'driver') {
        await redisClient.geoAdd('drivers:online', {
          longitude: parseFloat(longitude),
          latitude: parseFloat(latitude),
          member: String(socket.userId)
        });
        
        await redisClient.hSet(`driver:${socket.userId}:location`, {
          lat: String(latitude),
          lng: String(longitude),
          lastUpdate: String(Date.now())
        });
        
        updateDriverLocation(socket.userId, latitude, longitude, true);
      }
      socket.emit('location:confirmed', { timestamp: Date.now() });
    } catch (err) { logger.error('Erro no update:', err); }
  });

  socket.on('disconnect', () => {
    const conn = activeConnections.get(socket.id);
    if (conn) {
      userSockets.delete(conn.userId);
      activeConnections.delete(socket.id);
    }
  });
});

app.get('/health', (req, res) => res.json({ status: 'OK', online: activeConnections.size }));

async function updateDriverLocation(driverId, lat, lng, isOnline) {
  try {
    await axios.patch(`${USER_SERVICE_URL}/drivers/${driverId}/location`, {
      latitude: lat, longitude: lng, is_online: isOnline
    }, { timeout: 1000 });
  } catch (e) { }
}

async function getActiveRide(userId, userType) {
  try {
    const { data } = await axios.get(`${RIDE_SERVICE_URL}/active`, {
      headers: { 'x-user-id': userId, 'x-user-type': userType },
      timeout: 1000
    });
    return data;
  } catch (e) { return null; }
}

// PORTA 8080 E IP 0.0.0.0 PARA O CODESPACES
const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 MUDEX RODANDO NA PORTA ${PORT}`);
  console.log(`🔗 Link: https://congenial-guide-x5jwvx4p547rhvrv6-${PORT}.app.github.dev/`);
});
