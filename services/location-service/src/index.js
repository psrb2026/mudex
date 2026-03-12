/**
 * Location Service - Mudex (Versão Corrigida)
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const redis = require('redis');
const winston = require('winston');
const axios = require('axios');

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
app.use(express.json()); // Adicionado para suportar JSON no corpo das requisições

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Configuração de URLs de Microserviços
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const RIDE_SERVICE_URL = process.env.RIDE_SERVICE_URL || 'http://localhost:3002';

// Redis
let redisClient;
async function connectRedis() {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });
  redisClient.on('error', err => logger.error('Redis Error:', err));
  await redisClient.connect();
  logger.info('Location Service conectado ao Redis');
}
connectRedis();

const activeConnections = new Map();
const userSockets = new Map();

// Middleware de autenticação para Socket.io
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const userType = socket.handshake.auth?.userType;
    const userId = socket.handshake.auth?.userId;

    if (!userId || !userType) {
      return next(new Error('Autenticação necessária: userId e userType são obrigatórios'));
    }

    socket.userId = userId;
    socket.userType = userType;
    next();
  } catch (err) {
    next(new Error('Erro na autenticação'));
  }
});

io.on('connection', (socket) => {
  logger.info(`Conectado: ${socket.id} (User: ${socket.userId}, Type: ${socket.userType})`);
  
  activeConnections.set(socket.id, {
    userId: socket.userId,
    userType: socket.userType,
    connectedAt: new Date()
  });
  userSockets.set(socket.userId, socket.id);

  socket.on('location:update', async (data) => {
    try {
      const { latitude, longitude, heading, speed } = data;
      
      if (latitude === undefined || longitude === undefined) return;

      const locationData = {
        userId: socket.userId,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        heading: heading || 0,
        speed: speed || 0,
        timestamp: new Date().toISOString()
      };

      if (socket.userType === 'driver') {
        // Redis GEO - CORRIGIDO: member deve ser string
        await redisClient.geoAdd('drivers:online', {
          longitude: locationData.longitude,
          latitude: locationData.latitude,
          member: String(socket.userId)
        });
        
        await redisClient.hSet(`driver:${socket.userId}:location`, {
          lat: String(locationData.latitude),
          lng: String(locationData.longitude),
          heading: String(locationData.heading),
          speed: String(locationData.speed),
          lastUpdate: String(Date.now()),
          socketId: socket.id
        });
        
        // Update assíncrono (não trava o socket)
        updateDriverLocation(socket.userId, locationData.latitude, locationData.longitude, true);
      }

      // Notificar cliente se houver corrida ativa
      const activeRide = await getActiveRide(socket.userId, socket.userType);
      if (activeRide && socket.userType === 'driver') {
        const customerSocketId = userSockets.get(String(activeRide.customer_id));
        if (customerSocketId) {
          io.to(customerSocketId).emit('driver:location', {
            ride_id: activeRide.id,
            location: locationData
          });
        }
      }

      socket.emit('location:confirmed', { timestamp: Date.now() });
    } catch (err) {
      logger.error('Erro location:update:', err);
    }
  });

  socket.on('disconnect', async () => {
    const conn = activeConnections.get(socket.id);
    if (conn) {
      if (conn.userType === 'driver') {
        // Aguarda reconexão antes de remover do GEO
        setTimeout(async () => {
          if (userSockets.get(conn.userId) === socket.id) {
             await redisClient.zRem('drivers:online', String(conn.userId));
             await redisClient.sRem('drivers:active', String(conn.userId));
             userSockets.delete(conn.userId);
          }
        }, 5000);
      } else {
        userSockets.delete(conn.userId);
      }
      activeConnections.delete(socket.id);
    }
  });
});

// API HTTP
app.get('/nearby-drivers', async (req, res) => {
  try {
    const { lat, lng, radius = 5000 } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'Lat/Lng requeridos' });

    // GEOSEARCH - Versão compatível com Redis 6.2+
    const drivers = await redisClient.geoSearch('drivers:online', 
      { latitude: parseFloat(lat), longitude: parseFloat(lng) },
      { radius: parseInt(radius), unit: 'm' },
      ['WITHDIST', 'WITHCOORD']
    );

    res.json({ drivers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', async (req, res) => {
  res.json({ status: 'OK', connections: activeConnections.size });
});

// Helpers com tratamento de erro
async function updateDriverLocation(driverId, lat, lng, isOnline) {
  try {
    await axios.patch(`${USER_SERVICE_URL}/drivers/${driverId}/location`, {
      latitude: lat, longitude: lng, is_online: isOnline
    }, { timeout: 2000 });
  } catch (e) { /* Silencioso para não travar main thread */ }
}

async function getActiveRide(userId, userType) {
  try {
    const { data } = await axios.get(`${RIDE_SERVICE_URL}/active`, {
      headers: { 'x-user-id': userId, 'x-user-type': userType },
      timeout: 2000
    });
    return data;
  } catch (e) { return null; }
}

const PORT = process.env.PORT || 3005;
httpServer.listen(PORT, () => logger.info(`📍 Location Service na porta ${PORT}`));
