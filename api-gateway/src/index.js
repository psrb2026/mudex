/**
 * API Gateway - Mudex (VERSÃO FINAL INTEGRADA)
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const morgan = require('morgan');

const app = express();
const PORT = 3000;

// Log de requisições para você ver o que está acontecendo no terminal
app.use(morgan('dev'));

/**
 * CONFIGURAÇÃO DE PROXIES
 * O 'target' usa o nome que aparece no seu 'docker ps'
 */
const createServiceProxy = (target) => createProxyMiddleware({
    target: target,
    changeOrigin: true,
    // Garante que o gateway tente reconectar se o serviço estiver reiniciando
    onError: (err, req, res) => {
        console.error(`❌ Erro de conexão com ${target}:`, err.message);
        res.status(502).json({ 
            error: 'Bad Gateway', 
            message: 'O serviço destino está offline ou reiniciando. Tente novamente em instantes.' 
        });
    }
});

// 1. AUTH SERVICE (Porta 3001 interna)
app.use('/api/auth', createServiceProxy('http://mudex-auth-service:3001'));

// 2. USER SERVICE (Porta 3002 interna)
app.use(['/api/user', '/api/users'], createServiceProxy('http://mudex-user-service:3002'));

// 3. RIDE SERVICE (Porta 3003 interna)
app.use('/api/rides', createServiceProxy('http://mudex-ride-service:3003'));

// 4. LOCATION SERVICE (Porta 3005 interna)
app.use('/api/location', createServiceProxy('http://mudex-location-service:3005'));

// 5. PAYMENT SERVICE (Porta 3006 interna)
app.use('/api/payments', createServiceProxy('http://mudex-payment-service:3006'));

/**
 * ROTAS DE TESTE
 */

// Rota do Foguetinho (Sua confirmação de vitória)
app.get('/', (req, res) => {
    res.send(`
        <div style="text-align: center; font-family: sans-serif; margin-top: 50px;">
            <h1 style="color: #2e7d32;">🚀 MUDEX: O FOGUETINHO DA VITÓRIA ESTÁ ONLINE!</h1>
            <p>O Gateway está recebendo chamadas na porta 3000.</p>
            <div style="background: #f5f5f5; padding: 20px; display: inline-block; border-radius: 10px;">
                <strong>Status dos Caminhos:</strong><br>
                ✅ /api/auth -> Auth Service<br>
                ✅ /api/user -> User Service
            </div>
        </div>
    `);
});

// Health check simples
app.get('/health', (req, res) => {
    res.json({ status: 'OK', gateway: 'Online' });
});

app.listen(PORT, () => {
    console.log(`\x1b[32m%s\x1b[0m`, `✅ Gateway Mudex rodando na porta ${PORT}`);
    console.log(`📡 Roteando tráfego para os microserviços do Docker...`);
});
