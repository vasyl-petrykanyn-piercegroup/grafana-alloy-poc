# Metrics Emulator (MVP)

Node.js MVP app that exposes Prometheus metrics on `/metrics` for testing the chain:

`metrics-emulator -> Grafana Alloy -> Grafana Cloud`

## Run locally

```bash
cd metrics-emulator
npm start
```

- health: `http://localhost:8080/healthz`
- metrics: `http://localhost:8080/metrics`

## Deploy on Fly.io

From repository root:

```bash
fly deploy -c fly.metrics-emulator.toml
```

This deploy uses internal hostname:

`mvp-metrics-emulator.internal:8080`

## Included metric domains

- Golden Signals (`http` traffic, latency, errors, saturation-like gauges)
- SSR/Node.js/BFF runtime metrics
- Dependency metrics (latency, retries, timeouts, circuit-breaker)
- User journey metrics (homepage, listing, PDP, cart, checkout, payment, search, auth restore)
- Frontend/browser metrics (page load, route transitions, JS errors, web vitals, API latency)
- Platform/Fly-like metrics (ingress, VM restarts, CPU/memory saturation, DNS/TLS errors)
