#!/bin/sh
set -eu
# A new persistent volume can be root-owned. Initialize its root, then drop privileges.
if [ "$(id -u)" = "0" ]; then
  mkdir -p "${DATA_DIR:-/app/data}"
  chown node:node "${DATA_DIR:-/app/data}"
  exec gosu node "$@"
fi
exec "$@"
