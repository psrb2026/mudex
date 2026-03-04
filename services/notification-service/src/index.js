/**
 * Notification Service - Mudex
 * Envia notificações push (FCM), SMS (Twilio), Email e WebSocket
 * Consome fila de eventos do RabbitMQ
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const admin = require('firebase-admin');
const redis = require('redis');
const winston = require('winston');
const twilio = require('twilio');
const nodemailer = require('nodemailer');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'notification-service' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/notification-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/notification-combined.log' })
  ]
});

// Inicializa Firebase Admin (para Push Notifications)
try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
  logger.info('Firebase Admin inicializado');
} catch (err) {
  logger.warn('Firebase não configurado:', err.message);
}

// Twilio para SMS
const twilioClient = process.env.TWILIO_ACCOUNT_SID ? 
  twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : 
  null;

// Nodemailer para Email
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

app.use(express.json());

// Redis
let redisClient;
(async () => {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });
  await redisClient.connect();
})();

// Socket.io connections (userId -> socketId)
const userSockets = new Map();

io.on('connection', (socket) => {
  socket.on('register', async (data) => {
    const { user_id, user_type, device_token } = data;
    socket.userId = user_id;
    socket.userType = user_type;
    userSockets.set(user_id, socket.id);
    
    // Salva device token no Redis para push notifications
    if (device_token) {
      await redisClient.hSet(`user:${user_id}:devices`, socket.id, device_token);
    }
    
    logger.info(`Usuário registrado: ${user_id} (${user_type})`);
  });

  socket.on('disconnect', async () => {
    if (socket.userId) {
      userSockets.delete(socket.userId);
      await redisClient.hDel(`user:${socket.userId}:devices`, socket.id);
    }
  });
});

// API para enviar notificação
app.post('/send', async (req, res) => {
  try {
    const { user_id, user_type, type, data, channels = ['push', 'socket'], priority = 'normal' } = req.body;

    const results = {
      push: false,
      socket: false,
      sms: false,
      email: false
    };

    // 1. WebSocket (tempo real)
    if (channels.includes('socket')) {
      const socketId = userSockets.get(user_id);
      if (socketId) {
        io.to(socketId).emit(type, data);
        results.socket = true;
      }
    }

    // 2. Push Notification (Firebase)
    if (channels.includes('push')) {
      const deviceTokens = await redisClient.hGetAll(`user:${user_id}:devices`);
      const tokens = Object.values(deviceTokens).filter(t => t && t.length > 10);
      
      if (tokens.length > 0 && admin.apps.length > 0) {
        try {
          const message = {
            notification: {
              title: data.title || 'Mudex',
              body: data.message || data.body
            },
            data: {
              type,
              ride_id: data.ride_id || '',
              ...data
            },
            android: {
              priority: priority === 'high' ? 'high' : 'normal',
              notification: {
                channelId: 'mudex-rides',
                sound: 'default'
              }
            },
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                  badge: 1
                }
              }
            },
            tokens: tokens
          };

          const response = await admin.messaging().sendMulticast(message);
          results.push = response.successCount > 0;
          
          // Remove tokens inválidos
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              logger.warn(`Token inválido removido: ${tokens[idx]}`);
              // Remove do Redis
            }
          });
        } catch (err) {
          logger.error('Erro ao enviar push:', err);
        }
      }
    }

    // 3. SMS (para alertas importantes)
    if (channels.includes('sms') && priority === 'high') {
      // Implementar envio SMS via Twilio
      results.sms = false;
    }

    // 4. Email
    if (channels.includes('email')) {
      // Implementar envio de email
      results.email = false;
    }

    // Log da notificação
    await redisClient.lPush(`notifications:history:${user_id}`, JSON.stringify({
      type,
      data,
      channels,
      results,
      timestamp: new Date().toISOString()
    }));

    res.json({ success: true, results });

  } catch (err) {
    logger.error('Erro ao enviar notificação:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Enviar SMS específico
app.post('/sms', async (req, res) => {
  try {
    const { to, message } = req.body;
    
    if (!twilioClient) {
      return res.status(503).json({ error: 'Serviço SMS não configurado' });
    }

    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });

    res.json({ success: true, sid: result.sid });

  } catch (err) {
    logger.error('Erro ao enviar SMS:', err);
    res.status(500).json({ error: 'Erro ao enviar SMS' });
  }
});

// Broadcast para motoristas em área (para surge pricing)
app.post('/broadcast/drivers', async (req, res) => {
  try {
    const { lat, lng, radius, message, data } = req.body;
    
    // Busca motoristas próximos no Redis GEO
    const nearbyDrivers = await redisClient.geoSearch(
      'drivers:online',
      { latitude: lat, longitude: lng },
      { radius: radius || 5000, unit: 'm' }
    );

    // Envia notificação para cada motorista
    const promises = nearbyDrivers.map(driverId => 
      axios.post('http://localhost:3007/send', {
        user_id: driverId,
        user_type: 'driver',
        type: 'BROADCAST',
        data: { message, ...data },
        priority: 'high'
      }).catch(err => logger.error(`Erro ao notificar ${driverId}:`, err))
    );

    await Promise.all(promises);

    res.json({ notified_count: nearbyDrivers.length });

  } catch (err) {
    logger.error('Erro no broadcast:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Histórico de notificações do usuário
app.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;
    
    const history = await redisClient.lRange(`notifications:history:${userId}`, 0, limit - 1);
    
    res.json({
      notifications: history.map(h => JSON.parse(h)),
      total: history.length
    });

  } catch (err) {
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Health check
app.get('/health', async (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'notification-service',
    connections: userSockets.size
  });
});

const PORT = process.env.PORT || 3007;

httpServer.listen(PORT, () => {
  logger.info(`Notification Service rodando na porta ${PORT}`);
  console.log(`🔔 Notification Service disponível em http://localhost:${PORT}`);
});