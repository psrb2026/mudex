/**
 * Configurações do algoritmo de dispatch
 * Pesos configuráveis para o score do motorista
 */

module.exports = {
  // Pesos para cálculo de score (devem somar 1.0)
  scoring: {
    weights: {
      distance: 0.35,        // Proximidade com o cliente
      eta: 0.25,             // Tempo estimado de chegada
      rating: 0.15,          // Avaliação do motorista
      cancellationRate: 0.10, // Taxa de cancelamento (inverso)
      acceptanceRate: 0.10,  // Taxa de aceitação
      idleTime: 0.05         // Tempo parado sem corrida
    },
    
    // Fatores de normalização
    maxDistance: 5000,      // Máximo de 5km para considerar
    maxEta: 600,            // Máximo de 10 minutos (600s)
    minRating: 4.0,         // Rating mínimo aceitável
    
    // Penalidades
    penalties: {
      recentRejection: 0.8,  // Penalidade se rejeitou recentemente
      lowAcceptance: 0.7,    // Penalidade se taxa de aceitação < 50%
      highCancellation: 0.6  // Penalidade se taxa de cancelamento > 10%
    }
  },
  
  // Configurações de timeout e retry
  dispatch: {
    initialTimeout: 15000,      // 15 segundos para primeira oferta
    subsequentTimeout: 10000,   // 10 segundos para ofertas seguintes
    maxRetries: 3,              // Máximo de tentativas por corrida
    batchSize: 3,               // Quantos motoristas recebem oferta simultânea
    searchRadius: 5000,         // Raio inicial de busca em metros
    maxRadius: 15000            // Raio máximo de expansão
  },
  
  // Antifraude
  fraud: {
    maxRidesPerHour: 10,        // Limite suspeito de corridas/hora
    maxCancellationsPerDay: 5,  // Limite de cancelamentos/dia
    gpsSpoofingThreshold: 100   // Velocidade máxima realista (km/h)
  }
};