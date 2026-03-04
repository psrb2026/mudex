// services/payment-service/src/index.js

const express = require('express');
const app = express();
const port = process.env.PORT || 3006;

app.use(express.json());

// Rota de saúde (Health Check) simplificada para não travar o Gateway
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'payment-service', 
    message: 'Sistema de pagamentos online (Redis Bypass)',
    timestamp: new Date().toISOString()
  });
});

// Rota raiz para evitar o "Cannot GET /"
app.get('/', (req, res) => {
  res.send('Mudex Payment Service está operante!');
});

// Simulação de processamento de pagamento
app.post('/api/payments/process', (req, res) => {
  const { rideId, amount } = req.body;
  console.log(`💰 Processando pagamento para a corrida ${rideId} no valor de R$ ${amount}`);
  
  // Simula um sucesso de pagamento
  res.json({ 
    success: true, 
    transactionId: `tx_${Math.random().toString(36).substr(2, 9)}`,
    status: 'completed' 
  });
});

app.listen(port, () => {
  console.log(`💰 Payment Service rodando na porta ${port}`);
});