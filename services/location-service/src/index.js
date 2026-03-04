/**
 * Location Service - Mudex
 * Gerencia atualizações de localização em tempo real
 * Redis GEO para indexação espacial e Socket.io para comunicação
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
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Redis
let redisClient;
(async () => {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });
  redisClient.on('error', err => logger.error('Redis Error:', err));
  await redisClient.connect();
  logger.info('Location Service conectado ao Redis');
})();

// Mapa de conexões ativas (socketId -> userInfo)
const activeConnections = new Map();
// Mapa de usuários online (userId -> socketId)
const userSockets = new Map();

// Middleware de autenticação para Socket.io
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const userType = socket.handshake.auth.userType; // 'customer' ou 'driver'
    
    if (!token || !userType) {
      return next(new Error('Autenticação necessária'));
    }

    // Valida token com Auth Service (simplificado)
    // Em produção: await axios.post(`${AUTH_SERVICE_URL}/verify`, { token });
    const decoded = { userId: socket.handshake.auth.userId, type: userType };
    
    socket.userId = decoded.userId;
    socket.userType = userType;
    next();
  } catch (err) {
    next(new Error('Token inválido'));
  }
});

io.on('connection', (socket) => {
  logger.info(`Nova conexão: ${socket.id} - Usuário: ${socket.userId} (${socket.userType})`);
  
  // Registra conexão
  activeConnections.set(socket.id, {
    userId: socket.userId,
    userType: socket.userType,
    connectedAt: new Date(),
    lastLocation: null
  });
  userSockets.set(socket.userId, socket.id);

  // Motorista: atualiza localização
  socket.on('location:update', async (data) => {
    try {
      const { latitude, longitude, heading, speed, accuracy } = data;
      
      if (!latitude || !longitude) {
        return socket.emit('error', { message: 'Latitude e longitude necessárias' });
      }

      const locationData = {
        userId: socket.userId,
        latitude,
        longitude,
        heading: heading || 0,
        speed: speed || 0,
        accuracy: accuracy || 0,
        timestamp: new Date().toISOString()
      };

      // Atualiza no Redis GEO
      if (socket.userType === 'driver') {
        await redisClient.geoAdd('drivers:online', {
          longitude,
          latitude,
          member: socket.userId
        });
        
        // Salva metadados adicionais
        await redisClient.hSet(`driver:${socket.userId}:location`, {
          heading: String(heading || 0),
          speed: String(speed || 0),
          lastUpdate: Date.now(),
          socketId: socket.id
        });
        
        // Atualiza no User Service
        await updateDriverLocation(socket.userId, latitude, longitude, true);
      }

      // Atualiza conexão local
      const conn = activeConnections.get(socket.id);
      if (conn) {
        conn.lastLocation = locationData;
      }

      // Se motorista em corrida ativa, notifica cliente
      const activeRide = await getActiveRide(socket.userId, socket.userType);
      if (activeRide && socket.userType === 'driver') {
        const customerSocketId = userSockets.get(activeRide.customer_id);
        if (customerSocketId) {
          io.to(customerSocketId).emit('driver:location', {
            ride_id: activeRide.id,
            location: locationData
          });
        }
      }

      socket.emit('location:confirmed', { timestamp: Date.now() });

    } catch (err) {
      logger.error('Erro ao atualizar localização:', err);
      socket.emit('error', { message: 'Erro ao processar localização' });
    }
  });

  // Cliente: solicitar tracking de motorista
  socket.on('ride:track', async (data) => {
    try {
      const { ride_id } = data;
      
      // Verifica se cliente pertence a esta corrida
      const ride = await getRide(ride_id);
      if (!ride || ride.customer_id !== socket.userId) {
        return socket.emit('error', { message: 'Não autorizado' });
      }

      if (ride.driver_id && ride.status === 'accepted') {
        // Busca localização atual do motorista
        const driverLocation = await redisClient.hGetAll(`driver:${ride.driver_id}:location`);
        
        if (driverLocation) {
          socket.emit('driver:location', {
            ride_id,
            location: {
              userId: ride.driver_id,
              latitude: parseFloat(driverLocation.lat) || 0,
              longitude: parseFloat(driverLocation.lng) || 0,
              heading: parseInt(driverLocation.heading) || 0,
              lastUpdate: driverLocation.lastUpdate
            }
          });
        }

        // Entra na sala da corrida para updates em tempo real
        socket.join(`ride:${ride_id}`);
      }
    } catch (err) {
      logger.error('Erro ao iniciar tracking:', err);
    }
  });

  // Motorista: ficar online/offline
  socket.on('driver:status', async (data) => {
    if (socket.userType !== 'driver') return;
    
    const { is_online } = data;
    
    if (is_online) {
      await redisClient.sAdd('drivers:active', socket.userId);
      logger.info(`Motorista ${socket.userId} ficou online`);
    } else {
      await redisClient.sRem('drivers:active', socket.userId);
      await redisClient.zRem('drivers:online', socket.userId);
      await redisClient.del(`driver:${socket.userId}:location`);
      await updateDriverLocation(socket.userId, null, null, false);
      logger.info(`Motorista ${socket.userId} ficou offline`);
    }
  });

  // Desconexão
  socket.on('disconnect', async (reason) => {
    logger.info(`Desconexão: ${socket.id} - Razão: ${reason}`);
    
    const conn = activeConnections.get(socket.id);
    if (conn) {
      // Se motorista, marca como offline após delay (para reconexões rápidas)
      if (conn.userType === 'driver') {
        setTimeout(async () => {
          // Verifica se reconectou
          const newSocketId = userSockets.get(conn.userId);
          if (!newSocketId || newSocketId === socket.id) {
            await redisClient.sRem('drivers:active', conn.userId);
            await redisClient.zRem('drivers:online', conn.userId);
            await updateDriverLocation(conn.userId, null, null, false);
            userSockets.delete(conn.userId);
          }
        }, 30000); // 30 segundos de tolerância
      } else {
        userSockets.delete(conn.userId);
      }
      
      activeConnections.delete(socket.id);
    }
  });
});

// HTTP API para consultas de localização

// Buscar motoristas próximos
app.get('/nearby-drivers', async (req, res) => {
  try {
    const { lat, lng, radius = 5000, limit = 10 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude e longitude necessárias' });
    }

    const drivers = await redisClient.geoSearchWith(
      'drivers:online',
      { latitude: parseFloat(lat), longitude: parseFloat(lng) },
      { radius: parseInt(radius), unit: 'm' },
      { COUNT: parseInt(limit), WITHDIST: true, WITHCOORD: true }
    );

    // Enriquece com dados dos motoristas
    const enrichedDrivers = await Promise.all(
      drivers.map(async (driver) => {
        const metadata = await redisClient.hGetAll(`driver:${driver.member}:location`);
        return {
          driver_id: driver.member,
          distance: parseFloat(driver.distance),
          location: {
            latitude: driver.coordinate.latitude,
            longitude: driver.coordinate.longitude
          },
          heading: parseInt(metadata.heading) || 0,
          speed: parseFloat(metadata.speed) || 0,
          last_update: parseInt(metadata.lastUpdate) || Date.now()
        };
      })
    );

    res.json({
      drivers: enrichedDrivers,
      total: enrichedDrivers.length,
      search_radius: parseInt(radius)
    });

  } catch (err) {
    logger.error('Erro ao buscar motoristas próximos:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Calcular ETA (Estimated Time of Arrival)
app.get('/eta', async (req, res) => {
  try {
    const { from_lat, from_lng, to_lat, to_lng } = req.query;
    
    if (!from_lat || !from_lng || !to_lat || !to_lng) {
      return res.status(400).json({ error: 'Coordenadas necessárias' });
    }

    // Cálculo simplificado - em produção usar Google Maps Distance Matrix
    const distance = calculateDistance(
      parseFloat(from_lat), parseFloat(from_lng),
      parseFloat(to_lat), parseFloat(to_lng)
    );
    
    // Assumindo velocidade média de 30km/h em cidade
    const durationMinutes = Math.ceil((distance / 30) * 60);

    res.json({
      distance_km: distance.toFixed(2),
      duration_minutes: durationMinutes,
      traffic_factor: 1.0 // 1.0 = sem tráfego, >1 = com tráfego
    });

  } catch (err) {
    logger.error('Erro ao calcular ETA:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Geocoding reverso (coordenadas -> endereço)
app.get('/reverse-geocode', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    // Em produção: integrar com Google Maps Geocoding API
    // Simulação:
    res.json({
      address: `Rua Exemplo, ${Math.floor(Math.random() * 1000)} - Bairro`,
      city: 'São Paulo',
      state: 'SP',
      country: 'Brasil',
      postal_code: '00000-000'
    });

  } catch (err) {
    res.status(500).json({ error: 'Erro ao geocodificar' });
  }
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await redisClient.ping();
    res.json({ 
      status: 'OK', 
      service: 'location-service',
      connections: activeConnections.size,
      online_drivers: await redisClient.sCard('drivers:active')
    });
  } catch (err) {
    res.status(503).json({ status: 'ERROR', error: err.message });
  }
});

// Funções auxiliares
async function updateDriverLocation(driverId, lat, lng, isOnline) {
  try {
    await axios.patch(`${process.env.USER_SERVICE_URL}/drivers/${driverId}/location`, {
      latitude: lat,
      longitude: lng,
      is_online: isOnline
    });
  } catch (err) {
    logger.error(`Erro ao atualizar localização no User Service: ${err.message}`);
  }
}

async function getActiveRide(userId, userType) {
  try {
    // Busca corrida ativa no Ride Service
    const { data } = await axios.get(`${process.env.RIDE_SERVICE_URL}/active`, {
      headers: {
        'x-user-id': userId,
        'x-user-type': userType
      }
    });
    return data;
  } catch (err) {
    return null;
  }
}

async function getRide(rideId) {
  try {
    const { data } = await axios.get(`${process.env.RIDE_SERVICE_URL}/${rideId}`);
    return data;
  } catch (err) {
    return null;
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const PORT = process.env.PORT || 3005;

httpServer.listen(PORT, () => {
  logger.info(`Location Service rodando na porta ${PORT}`);
  console.log(`📍 Location Service disponível em http://localhost:${PORT}`);
});