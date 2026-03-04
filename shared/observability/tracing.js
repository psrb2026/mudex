// shared/observability/tracing.js
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { Resource } = require('@opentelemetry/resources');

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.SERVICE_NAME,
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.SERVICE_VERSION,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV,
  }),
  traceExporter: new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT || 'http://jaeger:14268/api/traces',
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
    }),
  ],
});

sdk.start();

module.exports = { sdk };