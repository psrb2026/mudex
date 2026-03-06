-- =====================================================================
-- init-db.sql - Inicialização do banco de dados Mudex (ou seu projeto)
-- Executado automaticamente pelo Postgres na primeira criação do volume
-- =====================================================================

-- 1. Ativação da extensão PostGIS (se você usa localização/geometria)
-- Remova ou comente se não precisar
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Tabela de usuários (autenticação)
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(50) UNIQUE NOT NULL,
    email           VARCHAR(100) UNIQUE,               -- Adicionado: muito comum em apps modernos
    password_hash   VARCHAR(255) NOT NULL,             -- Deve ser hash (bcrypt, argon2, etc.), NUNCA senha plain
    full_name       VARCHAR(100),
    role            VARCHAR(20) DEFAULT 'user'         -- ex: 'user', 'admin', 'driver'
        CHECK (role IN ('user', 'admin', 'driver', 'support')),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login      TIMESTAMP WITH TIME ZONE
);

-- Índices úteis para performance
CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username    ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role        ON users(role);

-- 3. Tabela de produtos (exemplo para um e-commerce, catálogo, etc.)
CREATE TABLE IF NOT EXISTS products (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(120) UNIQUE,               -- url-friendly: ex: "camiseta-preta-m"
    description     TEXT,
    price           DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    stock_quantity  INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
    category        VARCHAR(50),
    image_url       VARCHAR(255),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_products_slug     ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_price    ON products(price);

-- 4. (Opcional) Tabela de relação: pedidos (exemplo de uso real das duas tabelas)
CREATE TABLE IF NOT EXISTS orders (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    total_amount    DECIMAL(12, 2) NOT NULL CHECK (total_amount >= 0),
    status          VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'canceled')),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id              SERIAL PRIMARY KEY,
    order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    unit_price      DECIMAL(10, 2) NOT NULL,
    subtotal        DECIMAL(12, 2) NOT NULL GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- 5. Inserção de dados de teste / seed (só rodam se as tabelas estiverem vazias)
-- Usuários de teste (senhas devem ser hasheadas no código real!)
INSERT INTO users (username, email, password_hash, full_name, role)
VALUES 
    ('admin',   'admin@exemplo.com',   '$2b$12$exemploHashAqui123456789', 'Administrador', 'admin'),
    ('joao',    'joao@exemplo.com',    '$2b$12$exemploHashAqui987654321', 'João Silva',    'user'),
    ('maria',   'maria@exemplo.com',   '$2b$12$exemploHashAqui456789123', 'Maria Souza',   'user')
ON CONFLICT (username) DO NOTHING;

-- Produtos de teste
INSERT INTO products (name, slug, description, price, stock_quantity, category, image_url)
VALUES 
    ('Camiseta Básica Preta', 'camiseta-basica-preta', 'Algodão 100%, tamanhos P a GG', 49.90, 120, 'Vestuário', 'https://exemplo.com/img/camiseta-preta.jpg'),
    ('Tênis Esportivo',       'tenis-esportivo-run',    ' amortecimento e solado em borracha', 299.00, 45, 'Calçados', 'https://exemplo.com/img/tenis-run.jpg'),
    ('Fone Bluetooth',        'fone-bluetooth-pro',     'Bateria 20h, cancelamento de ruído', 189.90, 80, 'Eletrônicos', NULL)
ON CONFLICT (slug) DO NOTHING;

-- Comentário final
COMMENT ON DATABASE current_database() IS 'Banco de dados inicializado em ' || CURRENT_TIMESTAMP;
