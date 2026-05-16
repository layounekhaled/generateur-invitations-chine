#!/bin/bash
cd /home/z/my-project
while true; do
  python3 mini-services/pdf-service/service.py
  echo "[$(date)] PDF service crashed, restarting in 3s..." >> /tmp/pdf-service.log
  sleep 3
done
