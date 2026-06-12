# grafana-alloy-poc

POC repository to validate observability flow with Grafana Alloy and Grafana Cloud using one Alloy Fly app per environment and a single shared Alloy config.

## Scope

This repository contains implementation experiments only. The canonical
observability framework and supporting documentation live in
[`ecom-fe-sveltekit`](https://github.com/24mx/ecom-fe-sveltekit/tree/main/docs/observability),
including the
[`Observability Framework`](https://github.com/24mx/ecom-fe-sveltekit/blob/main/docs/specs/observability-framework.md).

Validated configuration from this POC should be migrated to
`ecom-fe-sveltekit`. Do not add or maintain framework documentation here.

## Structure

- Shared Alloy files:
  - `observability/alloy/Dockerfile`
  - `observability/alloy/config.alloy`
  - `observability/alloy/fly.alloy.preproduction.toml`
  - `observability/alloy/fly.alloy.staging.toml`
  - `observability/alloy/fly.alloy.production.toml`
- Metrics emulator Fly app: `fly.metrics-emulator.toml`

## What is configured

- Metrics scrape endpoint on separate port `9091`
- IPv6 listener for Alloy and metrics-emulator
- `discovery.dns` (AAAA) + `prometheus.scrape` per env via env vars
- `prometheus.relabel` for `env`, `app`
- `prometheus.remote_write` to Grafana Cloud
- fail-fast startup check for required secret env vars (`PROM_REMOTE_WRITE_URL`, `PROM_USERNAME`, `GRAFANA_CLOUD_API_KEY`)
- Alloy self-monitoring via `/metrics`, `/-/ready`, `/-/healthy`

## Region

All Fly configs are set to `primary_region = "arn"`.

## Deploy order

1. Deploy metrics-emulator (example):

```bash
fly deploy -c fly.metrics-emulator.toml
```

2. Deploy Alloy per env:

```bash
fly deploy -c observability/alloy/fly.alloy.preproduction.toml
fly deploy -c observability/alloy/fly.alloy.staging.toml
fly deploy -c observability/alloy/fly.alloy.production.toml
```

## Default scrape targets

Configured defaults:

- preproduction: `ecom-fe-sveltekit-preproduction`
- staging: `ecom-fe-sveltekit-staging`
- production: `ecom-fe-sveltekit-production`

For each Alloy app, set Fly secrets:

- `PROM_REMOTE_WRITE_URL`
- `PROM_USERNAME`
- `GRAFANA_CLOUD_API_KEY`

Example (replace placeholder values first):

```bash
# preproduction
fly secrets set -a ecom-alloy-preproduction \
  PROM_REMOTE_WRITE_URL="https://<your-prom-endpoint>/api/prom/push" \
  PROM_USERNAME="<your-prom-username>" \
  GRAFANA_CLOUD_API_KEY="<your-grafana-cloud-api-key>"

# staging
fly secrets set -a ecom-alloy-staging \
  PROM_REMOTE_WRITE_URL="https://<your-prom-endpoint>/api/prom/push" \
  PROM_USERNAME="<your-prom-username>" \
  GRAFANA_CLOUD_API_KEY="<your-grafana-cloud-api-key>"

# production
fly secrets set -a ecom-alloy-production \
  PROM_REMOTE_WRITE_URL="https://<your-prom-endpoint>/api/prom/push" \
  PROM_USERNAME="<your-prom-username>" \
  GRAFANA_CLOUD_API_KEY="<your-grafana-cloud-api-key>"
```

Where to get values in Grafana Cloud:

- `PROM_REMOTE_WRITE_URL`: Metrics (Prometheus/Mimir) `Remote write` endpoint URL
- `PROM_USERNAME`: Metrics instance username
- `GRAFANA_CLOUD_API_KEY`: API key with `MetricsPublisher` (or equivalent write) permissions
