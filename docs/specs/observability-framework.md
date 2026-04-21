# ecom-fe-sveltekit Observability Framework

## Overview

This document defines the target observability framework for ecom-fe-sveltekit (aka ecomfe). It establishes a unified model for metrics, logs, traces, dashboards, alerting, and operational workflows that can work across different runtime environments.

The framework is designed to stay runtime agnostic at the core while supporting both the current Fly.io setup and a future Kubernetes based platform. The goal is not only to collect telemetry, but to create a coherent operating model around service health, user journeys, business impact, correlation, and release-aware debugging.

## Goals

- Provide consistent visibility into service health and user impact
- Enable fast incident detection and root cause analysis
- Standardize telemetry across services
- Support both current Fly.io runtime and future Kubernetes runtime
- Avoid coupling observability to a specific infrastructure provider
- Establish a telemetry contract that can be reused across frontend, SSR, BFF, and adjacent services

## Non Goals

- Kubernetes platform rollout
- Migration from Fly.io to cloud infrastructure
- Full Elastic/ELK stack integration in environments without network access
- Advanced anomaly detection or AI based monitoring
- Infrastructure parity between runtimes where the underlying platform does not support it

## Operational Questions

The framework should help operators and developers answer four recurring questions:

1. Is the user journey working?
2. Where is degradation happening: frontend, SSR or BFF, downstream dependency, or infrastructure?
3. What is the business impact: checkout, cart, search, product page, or another critical flow?
4. What should we change next: code, cache, infrastructure, rollout, or dependency configuration?

## Current State

This section describes the implementation baseline captured in the repository at the time this document is merged to `main`.

The following observability components are already in place:

- dedicated application metrics listener
- Golden Signals metrics
- Golden Signals dashboard in Grafana

These provide an initial baseline but are not yet part of a unified framework.

Current limitations:

- no unified telemetry contract
- metrics implementation is inconsistent
- limited correlation between metrics, logs, and traces
- dashboards cover only part of the system
- no clear separation between runtime independent and runtime specific layers
- business journey observability and SLO definitions are still incomplete

## Proposed Approach

The framework is based on the following stack:

- OpenTelemetry for instrumentation and telemetry transport
- Prometheus or Amazon Managed Service for Prometheus (AMP) for metrics
- Grafana for dashboards, alert consumption, and correlation workflows
- Grafana Alloy as the unified telemetry collector and forwarder where runtime allows it
- Tempo as the default tracing backend
- structured JSON logs, with the Elastic/ELK stack used where supported by runtime and network constraints

Important clarification:

OpenTelemetry defines how telemetry is generated and transported. It is not dependent on Tempo. Tempo is used as a trace storage backend within the Grafana based observability stack.

## Observability Outcomes

The framework should support:

- Golden Signals for every critical service
- business-flow observability for key commerce journeys
- cross-signal correlation across metrics, traces, and logs
- SLOs and error budget tracking for critical user-facing flows
- release-aware debugging with version and rollout metadata

## Framework Structure

### Runtime Independent Layer

This layer applies across all runtimes, including Fly.io and Kubernetes.

- Golden Signals
- dependency observability
- user journey observability
- overview dashboard
- application level tracing
- telemetry naming conventions
- service level alerting and SLO inputs
- log schema and correlation fields

### Runtime Specific Layer

This layer depends on runtime capabilities.

- infrastructure metrics
- node, pod, or VM visibility
- autoscaling signals
- service discovery
- log shipping topology
- network level telemetry
- collector deployment topology

## Runtime Profiles

### Kubernetes Profile

Target state for full framework implementation.

Capabilities:

- full Prometheus scraping
- OpenTelemetry Collector deployment
- structured logging pipelines
- full tracing support
- node and pod level visibility
- autoscaling signals
- service discovery

Coverage:

- full service observability
- full dependency observability
- full user journey observability
- infrastructure visibility
- scaling and saturation analysis

### Fly.io Profile

Current runtime with partial framework support.

Constraints:

- static VM model
- no autoscaling
- limited infrastructure visibility
- no cluster level collectors
- no VPN access to the on-prem Elastic/ELK stack

Reference deployment (preview):

- metrics: app `/metrics` -> Alloy (singleton) -> Grafana Cloud Prometheus (Mimir)
- traces: app OpenTelemetry export -> Alloy (scaled) -> Grafana Cloud Tempo
- logs: app `stdout` -> Fly log stream or log drain -> Alloy (scaled shipper) -> Grafana Cloud Loki

Collector and backend model:

- Grafana Alloy is the single telemetry agent for metrics, logs, and traces
- Grafana Cloud is the production backend for Prometheus, Loki, and Tempo
- Fly native logs remain available in Fly UI and `fly logs` for quick debugging
- Alloy acts as collector and forwarder, not telemetry generator

Scaling strategy:

- metrics scraping path should run as a singleton Alloy instance to avoid duplicate scrapes
- logs shipping path should be horizontally scalable
- traces ingestion path should be horizontally scalable
- logs pipeline is best-effort and may drop entries during severe transport or collector failures

Supported:

- Golden Signals dashboard
- dependency dashboard
- user journey dashboard
- overview dashboard
- application metrics via Prometheus
- OpenTelemetry instrumentation
- Tempo based tracing
- service level alerting

Operational note:

- Fly.io-managed Grafana should be treated as a dashboard and query surface unless alerting capability for the organization is explicitly validated
- alert routing should not depend on a dashboard provider-specific UI being available

Limited:

- infrastructure metrics
- runtime internals visibility
- autoscaling signals
- full log pipeline integration
- validation of exemplar support

## Applicability Matrix

- Golden Signals: full support in both environments
- dependency dashboard: full support in both environments
- user journey dashboard: full support in both environments
- overview dashboard: full support in both environments
- application tracing: full support in both environments
- infrastructure metrics: full in Kubernetes, limited in Fly.io
- autoscaling observability: only in Kubernetes
- log platform integration: depends on network model and runtime constraints

## Telemetry Domains

### 1. Business and User-Facing SLIs

This layer measures whether critical commerce journeys are working.

- homepage render success
- product listing page success rate and latency
- product detail page success rate and latency
- add-to-cart success rate
- cart page load success
- checkout start rate
- checkout submit success rate
- payment redirect and callback success
- search success rate and zero-result ratio
- auth or session restore success

### 2. Frontend and Browser

- page load timings
- route transition duration
- JavaScript errors
- browser side API latency
- Web Vitals such as `LCP`, `INP`, and `CLS`
- asset load failures
- third-party script impact
- geography, device, and browser breakdowns

### 3. SSR, Node.js, and BFF

- request rate
- error rate
- latency by route
- downstream dependency latency
- event loop lag
- heap and garbage collection
- active requests
- timeouts, retries, and circuit-breaker openings
- cache hit ratio
- render duration
- external API failure rate

### 4. Platform and Infrastructure

- ingress and load balancer metrics
- pod or VM restarts
- CPU and memory saturation
- autoscaling behavior where available
- node pressure
- DNS and TLS errors
- Redis, queue, Kafka, search, and other dependency health
- CDN and edge metrics where applicable

## Dashboard Model

### Overview Dashboard

Provides high level system health:

- availability
- latency summary
- error rate
- dependency status
- user journey summary
- deployment version context

### Golden Signals Dashboard

Core service health:

- latency
- traffic
- errors
- saturation where available

### Dependency Dashboard

Dependency health:

- cache latency
- downstream API latency
- error rates
- timeout rates

### User Journey Dashboard

Business flow health:

- homepage
- product page
- listing page
- add to cart
- checkout

### Runtime Dashboard

- Kubernetes: pods, nodes, autoscaling, ingress
- Fly.io: limited VM level signals

## Telemetry Principles

### One metrics listener

All application metrics must be exposed through a single unified endpoint.

### Model driven metrics

Metrics must represent:

- service health
- dependency health
- user journeys

### Contract first

Observability must be built around a telemetry contract, not only around dashboards or ad hoc instrumentation.

### Runtime independent first

Core observability must work regardless of runtime.

### Runtime specific second

Infrastructure signals are an extension, not the foundation.

## Telemetry Contract

### Required Resource Attributes

All signals should standardize on the following fields where applicable:

- `service.name`
- `service.namespace`
- `service.version`
- `deployment.environment`
- `cloud.provider`
- `cloud.region`
- `k8s.cluster.name`
- `k8s.namespace.name`
- `k8s.deployment.name`
- `k8s.pod.name`

Runtime specific attributes should be present only when supported. Kubernetes fields are required for Kubernetes workloads, but should not be treated as mandatory for Fly.io or other runtimes that cannot provide them.

### Required Request Dimensions

Request level telemetry should include:

- `http.request.method`
- `url.scheme`
- `server.address` or logical upstream name
- `http.response.status_code`
- normalized route or operation name
- `error.type`
- tenant, channel, or site where applicable
- `release`, `git_sha`, and `feature_flag` where practical

### Logging Standard

Application logs should follow these rules:

- structured JSON only
- no free text as the primary log format
- standardized severity field
- `trace_id` and `span_id` injection
- `request_id` included where available
- user or session identifiers only when compliant and masked

Recommended business or domain fields:

- `brand`
- `market`
- `channel`
- `journey_step`
- `cart_id` or `order_id` only where policy allows it

## Correlation Model

Every telemetry item should carry the attributes needed for cross-signal navigation wherever technically possible and policy compliant.

Core correlation fields:

- `service.name`
- `deployment.environment`
- `service.version`
- `trace_id`
- normalized route or operation name
- request metadata that is safe to retain

Correlation workflows should include:

- exemplars from latency histograms to traces
- `trace_id` in logs
- dashboards with jump links from metric to trace
- trace to logs navigation
- alert to dashboard and trace search workflows

## Metrics Strategy

The current application metrics implementation should be refactored to:

- unify all metrics under one listener
- align metrics with the Golden Signals model
- extend metrics for dependency observability
- extend metrics for business journey observability
- avoid ad hoc metric creation

Metrics should be designed around dashboards, incident workflows, and SLO inputs.

## Tracing Strategy

- use OpenTelemetry for instrumentation
- send traces to Tempo
- propagate trace context across services
- use consistent span naming
- support release and deployment correlation where practical

Tracing should support:

- request level debugging
- dependency analysis
- correlation with metrics
- browser to SSR to downstream tracing where technically feasible

## Logging Strategy

- use structured JSON logs
- include `trace_id` in logs
- standardize fields across services
- define drop, redact, and masking rules

Log integration depends on runtime and network constraints.

## Alerting Philosophy

The framework should avoid large volumes of low value alerts.

Alerting should be decoupled into three separate concerns:

- signal generation: application and platform metrics, logs, and traces
- rule evaluation: Prometheus-compatible alert rules or equivalent managed alert engine
- notification delivery: Microsoft Teams by default, with optional PagerDuty, Slack, email, or webhook receivers

Default channel policy:

- operational alerts are sent to shared Teams channels by default
- dashboards are for triage and analysis, not primary notification transport
- no production-critical alert should require somebody to watch a tool-specific UI

PagerDuty decision gate:

- PagerDuty remains optional in preview and becomes required only if a 24/7 on-call paging model is adopted
- if adopted, map `P0` and selected `P1` alerts to PagerDuty escalation policies
- if not adopted, keep Teams routing and define explicit in-hours ownership and escalation path

This separation allows the same monitoring model to work whether dashboards are hosted in Fly.io managed Grafana, AWS Managed Grafana, self-hosted Grafana, or another compatible frontend.

### Symptom Alerts

These should represent user or business impact first.

- checkout success rate down
- add-to-cart failures rising
- product page latency `p95` breached
- SSR error rate high
- client side JavaScript error surge
- search zero-result anomaly
- external API timeout rate high
- order-volume or checkout-progress anomalies only when backed by agreed business thresholds and traffic context

### Cause or Support Alerts

These are supporting signals for investigation, not the primary paging model.

- pod or VM crash loops
- Redis saturation
- CDN or origin failures
- collector backlog
- Elasticsearch ingest lag
- high trace drop ratio

## Initial SLO Candidates

Initial candidates for discussion and validation:

- checkout submit success `>= 99.9%`
- product page SSR availability `>= 99.95%`
- API `p95 < 500 ms`
- JavaScript fatal error rate under agreed threshold
- search success rate above agreed target

## Sentry Considerations

Sentry may already be used by development teams.

Sentry provides:

- error tracking
- frontend exception visibility
- performance tracing
- session replay
- release tracking

In this framework:

- Sentry is a developer focused tool
- Sentry is not the primary observability backbone

Limitations:

- does not provide system-wide dashboards
- not aligned with Prometheus based SLO models
- separate correlation model from the Grafana stack

Recommended approach:

- use Sentry for debugging and frontend visibility
- use the Grafana stack for system observability
- keep business-flow alerts out of Sentry unless they are directly tied to technical exceptions already represented there
- route operational alerts to shared team channels rather than relying on developers to watch a tool-specific UI

### Tool Responsibility Matrix

- Sentry: frontend and SSR exceptions, release health, session replay, developer debugging
- Prometheus-compatible metrics backend: Golden Signals, journey metrics, SLO inputs, alert rule evaluation
- Grafana or equivalent dashboard UI: dashboards, ad hoc query, incident triage
- chat and paging integrations: Teams as default delivery path, optional PagerDuty for paging, plus Slack, email, or webhooks where needed

This means dashboards and alert transport can change without requiring a redesign of instrumentation.

Preview assumptions resolved (Grafana Cloud first model):

- Grafana Cloud is the production observability backend for metrics, logs, traces, dashboards, and alert rule execution
- Fly.io managed Grafana is treated as an optional dashboard/query surface and is not required for production alerting
- alert rule execution location is Grafana Cloud, independent from where dashboards are viewed
- Fly.io logging path for preview is `stdout` -> Fly stream or drain -> Alloy -> Grafana Cloud Loki, with Fly native logs kept for quick debugging

Remaining open questions for preview-to-accepted transition:

- what Sentry features are actively used in daily operations and which environments are covered
- whether the operating model requires PagerDuty escalation or Teams-only routing is sufficient for the current support model
- which Teams channels, severity routes, and ownership mappings are required per alert category
- whether exemplar support on Fly.io is sufficient for stable metrics-to-trace correlation in production

## Correlation and Exemplars

Grafana supports linking metrics to traces using exemplars.

Requirements:

- OpenMetrics format
- trace context propagation
- Prometheus support for exemplars

For Fly.io this capability must be validated and should not be assumed.

## Delivery Artifacts

The framework should be delivered as a set of concrete artifacts, not only infrastructure:

- telemetry standard
- metric naming and label policy
- log schema
- trace and span naming convention
- OpenTelemetry Collector reference configuration
- service onboarding checklist
- golden signals dashboard template
- business journey dashboard template
- alert catalog
- SLO catalog
- incident investigation flow
- data retention and sampling policy

## Scope

### In Scope

- define the observability framework
- formalize the runtime independent layer
- document runtime profiles
- evolve the Golden Signals baseline
- introduce dependency dashboard
- introduce user journey dashboard
- introduce overview dashboard
- refactor application metrics
- unify metrics listener
- define tracing approach
- define telemetry contract and correlation fields
- define initial alerting and SLO model

### Out of Scope

- infrastructure migration
- Kubernetes rollout
- full log platform integration for Fly.io
- autoscaling observability for Fly.io
- full infrastructure parity across runtimes

## Benefits

- enables progress without dependency on cloud migration
- standardizes observability across environments
- improves incident response
- reduces operational complexity
- prepares the system for future Kubernetes adoption
- creates a reusable telemetry contract for service onboarding

## Implementation Plan

### Phase 1. Foundation

- define the telemetry contract
- standardize resource attributes
- instrument SSR and Node.js first
- expose Prometheus metrics
- move application logs to structured JSON
- deploy OpenTelemetry Collector where supported
- wire Grafana, Tempo, and log workflows together where runtime allows

### Phase 2. Correlation

- inject `trace_id` into logs
- propagate context from browser to SSR to downstream services
- enable exemplars for HTTP latency histograms where supported
- build standard dashboards per service

### Phase 3. Business Observability

- instrument key user journeys
- define SLOs for checkout, cart, search, and product pages
- alert on business symptoms, not only technical symptoms

### Phase 4. Advanced Controls

- sampling strategy refinement
- release markers
- feature flag dimensions
- span metrics and service dependency maps
- runtime specific improvements where platform capabilities allow them

## Next Steps

- formalize the telemetry standard for service and frontend instrumentation
- define the log schema and required correlation fields
- refactor and consolidate the metrics listener
- define dependency metrics
- define user journey metrics
- introduce overview, dependency, and user journey dashboards
- validate Sentry usage
- decide where alert rules will execute independently from where dashboards are viewed
- finalize Teams channel mapping for each alert category and severity
- decide whether PagerDuty is needed for `P0/P1` escalation
- implement tracing via OpenTelemetry and Tempo
- validate exemplar support in Fly.io
- define the first production SLO set for checkout, product pages, search, and cart

For current preview with Grafana Cloud first model:

- mark alert rule execution target as Grafana Cloud
- mark Fly.io managed Grafana alerting dependency as not required
- keep Teams as default notification transport and decide PagerDuty only for 24/7 paging cases
