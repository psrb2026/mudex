// services/ride-service/src/events/kafka-producer.js
const { Kafka } = require('kafkajs');
const { Partitioners } = require('kafkajs');

class ExactlyOnceProducer {
  constructor() {
    this.kafka = new Kafka({
      clientId: 'ride-service',
      brokers: process.env.KAFKA_BROKERS.split(','),
      ssl: true,
      sasl: {
        mechanism: 'scram-sha-256',
        username: process.env.KAFKA_USERNAME,
        password: process.env.KAFKA_PASSWORD
      }
    });
    
    this.producer = this.kafka.producer({
      idempotent: true,           // Exactly-once semantics
      transactionalId: `ride-service-${process.env.HOSTNAME}`,
      maxInFlightRequests: 1,     // Necessário para idempotência
      retry: {
        maxRetryTime: 30000,
        retries: 5
      }
    });
  }

  /**
   * Publica evento com garantia exactly-once
   */
  async publishEvent(topic, event, metadata = {}) {
    const transaction = await this.producer.transaction();
    
    try {
      // 1. Salva offset no banco (outbox pattern)
      await this.saveOutbox(event);
      
      // 2. Publica no Kafka
      await transaction.send({
        topic,
        messages: [{
          key: event.aggregateId,  // Ordering por corrida
          value: JSON.stringify(event),
          headers: {
            'correlation-id': metadata.correlationId || uuid(),
            'event-type': event.type,
            'timestamp': Date.now().toString(),
            'service': 'ride-service',
            'version': '1.0'
          }
        }]
      });
      
      // 3. Commit atômico (banco + Kafka)
      await transaction.commit();
      
      // 4. Marca outbox como processado
      await this.markOutboxProcessed(event.id);
      
    } catch (error) {
      await transaction.abort();
      throw error;
    }
  }
}

// Consumer com exactly-once
class ExactlyOnceConsumer {
  async processMessage(message) {
    const { key, value, headers } = message;
    const event = JSON.parse(value);
    
    // Idempotência: verifica se já processou
    const processed = await this.redis.get(`processed:${event.id}`);
    if (processed) {
      console.log(`Evento ${event.id} já processado, ignorando`);
      return;
    }
    
    // Processa em transação
    await this.sequelize.transaction(async (t) => {
      // 1. Processa evento
      await this.handleEvent(event, t);
      
      // 2. Salva offset na mesma transação
      await this.saveOffset(message.topic, message.partition, message.offset, t);
      
      // 3. Marca como processado
      await this.redis.setEx(`processed:${event.id}`, 86400, '1');
    });
  }
}