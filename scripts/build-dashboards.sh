#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS="$REPO_ROOT/grafana/.tools"
OUT="$REPO_ROOT/grafana/out"
mkdir -p "$TOOLS" "$OUT"

JSONNET_VERSION="v0.22.0"
JB_VERSION="v0.6.0"
JB="$TOOLS/jb"
JSONNET="$TOOLS/jsonnet"

if [ ! -x "$JSONNET" ]; then
  tmp="$(mktemp -d)"
  curl -fsSL "https://github.com/google/go-jsonnet/releases/download/${JSONNET_VERSION}/go-jsonnet_${JSONNET_VERSION#v}_linux_amd64.tar.gz" \
    | tar -xz -C "$tmp"
  mv "$tmp/jsonnet" "$TOOLS/jsonnet"
  rm -rf "$tmp"
fi

if [ ! -x "$JB" ]; then
  curl -fsSL -o "$TOOLS/jb" "https://github.com/jsonnet-bundler/jsonnet-bundler/releases/download/${JB_VERSION}/jb-linux-amd64"
  chmod +x "$TOOLS/jb"
fi

cd "$REPO_ROOT/grafana"
"$JB" install
for f in dashboards/*.jsonnet; do
  name="$(basename "$f" .jsonnet)"
  "$JSONNET" -J vendor "$f" > "$OUT/${name}.json"
done