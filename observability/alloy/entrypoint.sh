#!/bin/sh
set -eu

required_vars="
PROM_REMOTE_WRITE_URL
PROM_USERNAME
GRAFANA_CLOUD_API_KEY
"

missing_vars=""

for var_name in $required_vars; do
  # Read env var by name and treat empty values as missing.
  eval "var_value=\${$var_name:-}"
  if [ -z "$var_value" ]; then
    missing_vars="$missing_vars $var_name"
  fi
done

if [ -n "$missing_vars" ]; then
  echo "ERROR: Missing required secret env vars:$missing_vars" >&2
  echo "Set them via Fly secrets before deploy startup." >&2
  exit 1
fi

exec alloy run \
  --server.http.listen-addr=[::]:12345 \
  --storage.path=/var/lib/alloy/data \
  /etc/alloy/config.alloy
