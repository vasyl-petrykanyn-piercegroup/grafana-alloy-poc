FROM grafana/alloy:v1.15.1

COPY observability/alloy/config.alloy /etc/alloy/config.alloy
COPY observability/alloy/entrypoint.sh /usr/local/bin/alloy-entrypoint.sh
RUN chmod +x /usr/local/bin/alloy-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/alloy-entrypoint.sh"]
