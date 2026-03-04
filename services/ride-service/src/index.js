/**
 * Ride Service - Mudex
 * Gerencia o ciclo de vida completo das corridas: solicitação, match, início, fim
 */

const express = require('express');
const { Sequelize, DataTypes, Op } = require('sequelize');
const Joi = require('joi');
const winston = require('winston');
const redis = require('redis');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'ride-service' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/ride-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/ride-combined.log' })
  ]
});

const app = express();
app.use(express.json());

// Conexão com PostgreSQL
const sequelize = new Sequelize(
  process.env.DB_NAME || 'mudex_rides',
  process.env.DB_USER || 'mudex',
  process.env.DB_PASSWORD || 'mudex123',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: msg => logger.debug(msg)
  }
);

// Redis para cache de corridas ativas
let redisClient;
(async () => {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });
  redisClient.on('error', err => logger.error('Redis Error:', err));
  await redisClient.connect();
})();

// Modelo de Corrida
const Ride = sequelize.define('Ride', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  customer_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  driver_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM(
      'requested',      // Cliente solicitou
      'searching',      // Procurando motorista
      'offered',        // Oferecido a motorista(es)
      'accepted',       // Motorista aceitou
      'arrived',        // Motorista chegou ao local
      'in_progress',    // Corrida em andamento
      'completed',      // Corrida finalizada
      'cancelled',      // Cancelada
      'no_driver_found' // Nenhum motorista encontrado
    ),
    defaultValue: 'requested'
  },
  // Localização de origem
  pickup_address: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  pickup_latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false
  },
  pickup_longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false
  },
  // Localização de destino
  dropoff_address: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  dropoff_latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false
  },
  dropoff_longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false
  },
  // Detalhes da corrida
  vehicle_type: {
    type: DataTypes.ENUM('economy', 'comfort', 'premium', 'suv', 'taxi'),
    defaultValue: 'economy'
  },
  estimated_distance: {
    type: DataTypes.DECIMAL(10, 2), // em km
  },
  estimated_duration: {
    type: DataTypes.INTEGER, // em minutos
  },
  estimated_price: {
    type: DataTypes.DECIMAL(10, 2),
  },
  surge_multiplier: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 1.00
  },
  // Valores finais
  actual_distance: {
    type: DataTypes.DECIMAL(10, 2),
  },
  actual_duration: {
    type: DataTypes.INTEGER,
  },
  final_price: {
    type: DataTypes.DECIMAL(10, 2),
  },
  // Pagamento
  payment_method: {
    type: DataTypes.ENUM('credit_card', 'debit_card', 'pix', 'cash'),
    allowNull: false
  },
  payment_status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'refunded'),
    defaultValue: 'pending'
  },
  // Timestamps importantes
  requested_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  },
  accepted_at: {
    type: DataTypes.DATE,
  },
  arrived_at: {
    type: DataTypes.DATE,
  },
  started_at: {
    type: DataTypes.DATE,
  },
  completed_at: {
    type: DataTypes.DATE,
  },
  cancelled_at: {
    type: DataTypes.DATE,
  },
  cancel_reason: {
    type: DataTypes.TEXT,
  },
  cancelled_by: {
    type: DataTypes.ENUM('customer', 'driver', 'system'),
  },
  // Rota e tracking
  route_polyline: {
    type: DataTypes.TEXT, // Encoded polyline do Google Maps
  },
  driver_location_history: {
    type: DataTypes.JSONB, // Array de {lat, lng, timestamp}
  },
  // Avaliações
  customer_rating: {
    type: DataTypes.INTEGER,
    validate: { min: 1, max: 5 }
  },
  driver_rating: {
    type: DataTypes.INTEGER,
    validate: { min: 1, max: 5 }
  },
  // Metadados
  device_info: {
    type: DataTypes.JSONB,
  },
  notes: {
    type: DataTypes.TEXT,
  }
}, {
  tableName: 'rides',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['customer_id', 'status'] },
    { fields: ['driver_id', 'status'] },
    { fields: ['status', 'requested_at'] },
    { fields: ['pickup_latitude', 'pickup_longitude'] }
  ]
});

// Modelo de Oferta de Corrida (para tracking de ofertas a motoristas)
const RideOffer = sequelize.define('RideOffer', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  ride_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  driver_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'expired', 'timeout'),
    defaultValue: 'pending'
  },
  offered_at: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  },
  responded_at: {
    type: DataTypes.DATE,
  },
  driver_distance_at_offer: {
    type: DataTypes.DECIMAL(10, 2), // em metros
  },
  driver_eta_at_offer: {
    type: DataTypes.INTEGER, // em segundos
  },
  score_at_offer: {
    type: DataTypes.DECIMAL(5, 2),
  }
}, {
  tableName: 'ride_offers',
  timestamps: true,
  underscored: true
});

// Schemas de validação
const requestRideSchema = Joi.object({
  pickup_address: Joi.string().required(),
  pickup_latitude: Joi.number().min(-90).max(90).required(),
  pickup_longitude: Joi.number().min(-180).max(180).required(),
  dropoff_address: Joi.string().required(),
  dropoff_latitude: Joi.number().min(-90).max(90).required(),
  dropoff_longitude: Joi.number().min(-180).max(180).required(),
  vehicle_type: Joi.string().valid('economy', 'comfort', 'premium', 'suv', 'taxi').default('economy'),
  payment_method: Joi.string().valid('credit_card', 'debit_card', 'pix', 'cash').required(),
  notes: Joi.string().max(500).optional()
});

// Middleware de autenticação simplificado
const verifyToken = (req, res, next) => {
  req.user = {
    id: req.headers['x-user-id'],
    type: req.headers['x-user-type']
  };
  next();
};

// Calcular estimativa de preço (simulado - integrar com Google Maps Distance Matrix em produção)
app.post('/estimate', verifyToken, async (req, res) => {
  try {
    const { pickup_latitude, pickup_longitude, dropoff_latitude, dropoff_longitude, vehicle_type } = req.body;

    // Distância euclidiana simplificada (em produção usar rota real)
    const distance = calculateDistance(
      pickup_latitude, pickup_longitude,
      dropoff_latitude, dropoff_longitude
    );
    
    // Estimativa de duração (assumindo velocidade média de 30km/h)
    const duration = Math.ceil((distance / 30) * 60);

    // Preços base por tipo de veículo (R$)
    const basePrices = {
      economy: { base: 5, perKm: 2.5, perMin: 0.5 },
      comfort: { base: 8, perKm: 3.5, perMin: 0.7 },
      premium: { base: 12, perKm: 5.0, perMin: 1.0 },
      suv: { base: 10, perKm: 4.5, perMin: 0.8 },
      taxi: { base: 4, perKm: 2.2, perMin: 0.4 }
    };

    const pricing = basePrices[vehicle_type] || basePrices.economy;
    const estimatedPrice = pricing.base + (distance * pricing.perKm) + (duration * pricing.perMin);

    // Verifica surge pricing
    const surgeMultiplier = await checkSurgePricing(pickup_latitude, pickup_longitude);
    const finalPrice = estimatedPrice * surgeMultiplier;

    res.json({
      distance: distance.toFixed(2),
      duration: duration,
      vehicle_type: vehicle_type,
      estimated_price: finalPrice.toFixed(2),
      surge_multiplier: surgeMultiplier,
      currency: 'BRL',
      breakdown: {
        base_fare: pricing.base,
        distance_fare: (distance * pricing.perKm).toFixed(2),
        time_fare: (duration * pricing.perMin).toFixed(2),
        surge_amount: ((estimatedPrice * surgeMultiplier) - estimatedPrice).toFixed(2)
      }
    });
  } catch (err) {
    logger.error('Erro na estimativa:', err);
    res.status(500).json({ error: 'Erro ao calcular estimativa' });
  }
});

// Verificar surge pricing (consulta Redis ou calcula localmente)
async function checkSurgePricing(lat, lng) {
  try {
    // Busca fator de surge na região (geohash aproximado)
    const geohash = encodeGeohash(lat, lng, 5); // ~2.4km de precisão
    const surgeData = await redisClient.get(`surge:${geohash}`);
    
    if (surgeData) {
      const { multiplier, expires } = JSON.parse(surgeData);
      if (new Date(expires) > new Date()) {
        return parseFloat(multiplier);
      }
    }
    
    return 1.0; // Sem surge
  } catch (err) {
    logger.error('Erro ao verificar surge:', err);
    return 1.0;
  }
}

// Solicitar corrida
app.post('/request', verifyToken, async (req, res) => {
  try {
    if (req.user.type !== 'customer') {
      return res.status(403).json({ error: 'Apenas clientes podem solicitar corridas' });
    }

    const { error, value } = requestRideSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Verifica se cliente já tem corrida ativa
    const activeRide = await Ride.findOne({
      where: {
        customer_id: req.user.id,
        status: {
          [Op.notIn]: ['completed', 'cancelled', 'no_driver_found']
        }
      }
    });

    if (activeRide) {
      return res.status(409).json({ 
        error: 'Você já tem uma corrida em andamento',
        active_ride_id: activeRide.id
      });
    }

    // Calcula estimativas
    const distance = calculateDistance(
      value.pickup_latitude, value.pickup_longitude,
      value.dropoff_latitude, value.dropoff_longitude
    );
    const duration = Math.ceil((distance / 30) * 60);

    // Verifica surge pricing
    const surgeMultiplier = await checkSurgePricing(value.pickup_latitude, value.pickup_longitude);

    // Preço estimado
    const pricing = { base: 5, perKm: 2.5, perMin: 0.5 }; // Simplificado
    const estimatedPrice = (pricing.base + (distance * pricing.perKm) + (duration * pricing.perMin)) * surgeMultiplier;

    // Cria corrida
    const ride = await Ride.create({
      customer_id: req.user.id,
      status: 'requested',
      ...value,
      estimated_distance: distance,
      estimated_duration: duration,
      estimated_price: estimatedPrice,
      surge_multiplier: surgeMultiplier,
      requested_at: new Date()
    });

    // Salva no Redis para acesso rápido
    await redisClient.setEx(`ride:${ride.id}`, 3600, JSON.stringify({
      id: ride.id,
      status: ride.status,
      customer_id: ride.customer_id,
      pickup: { lat: ride.pickup_latitude, lng: ride.pickup_longitude },
      dropoff: { lat: ride.dropoff_latitude, lng: ride.dropoff_longitude }
    }));

    // Notifica Dispatch Service (via HTTP ou RabbitMQ)
    notifyDispatchService(ride);

    logger.info(`Nova corrida solicitada: ${ride.id} por ${req.user.id}`);
    
    res.status(201).json({
      ride_id: ride.id,
      status: ride.status,
      estimated_price: estimatedPrice.toFixed(2),
      surge_multiplier: surgeMultiplier,
      estimated_pickup_time: '3-5 min',
      message: 'Buscando motorista próximo...'
    });

  } catch (err) {
    logger.error('Erro ao solicitar corrida:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Aceitar corrida (chamado pelo Dispatch Service quando motorista aceita)
app.post('/:rideId/accept', verifyToken, async (req, res) => {
  try {
    const { rideId } = req.params;
    const { driver_id } = req.body;

    const ride = await Ride.findByPk(rideId);
    if (!ride) {
      return res.status(404).json({ error: 'Corrida não encontrada' });
    }

    if (ride.status !== 'offered' && ride.status !== 'searching') {
      return res.status(400).json({ error: 'Corrida não disponível para aceite' });
    }

    await ride.update({
      driver_id,
      status: 'accepted',
      accepted_at: new Date()
    });

    // Atualiza cache Redis
    await redisClient.setEx(`ride:${rideId}`, 3600, JSON.stringify({
      id: ride.id,
      status: 'accepted',
      customer_id: ride.customer_id,
      driver_id,
      pickup: { lat: ride.pickup_latitude, lng: ride.pickup_longitude }
    }));

    // Notifica cliente via WebSocket (Notification Service)
    notifyCustomer(ride.customer_id, {
      type: 'DRIVER_ASSIGNED',
      ride_id: rideId,
      driver_id,
      message: 'Motorista a caminho!'
    });

    res.json({ success: true, ride_id: rideId, status: 'accepted' });
  } catch (err) {
    logger.error('Erro ao aceitar corrida:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Motorista chegou ao local
app.post('/:rideId/arrived', verifyToken, async (req, res) => {
  try {
    const { rideId } = req.params;
    const ride = await Ride.findByPk(rideId);

    if (!ride || ride.driver_id !== req.user.id) {
      return res.status(403).json({ error: 'Não autorizado' });
    }

    await ride.update({
      status: 'arrived',
      arrived_at: new Date()
    });

    notifyCustomer(ride.customer_id, {
      type: 'DRIVER_ARRIVED',
      ride_id: rideId,
      message: 'Seu motorista chegou!'
    });

    res.json({ success: true });
  } catch (err) {
    logger.error('Erro ao registrar chegada:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Iniciar corrida
app.post('/:rideId/start', verifyToken, async (req, res) => {
  try {
    const { rideId } = req.params;
    const ride = await Ride.findByPk(rideId);

    if (!ride || ride.driver_id !== req.user.id) {
      return res.status(403).json({ error: 'Não autorizado' });
    }

    if (ride.status !== 'arrived') {
      return res.status(400).json({ error: 'Motorista deve marcar chegada primeiro' });
    }

    await ride.update({
      status: 'in_progress',
      started_at: new Date()
    });

    notifyCustomer(ride.customer_id, {
      type: 'RIDE_STARTED',
      ride_id: rideId,
      message: 'Corrida iniciada!'
    });

    res.json({ success: true });
  } catch (err) {
    logger.error('Erro ao iniciar corrida:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Finalizar corrida
app.post('/:rideId/complete', verifyToken, async (req, res) => {
  try {
    const { rideId } = req.params;
    const { actual_distance, actual_duration, final_price, route_polyline } = req.body;

    const ride = await Ride.findByPk(rideId);
    if (!ride || ride.driver_id !== req.user.id) {
      return res.status(403).json({ error: 'Não autorizado' });
    }

    if (ride.status !== 'in_progress') {
      return res.status(400).json({ error: 'Corrida não está em andamento' });
    }

    await ride.update({
      status: 'completed',
      completed_at: new Date(),
      actual_distance,
      actual_duration,
      final_price,
      route_polyline,
      payment_status: ride.payment_method === 'cash' ? 'completed' : 'processing'
    });

    // Limpa cache
    await redisClient.del(`ride:${rideId}`);

    // Notifica ambos
    notifyCustomer(ride.customer_id, {
      type: 'RIDE_COMPLETED',
      ride_id: rideId,
      final_price,
      message: 'Corrida finalizada! Obrigado por usar Mudex.'
    });

    // Trigger pagamento se não for dinheiro
    if (ride.payment_method !== 'cash') {
      processPayment(ride);
    }

    res.json({ success: true, final_price });
  } catch (err) {
    logger.error('Erro ao finalizar corrida:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Cancelar corrida
app.post('/:rideId/cancel', verifyToken, async (req, res) => {
  try {
    const { rideId } = req.params;
    const { reason } = req.body;

    const ride = await Ride.findByPk(rideId);
    if (!ride) {
      return res.status(404).json({ error: 'Corrida não encontrada' });
    }

    // Verifica permissão
    const isCustomer = ride.customer_id === req.user.id;
    const isDriver = ride.driver_id === req.user.id;
    
    if (!isCustomer && !isDriver && req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Não autorizado' });
    }

    // Regras de cancelamento
    const cancellableStatuses = ['requested', 'searching', 'offered', 'accepted', 'arrived'];
    if (!cancellableStatuses.includes(ride.status)) {
      return res.status(400).json({ error: 'Não é possível cancelar esta corrida no momento' });
    }

    const cancelledBy = isCustomer ? 'customer' : isDriver ? 'driver' : 'system';

    await ride.update({
      status: 'cancelled',
      cancelled_at: new Date(),
      cancel_reason: reason,
      cancelled_by: cancelledBy
    });

    // Limpa cache
    await redisClient.del(`ride:${rideId}`);

    // Notifica a outra parte
    const notifyUserId = isCustomer ? ride.driver_id : ride.customer_id;
    if (notifyUserId) {
      notifyUser(notifyUserId, {
        type: 'RIDE_CANCELLED',
        ride_id: rideId,
        cancelled_by: cancelledBy,
        reason,
        message: `Corrida cancelada por ${cancelledBy}`
      });
    }

    logger.info(`Corrida ${rideId} cancelada por ${cancelledBy}`);
    res.json({ success: true, cancellation_fee: calculateCancellationFee(ride) });
  } catch (err) {
    logger.error('Erro ao cancelar corrida:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Buscar corrida por ID
app.get('/:rideId', verifyToken, async (req, res) => {
  try {
    const { rideId } = req.params;
    
    // Tenta cache primeiro
    const cached = await redisClient.get(`ride:${rideId}`);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const ride = await Ride.findByPk(rideId, {
      attributes: { exclude: ['driver_location_history'] }
    });

    if (!ride) {
      return res.status(404).json({ error: 'Corrida não encontrada' });
    }

    // Verifica permissão
    if (ride.customer_id !== req.user.id && 
        ride.driver_id !== req.user.id && 
        req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Não autorizado' });
    }

    res.json(ride);
  } catch (err) {
    logger.error('Erro ao buscar corrida:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Listar histórico de corridas
app.get('/history', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (req.user.type === 'customer') {
      where.customer_id = req.user.id;
    } else if (req.user.type === 'driver') {
      where.driver_id = req.user.id;
    }

    if (status) {
      where.status = status;
    }

    const { count, rows: rides } = await Ride.findAndCountAll({
      where,
      order: [['requested_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      attributes: ['id', 'status', 'pickup_address', 'dropoff_address', 
                   'estimated_price', 'final_price', 'requested_at', 'completed_at',
                   'driver_rating', 'customer_rating']
    });

    res.json({
      rides,
      total: count,
      page: parseInt(page),
      total_pages: Math.ceil(count / limit)
    });
  } catch (err) {
    logger.error('Erro ao buscar histórico:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Funções auxiliares
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function encodeGeohash(latitude, longitude, precision = 5) {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';
  let latRange = [-90.0, 90.0];
  let lonRange = [-180.0, 180.0];

  while (geohash.length < precision) {
    const val = evenBit ? longitude : latitude;
    const range = evenBit ? lonRange : latRange;
    const mid = (range[0] + range[1]) / 2;

    if (val >= mid) {
      idx = (idx << 1) + 1;
      range[0] = mid;
    } else {
      idx = idx << 1;
      range[1] = mid;
    }

    evenBit = !evenBit;
    if (bit < 4) {
      bit++;
    } else {
      geohash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }
  return geohash;
}

function calculateCancellationFee(ride) {
  // Taxa se cancelar após motorista aceitar
  if (['accepted', 'arrived'].includes(ride.status)) {
    return 5.00; // R$ 5,00
  }
  return 0;
}

async function notifyDispatchService(ride) {
  // Em produção: publicar no RabbitMQ
  logger.info(`Notificando dispatch sobre corrida ${ride.id}`);
  // await channel.publish('rides', 'ride.requested', Buffer.from(JSON.stringify(ride)));
}

async function notifyCustomer(customerId, data) {
  // Em produção: enviar via WebSocket/Socket.io
  logger.info(`Notificando cliente ${customerId}:`, data);
}

async function notifyUser(userId, data) {
  logger.info(`Notificando usuário ${userId}:`, data);
}

async function processPayment(ride) {
  // Em produção: chamar Payment Service
  logger.info(`Processando pagamento para corrida ${ride.id}`);
}

// Health check
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'OK', service: 'ride-service', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'ERROR', error: err.message });
  }
});

const PORT = process.env.PORT || 3003;

(async () => {
  try {
    await sequelize.sync({ alter: true });
    app.listen(PORT, () => {
      logger.info(`Ride Service rodando na porta ${PORT}`);
      console.log(`🚗 Ride Service disponível em http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error('Erro ao iniciar:', err);
    process.exit(1);
  }
})();