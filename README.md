# grafana-alloy-poc

POC repository to validate observability flow with Grafana Alloy and Grafana Cloud using one Alloy Fly app per environment and a single shared Alloy config.

## Structure

- Shared Alloy files:
  - `observability/alloy/Dockerfile`
  - `observability/alloy/config.alloy`
  - `observability/alloy/fly.alloy.preview.toml`
  - `observability/alloy/fly.alloy.staging.toml`
  - `observability/alloy/fly.alloy.production.toml`
- Metrics emulator Fly app: `fly.metrics-emulator.toml`

## What is configured

- Metrics scrape endpoint on separate port `9464`
- IPv6 listener for Alloy and metrics-emulator
- `discovery.dns` (AAAA) + `prometheus.scrape` per env via env vars
- `prometheus.relabel` for `env`, `app`, `region`
- `prometheus.remote_write` to Grafana Cloud
- Alloy self-monitoring via `/metrics`, `/-/ready`, `/-/healthy`

## Region

All Fly configs are set to `primary_region = "arn"`.

## Deploy order

1. Deploy metrics-emulator (preview example):

```bash
fly deploy -c fly.metrics-emulator.toml
```

2. Deploy Alloy per env:

```bash
fly deploy -c observability/alloy/fly.alloy.preview.toml
fly deploy -c observability/alloy/fly.alloy.staging.toml
fly deploy -c observability/alloy/fly.alloy.production.toml
```

## Required env-specific values

Before deploying staging/production, replace these values:

- `SCRAPE_TARGET_DNS` in `observability/alloy/fly.alloy.staging.toml` and `observability/alloy/fly.alloy.production.toml`
- `SCRAPE_TARGET_APP` in `observability/alloy/fly.alloy.staging.toml` and `observability/alloy/fly.alloy.production.toml`

For each Alloy app, set Fly secrets:

- `PROM_REMOTE_WRITE_URL`
- `PROM_USERNAME`
- `GRAFANA_CLOUD_API_KEY`
