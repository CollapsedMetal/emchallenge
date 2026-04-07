#!/bin/bash
set -o errexit
BASEDIR="$1"
nodemon --exec ts-node /app/server.ts