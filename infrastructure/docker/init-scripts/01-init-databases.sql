-- Cria bancos de dados para cada serviço
CREATE DATABASE mudex_auth;
CREATE DATABASE mudex_users;
CREATE DATABASE mudex_rides;
CREATE DATABASE mudex_payments;
CREATE DATABASE mudex_analytics;

-- Habilita extensão PostGIS para geolocalização (se disponível)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- Cria usuário de aplicação (opcional, mais seguro)
-- CREATE USER mudex_app WITH PASSWORD 'mudex_secure_password';
-- GRANT ALL PRIVILEGES ON DATABASE mudex_auth TO mudex_app;
-- GRANT ALL PRIVILEGES ON DATABASE mudex_users TO mudex_app;
-- GRANT ALL PRIVILEGES ON DATABASE mudex_rides TO mudex_app;
-- GRANT ALL PRIVILEGES ON DATABASE mudex_payments TO mudex_app;
-- GRANT ALL PRIVILEGES ON DATABASE mudex_analytics TO mudex_app;