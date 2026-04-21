const http = require('http');

const METRICS_PORT = Number(process.env.METRICS_PORT || process.env.PORT || 9464);

const RESOURCE_LABELS = {
  service_name: process.env.SERVICE_NAME || 'ecom-fe-sveltekit',
  service_namespace: process.env.SERVICE_NAMESPACE || 'ecomfe',
  service_version: process.env.SERVICE_VERSION || 'mvp',
  deployment_environment: process.env.DEPLOYMENT_ENVIRONMENT || 'preview',
  cloud_provider: process.env.CLOUD_PROVIDER || 'flyio',
  cloud_region: process.env.CLOUD_REGION || 'lhr',
};

function escapeLabelValue(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/"/g, '\\"');
}

function renderLabels(labelNames, labels) {
  if (!labelNames.length) return '';
  const rendered = labelNames
    .map((name) => `${name}="${escapeLabelValue(labels[name] ?? '')}"`)
    .join(',');
  return `{${rendered}}`;
}

function keyFor(labelNames, labels) {
  return labelNames.map((name) => `${name}=${labels[name] ?? ''}`).join('|');
}

class Counter {
  constructor(name, help, labelNames = []) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
    this.type = 'counter';
    this.values = new Map();
  }

  inc(labels = {}, value = 1) {
    const merged = { ...RESOURCE_LABELS, ...labels };
    const key = keyFor(this.labelNames, merged);
    const existing = this.values.get(key);
    if (existing) {
      existing.value += value;
    } else {
      this.values.set(key, { labels: merged, value });
    }
  }

  render() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} ${this.type}`];
    for (const { labels, value } of this.values.values()) {
      lines.push(`${this.name}${renderLabels(this.labelNames, labels)} ${value.toFixed(6)}`);
    }
    return lines.join('\n');
  }
}

class Gauge {
  constructor(name, help, labelNames = []) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
    this.type = 'gauge';
    this.values = new Map();
  }

  set(labels = {}, value = 0) {
    const merged = { ...RESOURCE_LABELS, ...labels };
    const key = keyFor(this.labelNames, merged);
    this.values.set(key, { labels: merged, value });
  }

  render() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} ${this.type}`];
    for (const { labels, value } of this.values.values()) {
      lines.push(`${this.name}${renderLabels(this.labelNames, labels)} ${Number(value).toFixed(6)}`);
    }
    return lines.join('\n');
  }
}

class Histogram {
  constructor(name, help, labelNames = [], buckets = [0.05, 0.1, 0.25, 0.5, 1, 2, 5]) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
    this.type = 'histogram';
    this.buckets = buckets.slice().sort((a, b) => a - b);
    this.series = new Map();
  }

  observe(labels = {}, value = 0) {
    const merged = { ...RESOURCE_LABELS, ...labels };
    const key = keyFor(this.labelNames, merged);
    if (!this.series.has(key)) {
      this.series.set(key, {
        labels: merged,
        bucketCounts: new Array(this.buckets.length).fill(0),
        count: 0,
        sum: 0,
      });
    }
    const item = this.series.get(key);
    item.count += 1;
    item.sum += value;
    for (let i = 0; i < this.buckets.length; i += 1) {
      if (value <= this.buckets[i]) {
        item.bucketCounts[i] += 1;
      }
    }
  }

  render() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} ${this.type}`];
    for (const { labels, bucketCounts, count, sum } of this.series.values()) {
      for (let i = 0; i < this.buckets.length; i += 1) {
        const bucketLabels = { ...labels, le: String(this.buckets[i]) };
        lines.push(
          `${this.name}_bucket${renderLabels([...this.labelNames, 'le'], bucketLabels)} ${bucketCounts[i].toFixed(6)}`
        );
      }
      const infLabels = { ...labels, le: '+Inf' };
      lines.push(`${this.name}_bucket${renderLabels([...this.labelNames, 'le'], infLabels)} ${count.toFixed(6)}`);
      lines.push(`${this.name}_sum${renderLabels(this.labelNames, labels)} ${sum.toFixed(6)}`);
      lines.push(`${this.name}_count${renderLabels(this.labelNames, labels)} ${count.toFixed(6)}`);
    }
    return lines.join('\n');
  }
}

const metrics = [];

function register(metric) {
  metrics.push(metric);
  return metric;
}

// Golden Signals + SSR/Node/BFF
const httpRequestsTotal = register(
  new Counter('ecomfe_http_requests_total', 'Total HTTP requests', [
    ...Object.keys(RESOURCE_LABELS),
    'http_request_method',
    'url_scheme',
    'server_address',
    'route',
    'http_response_status_code',
    'error_type',
    'tenant',
    'channel',
    'site',
    'release',
    'git_sha',
    'feature_flag',
  ])
);
const httpDuration = register(
  new Histogram('ecomfe_http_request_duration_seconds', 'HTTP request latency by route', [
    ...Object.keys(RESOURCE_LABELS),
    'http_request_method',
    'route',
    'http_response_status_code',
  ])
);
const httpActiveRequests = register(
  new Gauge('ecomfe_http_active_requests', 'Number of active HTTP requests', [...Object.keys(RESOURCE_LABELS), 'route'])
);
const nodeEventLoopLag = register(new Gauge('ecomfe_node_event_loop_lag_seconds', 'Node.js event loop lag', Object.keys(RESOURCE_LABELS)));
const nodeHeapUsed = register(new Gauge('ecomfe_nodejs_heap_used_bytes', 'Node.js heap used bytes', Object.keys(RESOURCE_LABELS)));
const nodeGcDuration = register(
  new Histogram('ecomfe_nodejs_gc_duration_seconds', 'Node.js GC duration', [...Object.keys(RESOURCE_LABELS), 'gc_type'])
);

// Dependency observability
const dependencyRequests = register(
  new Counter('ecomfe_dependency_requests_total', 'Dependency request total', [...Object.keys(RESOURCE_LABELS), 'dependency', 'result'])
);
const dependencyDuration = register(
  new Histogram('ecomfe_dependency_request_duration_seconds', 'Dependency request latency', [...Object.keys(RESOURCE_LABELS), 'dependency'])
);
const dependencyTimeouts = register(
  new Counter('ecomfe_dependency_timeouts_total', 'Dependency timeout total', [...Object.keys(RESOURCE_LABELS), 'dependency'])
);
const dependencyRetries = register(
  new Counter('ecomfe_dependency_retries_total', 'Dependency retries total', [...Object.keys(RESOURCE_LABELS), 'dependency'])
);
const circuitBreakerOpens = register(
  new Counter('ecomfe_dependency_circuit_breaker_open_total', 'Dependency circuit breaker opens', [
    ...Object.keys(RESOURCE_LABELS),
    'dependency',
  ])
);
const cacheHitRatio = register(new Gauge('ecomfe_cache_hit_ratio', 'Cache hit ratio', [...Object.keys(RESOURCE_LABELS), 'cache_name']));
const externalApiFailureRate = register(
  new Gauge('ecomfe_external_api_failure_rate', 'External API failure rate', [...Object.keys(RESOURCE_LABELS), 'dependency'])
);

// Business and user journey
const homepageRender = register(
  new Counter('ecomfe_journey_homepage_render_total', 'Homepage render outcomes', [...Object.keys(RESOURCE_LABELS), 'outcome'])
);
const plp = register(
  new Counter('ecomfe_journey_product_listing_total', 'Product listing outcomes', [...Object.keys(RESOURCE_LABELS), 'outcome'])
);
const plpLatency = register(
  new Histogram('ecomfe_journey_product_listing_latency_seconds', 'Product listing latency', Object.keys(RESOURCE_LABELS))
);
const pdp = register(
  new Counter('ecomfe_journey_product_detail_total', 'Product detail outcomes', [...Object.keys(RESOURCE_LABELS), 'outcome'])
);
const pdpLatency = register(
  new Histogram('ecomfe_journey_product_detail_latency_seconds', 'Product detail latency', Object.keys(RESOURCE_LABELS))
);
const addToCart = register(
  new Counter('ecomfe_journey_add_to_cart_total', 'Add-to-cart outcomes', [...Object.keys(RESOURCE_LABELS), 'outcome'])
);
const cartLoad = register(
  new Counter('ecomfe_journey_cart_page_load_total', 'Cart page load outcomes', [...Object.keys(RESOURCE_LABELS), 'outcome'])
);
const checkoutStart = register(new Counter('ecomfe_journey_checkout_start_total', 'Checkout starts', Object.keys(RESOURCE_LABELS)));
const checkoutSubmit = register(
  new Counter('ecomfe_journey_checkout_submit_total', 'Checkout submit outcomes', [...Object.keys(RESOURCE_LABELS), 'outcome'])
);
const paymentRedirect = register(
  new Counter('ecomfe_journey_payment_redirect_total', 'Payment redirect outcomes', [...Object.keys(RESOURCE_LABELS), 'outcome'])
);
const paymentCallback = register(
  new Counter('ecomfe_journey_payment_callback_total', 'Payment callback outcomes', [...Object.keys(RESOURCE_LABELS), 'outcome'])
);
const searchOutcomes = register(
  new Counter('ecomfe_journey_search_total', 'Search outcomes', [...Object.keys(RESOURCE_LABELS), 'outcome'])
);
const searchZeroResultRatio = register(
  new Gauge('ecomfe_journey_search_zero_result_ratio', 'Search zero-result ratio', Object.keys(RESOURCE_LABELS))
);
const authRestore = register(
  new Counter('ecomfe_journey_auth_session_restore_total', 'Auth/session restore outcomes', [...Object.keys(RESOURCE_LABELS), 'outcome'])
);

// Frontend/browser
const pageLoad = register(
  new Histogram('ecomfe_frontend_page_load_duration_seconds', 'Page load timings', [
    ...Object.keys(RESOURCE_LABELS),
    'route',
    'device',
    'browser',
    'geo',
  ])
);
const routeTransition = register(
  new Histogram('ecomfe_frontend_route_transition_duration_seconds', 'Route transition duration', [
    ...Object.keys(RESOURCE_LABELS),
    'route',
  ])
);
const jsErrors = register(
  new Counter('ecomfe_frontend_javascript_errors_total', 'JavaScript errors', [...Object.keys(RESOURCE_LABELS), 'error_type'])
);
const browserApiLatency = register(
  new Histogram('ecomfe_frontend_api_latency_seconds', 'Browser-side API latency', [...Object.keys(RESOURCE_LABELS), 'api'])
);
const webVitalLcp = register(new Gauge('ecomfe_frontend_web_vitals_lcp_seconds', 'LCP web vital', Object.keys(RESOURCE_LABELS)));
const webVitalInp = register(new Gauge('ecomfe_frontend_web_vitals_inp_seconds', 'INP web vital', Object.keys(RESOURCE_LABELS)));
const webVitalCls = register(new Gauge('ecomfe_frontend_web_vitals_cls_ratio', 'CLS web vital', Object.keys(RESOURCE_LABELS)));
const assetLoadFailures = register(
  new Counter('ecomfe_frontend_asset_load_failures_total', 'Asset load failures', [...Object.keys(RESOURCE_LABELS), 'asset_type'])
);
const thirdPartyImpact = register(
  new Gauge('ecomfe_frontend_third_party_script_impact_seconds', 'Third-party script impact', [
    ...Object.keys(RESOURCE_LABELS),
    'script_name',
  ])
);
const trafficBreakdown = register(
  new Counter('ecomfe_frontend_traffic_breakdown_total', 'Traffic by geo/device/browser', [
    ...Object.keys(RESOURCE_LABELS),
    'geo',
    'device',
    'browser',
  ])
);

// Platform and infra (emulated)
const ingressRequests = register(
  new Counter('ecomfe_platform_ingress_requests_total', 'Ingress/load-balancer requests', [...Object.keys(RESOURCE_LABELS), 'status_class'])
);
const vmRestarts = register(new Counter('ecomfe_platform_vm_restarts_total', 'VM restarts', Object.keys(RESOURCE_LABELS)));
const cpuSaturation = register(new Gauge('ecomfe_platform_cpu_saturation_ratio', 'CPU saturation ratio', Object.keys(RESOURCE_LABELS)));
const memorySaturation = register(
  new Gauge('ecomfe_platform_memory_saturation_ratio', 'Memory saturation ratio', Object.keys(RESOURCE_LABELS))
);
const dnsErrors = register(new Counter('ecomfe_platform_dns_errors_total', 'DNS errors', Object.keys(RESOURCE_LABELS)));
const tlsErrors = register(new Counter('ecomfe_platform_tls_errors_total', 'TLS errors', Object.keys(RESOURCE_LABELS)));
const dependencyHealth = register(
  new Gauge('ecomfe_platform_dependency_health', 'Dependency health (1 healthy, 0 unhealthy)', [
    ...Object.keys(RESOURCE_LABELS),
    'dependency',
  ])
);

let tick = 0;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function choose(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function simulate() {
  tick += 1;

  const route = choose(['/','/search','/product/[id]','/cart','/checkout']);
  const method = choose(['GET', 'POST']);
  const statusCode = choose(['200', '200', '200', '302', '404', '500']);
  const errorType = statusCode.startsWith('5') ? 'server_error' : 'none';

  const httpLabels = {
    http_request_method: method,
    url_scheme: 'https',
    server_address: 'mvp-metrics-emulator.internal',
    route,
    http_response_status_code: statusCode,
    error_type: errorType,
    tenant: 'default',
    channel: choose(['web', 'mobile_web']),
    site: choose(['ua', 'eu']),
    release: `2026.04.${String((tick % 30) + 1).padStart(2, '0')}`,
    git_sha: `sha${(tick % 9) + 1}`,
    feature_flag: choose(['checkout_v2_on', 'none']),
  };

  httpRequestsTotal.inc(httpLabels, 1);
  httpDuration.observe(
    {
      http_request_method: method,
      route,
      http_response_status_code: statusCode,
    },
    rand(0.02, statusCode.startsWith('5') ? 2.4 : 0.7)
  );
  httpActiveRequests.set({ route }, Math.floor(rand(1, 20)));

  nodeEventLoopLag.set({}, rand(0.002, 0.09));
  nodeHeapUsed.set({}, rand(90e6, 420e6));
  nodeGcDuration.observe({ gc_type: choose(['minor', 'major']) }, rand(0.001, 0.04));

  const dep = choose(['redis', 'payments_api', 'catalog_api', 'search_api', 'kafka']);
  const depResult = choose(['success', 'success', 'success', 'timeout', 'error']);
  dependencyRequests.inc({ dependency: dep, result: depResult }, 1);
  dependencyDuration.observe({ dependency: dep }, rand(0.01, depResult === 'success' ? 0.4 : 1.8));
  if (depResult === 'timeout') dependencyTimeouts.inc({ dependency: dep }, 1);
  if (Math.random() < 0.25) dependencyRetries.inc({ dependency: dep }, 1);
  if (Math.random() < 0.08) circuitBreakerOpens.inc({ dependency: dep }, 1);
  cacheHitRatio.set({ cache_name: 'redis' }, rand(0.72, 0.99));
  externalApiFailureRate.set({ dependency: 'payments_api' }, rand(0.001, 0.05));

  homepageRender.inc({ outcome: choose(['success', 'success', 'failure']) }, 1);
  plp.inc({ outcome: choose(['success', 'success', 'failure']) }, 1);
  plpLatency.observe({}, rand(0.08, 1.6));
  pdp.inc({ outcome: choose(['success', 'success', 'failure']) }, 1);
  pdpLatency.observe({}, rand(0.06, 1.8));
  addToCart.inc({ outcome: choose(['success', 'success', 'success', 'failure']) }, 1);
  cartLoad.inc({ outcome: choose(['success', 'success', 'failure']) }, 1);
  checkoutStart.inc({}, Math.random() < 0.5 ? 1 : 0);
  checkoutSubmit.inc({ outcome: choose(['success', 'success', 'failure']) }, 1);
  paymentRedirect.inc({ outcome: choose(['success', 'failure']) }, 1);
  paymentCallback.inc({ outcome: choose(['success', 'success', 'failure']) }, 1);
  searchOutcomes.inc({ outcome: choose(['success', 'success', 'failure']) }, 1);
  searchZeroResultRatio.set({}, rand(0.02, 0.32));
  authRestore.inc({ outcome: choose(['success', 'success', 'failure']) }, 1);

  const device = choose(['desktop', 'mobile']);
  const browser = choose(['chrome', 'safari', 'firefox']);
  const geo = choose(['ua', 'de', 'uk']);
  pageLoad.observe({ route, device, browser, geo }, rand(0.15, 3.4));
  routeTransition.observe({ route }, rand(0.02, 0.7));
  jsErrors.inc({ error_type: choose(['runtime', 'network', 'hydrate']) }, Math.random() < 0.4 ? 1 : 0);
  browserApiLatency.observe({ api: choose(['/api/cart', '/api/search', '/api/checkout']) }, rand(0.03, 1.2));
  webVitalLcp.set({}, rand(1.2, 4.4));
  webVitalInp.set({}, rand(0.08, 0.65));
  webVitalCls.set({}, rand(0.01, 0.24));
  assetLoadFailures.inc({ asset_type: choose(['js', 'css', 'image', 'font']) }, Math.random() < 0.2 ? 1 : 0);
  thirdPartyImpact.set({ script_name: choose(['analytics', 'chat_widget', 'ads']) }, rand(0.01, 0.3));
  trafficBreakdown.inc({ geo, device, browser }, 1);

  ingressRequests.inc({ status_class: choose(['2xx', '2xx', '3xx', '4xx', '5xx']) }, 1);
  if (Math.random() < 0.05) vmRestarts.inc({}, 1);
  cpuSaturation.set({}, rand(0.15, 0.93));
  memorySaturation.set({}, rand(0.2, 0.89));
  if (Math.random() < 0.04) dnsErrors.inc({}, 1);
  if (Math.random() < 0.03) tlsErrors.inc({}, 1);
  dependencyHealth.set({ dependency: 'redis' }, Math.random() < 0.96 ? 1 : 0);
  dependencyHealth.set({ dependency: 'search_api' }, Math.random() < 0.91 ? 1 : 0);
  dependencyHealth.set({ dependency: 'kafka' }, Math.random() < 0.9 ? 1 : 0);
}

for (let i = 0; i < 50; i += 1) simulate();
setInterval(simulate, 2000);

function renderAllMetrics() {
  return `${metrics.map((metric) => metric.render()).join('\n\n')}\n`;
}

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('ok\n');
    return;
  }

  if (req.url === '/metrics') {
    res.writeHead(200, {
      'content-type': 'text/plain; version=0.0.4; charset=utf-8',
      'cache-control': 'no-store',
    });
    res.end(renderAllMetrics());
    return;
  }

  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('not found\n');
});

server.listen(METRICS_PORT, '::', () => {
  console.log(`metrics-emulator listening on :${METRICS_PORT}`);
});
