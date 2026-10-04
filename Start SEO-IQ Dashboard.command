#!/bin/bash
cd "$(dirname "$0")"
lsof -ti:8080 | xargs kill -9 2>/dev/null
# serve-nocache.py, not http.server: plain http.server lets Chrome hard-cache
# the ES modules, so edits to api.js/app.js don't show up on reload.
python3 serve-nocache.py 8080 &
sleep 1
open -a "Google Chrome" http://localhost:8080
wait
