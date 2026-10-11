#!/bin/bash
# Keeps `expo start --tunnel` up; restarts if the public URL stops answering.
cd /workspace/f1-live
URL=https://fv0h4oa-anonymous-8081.exp.direct/proxy/health
start() { pkill -f "expo start" ; pkill -f ngrok-bin ; sleep 2; CI=1 setsid nohup npx expo start --tunnel >> /tmp/expo.log 2>&1 < /dev/null & sleep 60; }
pgrep -f "expo start --tunnel" >/dev/null || start
fails=0
while true; do
  code=$(curl -s -o /dev/null -m 15 -w "%{http_code}" "$URL")
  if [ "$code" = "200" ]; then fails=0; else fails=$((fails+1)); fi
  echo "$(date '+%F %T') $code fails=$fails" >> /tmp/keepalive.log
  if [ $fails -ge 3 ]; then echo "$(date) restarting" >> /tmp/keepalive.log; start; fails=0; fi
  sleep 30
done
