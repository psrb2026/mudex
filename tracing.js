// shared/observability/tracing.js
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { Resource } = require('@opentelemetry/resources');

// SDK Global
const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.SERVICE_NAME,
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.SERVICE_VERSION,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV,
  }),
  traceExporter: new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT,
  }),
  metricReader: new PrometheusExporter({
    port: 9090,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        applyCustomAttributesOnSpan: (span, request) => {
          span.setAttribute('http.request_id', request.headers['x-request-id']);
          span.setAttribute('http.user_id', request.headers['x-user-id']);
        },
      },
      '@opentelemetry/instrumentation-pg': { enabled: true },
      '@opentelemetry/instrumentation-redis': { enabled: true },
      '@opentelemetry/instrumentation-amqplib': { enabled: true },
    }),
  ],
});

sdk.start();

// Middleware customizado para tracking de negócio
const businessMetrics = require('./business-metrics');

function createTracingMiddleware(serviceName) {
  return async (req, res, next) => {
    const span = trace.getActiveSpan();
    const startTime = Date.now();
    
    // Adiciona contexto de negócio
    span.setAttributes({
      'business.ride_id': req.body.ride_id,
      'business.user_type': req.user?.type,
      'business.region': req.headers['x-region'],
    });
    
    // Hook para métricas de negócio
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      // Métrica técnica
      businessMetrics.httpRequestDuration.record(duration, {
        service: serviceName,
        route: req.route?.path || 'unknown',
        status_code: res.statusCode,
      });
      
      // Métrica de negócio
      if (req.route?.path === '/rides/request' && res.statusCode === 201) {
        businessMetrics.rideRequested.add(1, {
          region: req.headers['x-region'],
          vehicle_type: req.body.vehicle_type,
        });
      }
    });
    
    next();
  };
}

// SLOs definidos
const SLOs = {
  // Availability
  availability: {
    target: 0.999,  // 99.9% uptime
    window: '30d',
    alert: 0.995,   // Alerta se cair abaixo
  },
  
  // Latência
  latency: {
    p50: { target: 50, alert: 100 },    // ms
    p95: { target: 200, alert: 500 },    // ms
    p99: { target: 500, alert: 1000 },  // ms
  },
  
  // Dispatch específico
  dispatch: {
    match_rate: { target: 0.95, alert: 0.90 },  // 95% de match
    match_time: { target: 30000, alert: 60000 }, // 30s para match
  },
  
  // Qualidade
  error_rate: {
    target: 0.001,  // 0.1% de erros 5xx
    alert: 0.01,    // Alerta em 1%
  },
};