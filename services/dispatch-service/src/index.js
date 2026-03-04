// services/dispatch-service/src/index.js

const express = require('express');
const app = express();
const port = process.env.PORT || 3004; // Porta padrão do Dispatch

app.use(express.json());

// Rota de saúde (Health Check)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'dispatch-service',
    timestamp: new Date().toISOString()
  });
});

// Rota principal para evitar o "Cannot GET /"
app.get('/', (req, res) => {
  res.send('Mudex Dispatch Service está online!');
});

// Simulação de rota de despacho (ajuste conforme sua lógica real)
app.post('/api/dispatch', (req, res) => {
  console.log('Recebendo solicitação de despacho:', req.body);
  res.json({ success: true, message: 'Procurando motoristas próximos...' });
});

app.listen(port, () => {
  console.log(`🚀 Dispatch Service rodando na porta ${port}`);
});