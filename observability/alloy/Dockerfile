FROM grafana/alloy:latest

COPY observability/alloy/config.alloy /etc/alloy/config.alloy

CMD ["run", \
  "--server.http.listen-addr=[::]:12345", \
  "--storage.path=/var/lib/alloy/data", \
  "/etc/alloy/config.alloy"]
