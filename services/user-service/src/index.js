/**
 * User Service - Mudex
 * Gerencia perfis de clientes e motoristas, documentos, avaliações
 */

const express = require('express');
const { Sequelize, DataTypes, Op } = require('sequelize');
const Joi = require('joi');
const winston = require('winston');
const axios = require('axios');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/user-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/user-combined.log' })
  ]
});

const app = express();
app.use(express.json());

// Conexão com PostgreSQL
const sequelize = new Sequelize(
  process.env.DB_NAME || 'mudex_users',
  process.env.DB_USER || 'mudex',
  process.env.DB_PASSWORD || 'mudex123',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: msg => logger.debug(msg)
  }
);

// Modelo de Perfil do Cliente
const CustomerProfile = sequelize.define('CustomerProfile', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true
  },
  first_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  last_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  avatar_url: {
    type: DataTypes.TEXT
  },
  default_payment_method: {
    type: DataTypes.ENUM('credit_card', 'debit_card', 'pix', 'cash')
  },
  rating: {
    type: DataTypes.DECIMAL(2, 1),
    defaultValue: 5.0,
    validate: { min: 1, max: 5 }
  },
  total_rides: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  cancelled_rides: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  preferred_language: {
    type: DataTypes.STRING(10),
    defaultValue: 'pt-BR'
  }
}, {
  tableName: 'customer_profiles',
  timestamps: true,
  underscored: true
});

// Modelo de Perfil do Motorista
const DriverProfile = sequelize.define('DriverProfile', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true
  },
  first_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  last_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  avatar_url: {
    type: DataTypes.TEXT
  },
  license_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  license_category: {
    type: DataTypes.STRING(10)
  },
  license_expiry: {
    type: DataTypes.DATE,
    allowNull: false
  },
  vehicle_model: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  vehicle_year: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  vehicle_color: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  license_plate: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true
  },
  vehicle_type: {
    type: DataTypes.ENUM('economy', 'comfort', 'premium', 'suv', 'taxi'),
    defaultValue: 'economy'
  },
  rating: {
    type: DataTypes.DECIMAL(2, 1),
    defaultValue: 5.0,
    validate: { min: 1, max: 5 }
  },
  total_rides: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  accepted_rides: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  cancelled_rides: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  rejection_rate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0.00
  },
  response_time_avg: {
    type: DataTypes.INTEGER, // em segundos
    defaultValue: 0
  },
  is_online: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  current_location: {
    type: DataTypes.GEOMETRY('POINT')
  },
  documents_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  background_check_status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending'
  },
  earnings_balance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  }
}, {
  tableName: 'driver_profiles',
  timestamps: true,
  underscored: true
});

// Modelo de Documentos
const Document = sequelize.define('Document', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  user_type: {
    type: DataTypes.ENUM('customer', 'driver'),
    allowNull: false
  },
  document_type: {
    type: DataTypes.ENUM('id_front', 'id_back', 'driver_license', 'vehicle_registration', 
                         'insurance', 'criminal_record', 'profile_photo'),
    allowNull: false
  },
  file_url: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending'
  },
  rejection_reason: {
    type: DataTypes.TEXT
  },
  reviewed_by: {
    type: DataTypes.UUID
  },
  reviewed_at: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'documents',
  timestamps: true,
  underscored: true
});

// Modelo de Avaliações
const Rating = sequelize.define('Rating', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  ride_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  from_user_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  from_user_type: {
    type: DataTypes.ENUM('customer', 'driver'),
    allowNull: false
  },
  to_user_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  to_user_type: {
    type: DataTypes.ENUM('customer', 'driver'),
    allowNull: false
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 5 }
  },
  comment: {
    type: DataTypes.TEXT
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING)
  }
}, {
  tableName: 'ratings',
  timestamps: true,
  underscored: true
});

// Schemas de validação
const customerProfileSchema = Joi.object({
  user_id: Joi.string().uuid().required(),
  first_name: Joi.string().min(2).max(100).required(),
  last_name: Joi.string().min(2).max(100).required(),
  preferred_language: Joi.string().optional()
});

const driverProfileSchema = Joi.object({
  user_id: Joi.string().uuid().required(),
  first_name: Joi.string().min(2).max(100).required(),
  last_name: Joi.string().min(2).max(100).required(),
  license_number: Joi.string().required(),
  license_category: Joi.string().required(),
  license_expiry: Joi.date().greater('now').required(),
  vehicle_model: Joi.string().required(),
  vehicle_year: Joi.number().integer().min(2000).max(new Date().getFullYear()).required(),
  vehicle_color: Joi.string().required(),
  license_plate: Joi.string().required(),
  vehicle_type: Joi.string().valid('economy', 'comfort', 'premium', 'suv', 'taxi').optional()
});

// Middleware de verificação de token (simplificado)
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Token necessário' });
    }

    // Em produção, validaria com Auth Service
    // Aqui simulamos que o API Gateway já validou
    req.user = {
      id: req.headers['x-user-id'],
      type: req.headers['x-user-type']
    };
    next();
  } catch (err) {
    res.status(403).json({ error: 'Token inválido' });
  }
};

// Criar perfil de cliente
app.post('/customers', verifyToken, async (req, res) => {
  try {
    const { error, value } = customerProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const profile = await CustomerProfile.create(value);
    logger.info(`Perfil de cliente criado: ${profile.id}`);
    
    res.status(201).json(profile);
  } catch (err) {
    logger.error('Erro ao criar perfil de cliente:', err);
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Perfil já existe para este usuário' });
    }
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Criar perfil de motorista
app.post('/drivers', verifyToken, async (req, res) => {
  try {
    const { error, value } = driverProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const profile = await DriverProfile.create({
      ...value,
      documents_verified: false,
      background_check_status: 'pending'
    });
    
    logger.info(`Perfil de motorista criado: ${profile.id}`);
    res.status(201).json(profile);
  } catch (err) {
    logger.error('Erro ao criar perfil de motorista:', err);
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Perfil já existe para este usuário' });
    }
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Buscar perfil de cliente
app.get('/customers/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const profile = await CustomerProfile.findOne({
      where: { user_id: userId },
      attributes: { exclude: [] }
    });

    if (!profile) {
      return res.status(404).json({ error: 'Perfil não encontrado' });
    }

    res.json(profile);
  } catch (err) {
    logger.error('Erro ao buscar perfil:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Buscar perfil de motorista
app.get('/drivers/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const profile = await DriverProfile.findOne({
      where: { user_id: userId }
    });

    if (!profile) {
      return res.status(404).json({ error: 'Perfil não encontrado' });
    }

    res.json(profile);
  } catch (err) {
    logger.error('Erro ao buscar perfil:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Atualizar localização do motorista (chamado pelo Location Service)
app.patch('/drivers/:userId/location', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { latitude, longitude, is_online } = req.body;

    const profile = await DriverProfile.findOne({ where: { user_id: userId } });
    if (!profile) {
      return res.status(404).json({ error: 'Motorista não encontrado' });
    }

    await profile.update({
      current_location: { type: 'Point', coordinates: [longitude, latitude] },
      is_online: is_online !== undefined ? is_online : profile.is_online
    });

    res.json({ success: true });
  } catch (err) {
    logger.error('Erro ao atualizar localização:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Listar motoristas online próximos (para Dispatch Service)
app.get('/drivers/nearby', verifyToken, async (req, res) => {
  try {
    const { lat, lng, radius = 5000, limit = 10 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude e longitude necessárias' });
    }

    const drivers = await DriverProfile.findAll({
      where: {
        is_online: true,
        documents_verified: true,
        background_check_status: 'approved',
        current_location: {
          [Op.ne]: null
        }
      },
      attributes: ['user_id', 'first_name', 'last_name', 'rating', 'vehicle_type', 
                   'vehicle_model', 'vehicle_color', 'license_plate', 'current_location',
                   'total_rides', 'response_time_avg', 'rejection_rate']
    });

    // Calcula distância e filtra por raio (simplificado, ideal usar PostGIS)
    const nearbyDrivers = drivers
      .map(driver => {
        const [driverLng, driverLat] = driver.current_location.coordinates;
        const distance = calculateDistance(lat, lng, driverLat, driverLng);
        return { ...driver.toJSON(), distance };
      })
      .filter(d => d.distance <= radius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    res.json(nearbyDrivers);
  } catch (err) {
    logger.error('Erro ao buscar motoristas próximos:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Função auxiliar para calcular distância (Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Raio da Terra em metros
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

// Submeter avaliação
app.post('/ratings', verifyToken, async (req, res) => {
  try {
    const { ride_id, to_user_id, to_user_type, rating, comment, tags } = req.body;
    const from_user_id = req.user.id;
    const from_user_type = req.user.type;

    // Validações básicas
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Avaliação deve ser entre 1 e 5' });
    }

    const newRating = await Rating.create({
      ride_id,
      from_user_id,
      from_user_type,
      to_user_id,
      to_user_type,
      rating,
      comment,
      tags: tags || []
    });

    // Atualiza média do usuário avaliado
    await updateUserRating(to_user_id, to_user_type);

    res.status(201).json(newRating);
  } catch (err) {
    logger.error('Erro ao criar avaliação:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Atualizar média de avaliações
async function updateUserRating(userId, userType) {
  const ratings = await Rating.findAll({
    where: { to_user_id: userId, to_user_type: userType }
  });

  const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

  if (userType === 'driver') {
    await DriverProfile.update(
      { rating: avgRating.toFixed(1) },
      { where: { user_id: userId } }
    );
  } else {
    await CustomerProfile.update(
      { rating: avgRating.toFixed(1) },
      { where: { user_id: userId } }
    );
  }
}

// Health check
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'OK', service: 'user-service', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'ERROR', error: err.message });
  }
});

const PORT = process.env.PORT || 3002;

(async () => {
  try {
    await sequelize.sync({ alter: true });
    app.listen(PORT, () => {
      logger.info(`User Service rodando na porta ${PORT}`);
      console.log(`👤 User Service disponível em http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error('Erro ao iniciar:', err);
    process.exit(1);
  }
})();