#!/usr/bin/env bash
# ── Ascendly secrets decrypt (Phase 8 NV5 — SOPS + age) ──────────────────────
# Decrypts devops/secrets/secrets.<env>.enc.yaml to stdout or an output file.
# Used by deploy.sh in the release pipeline (CI) and by operators locally.
#
# Usage:
#   bash devops/scripts/secrets-decrypt.sh <staging|production> [output-file]
#
# Identity (age private key), in order of preference:
#   1. $AGE_SECRET_KEY (CI / GitHub Actions secret)
#   2. ~/.config/sops/age/keys.txt (local SOPS default)
# The private key is NEVER committed.
set -euo pipefail

ENV_NAME="${1:-}"
OUTPUT="${2:-}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SECRETS_DIR="$REPO_ROOT/devops/secrets"
INPUT="$SECRETS_DIR/secrets.$ENV_NAME.enc.yaml"

if [ -z "$ENV_NAME" ]; then
  echo "Usage: secrets-decrypt.sh <staging|production> [output-file]" >&2
  exit 2
fi
case "$ENV_NAME" in
  staging|production) ;;
  *) echo "::error::Unknown environment '$ENV_NAME' (expected staging|production)" >&2; exit 2 ;;
esac

[ -f "$INPUT" ] || { echo "::error::encrypted file not found: $INPUT" >&2; exit 1; }

# ── Resolve the age private key ──────────────────────────────────────────────
KEY_FILE=""
if [ -n "${AGE_SECRET_KEY:-}" ]; then
  KEY_FILE="$(mktemp)"
  trap 'rm -f "$KEY_FILE"' EXIT
  printf '%s\n' "$AGE_SECRET_KEY" > "$KEY_FILE"
  chmod 600 "$KEY_FILE"
elif [ -f "$HOME/.config/sops/age/keys.txt" ]; then
  KEY_FILE="$HOME/.config/sops/age/keys.txt"
else
  echo "::error::no age identity found: set AGE_SECRET_KEY or create ~/.config/sops/age/keys.txt" >&2
  exit 1
fi

if command -v sops >/dev/null 2>&1; then
  if [ -n "${OUTPUT:-}" ]; then
    SOPS_AGE_KEY_FILE="$KEY_FILE" sops --decrypt "$INPUT" > "$OUTPUT"
    echo "✅ Decrypted $INPUT → $OUTPUT (sops)" >&2
  else
    SOPS_AGE_KEY_FILE="$KEY_FILE" sops --decrypt "$INPUT"
  fi
else
  command -v age >/dev/null 2>&1 || { echo "::error::neither sops nor age found — install one of them" >&2; exit 1; }
  if [ -n "${OUTPUT:-}" ]; then
    age --decrypt --identity "$KEY_FILE" --output "$OUTPUT" "$INPUT"
    echo "✅ Decrypted $INPUT → $OUTPUT (age fallback)" >&2
  else
    age --decrypt --identity "$KEY_FILE" "$INPUT"
  fi
fi
