const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const morgan = require('morgan');

const app = express();
const PORT = 3000;

app.use(morgan('dev'));

// Função mestra de Proxy com Diagnóstico
const proxyFactory = (path, target) => createProxyMiddleware({
    target: target,
    changeOrigin: true,
    pathRewrite: { [`^${path}`]: '' },
    timeout: 5000, // Desiste após 5 segundos se o serviço estiver travado
    onError: (err, req, res) => {
        console.error(`❌ Falha ao conectar em ${target}:`, err.message);
        res.status(502).json({ 
            error: 'Erro 502 - Bad Gateway', 
            service: target,
            message: 'O Gateway não conseguiu alcançar este microserviço. Verifique se o container não está em Restarting no Docker.' 
        });
    }
});

/**
 * CONFIGURAÇÃO DE ROTAS (Nomes fixos do seu Docker)
 */

// 1. AUTH SERVICE
app.use('/api/auth', proxyFactory('/api/auth', 'http://mudex-auth-service:3001'));

// 2. USER SERVICE (O que estava reiniciando na sua foto)
app.use(['/api/user', '/api/users'], proxyFactory('/api/user', 'http://mudex-user-service:3002'));

// 3. RIDE SERVICE
app.use('/api/rides', proxyFactory('/api/rides', 'http://mudex-ride-service:3003'));

// 4. DISPATCH SERVICE
app.use('/api/dispatch', proxyFactory('/api/dispatch', 'http://mudex-dispatch-service:3004'));

// 5. LOCATION SERVICE
app.use('/api/location', proxyFactory('/api/location', 'http://mudex-location-service:3005'));

/**
 * PÁGINA DE VITÓRIA
 */
app.get('/', (req, res) => {
    res.send(`
        <body style="background: #121212; color: white; font-family: sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #4caf50;">🚀 MUDEX GATEWAY ONLINE!</h1>
            <p>Se você vê esta tela, o Gateway na porta 3000 está funcionando.</p>
            <div style="background: #1e1e1e; border: 1px solid #333; padding: 20px; display: inline-block; border-radius: 8px;">
                <p><strong>Teste de Rotas:</strong></p>
                <code style="color: #ff9800;">/api/auth/health</code><br>
                <code style="color: #ff9800;">/api/user/health</code>
            </div>
            <p style="color: #888; margin-top: 20px;">Se der 502 nestas rotas, o erro está no serviço, não no Gateway.</p>
        </body>
    `);
});

app.listen(PORT, () => {
    console.log(`✅ Gateway Mudex pronto na porta ${PORT}`);
});
