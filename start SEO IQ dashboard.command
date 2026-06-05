#!/bin/bash
cd "$(dirname "$0")"
lsof -ti:8080 | xargs kill -9 2>/dev/null
python3 -m http.server 8080 &
sleep 1
open -a "Google Chrome" http://localhost:8080
wait
