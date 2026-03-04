/**
 * User Service - Mudex
 * Gerencia perfis de clientes e motoristas, documentos, avaliações
 */

require('dotenv').config(); // ✅ ESSENCIAL

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

/**
 * 🔥 VALIDAÇÃO OBRIGATÓRIA DAS VARIÁVEIS
 */
const requiredEnvVars = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'DB_DIALECT'
];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.error(`❌ Variável obrigatória ausente: ${envVar}`);
    process.exit(1);
  }
});

/**
 * ✅ Conexão com PostgreSQL (SEM localhost fallback)
 */
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    dialect: process.env.DB_DIALECT,
    logging: msg => logger.debug(msg)
  }
);
