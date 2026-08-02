#!/usr/bin/env bash
# ── Ascendly secrets encrypt (Phase 8 NV5 — SOPS + age) ──────────────────────
# Encrypts a plaintext secret manifest into a SOPS-encrypted *.enc.yaml file.
#
# Usage:
#   bash devops/scripts/secrets-encrypt.sh <staging|production> [input-file]
#
#   input-file defaults to devops/secrets/secrets.<env>.plain.yaml (gitignored).
#   Output: devops/secrets/secrets.<env>.enc.yaml (committed — encrypted only).
#
# Recipient: the age public key in devops/secrets/age.pubkey.txt.
# Private key: deployer's ~/.config/sops/age/keys.txt (never committed).
#
# Requires `sops` (preferred) or the `age` CLI. sops produces a reviewable
# SOPS-format YAML; the age fallback produces a binary age blob.
set -euo pipefail

ENV_NAME="${1:-}"
INPUT="${2:-}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SECRETS_DIR="$REPO_ROOT/devops/secrets"
PUBKEY_FILE="$SECRETS_DIR/age.pubkey.txt"

if [ -z "$ENV_NAME" ]; then
  echo "Usage: secrets-encrypt.sh <staging|production> [input-file]" >&2
  exit 2
fi
case "$ENV_NAME" in
  staging|production) ;;
  *) echo "::error::Unknown environment '$ENV_NAME' (expected staging|production)" >&2; exit 2 ;;
esac

if [ -z "$INPUT" ]; then
  INPUT="$SECRETS_DIR/secrets.$ENV_NAME.plain.yaml"
fi
OUTPUT="$SECRETS_DIR/secrets.$ENV_NAME.enc.yaml"

[ -f "$INPUT" ] || { echo "::error::plaintext file not found: $INPUT (create it first — NEVER commit it)" >&2; exit 1; }
[ -f "$PUBKEY_FILE" ] || { echo "::error::age public key missing: $PUBKEY_FILE" >&2; exit 1; }

# age.pubkey.txt may carry comments — take the first bare age1... line.
PUBKEY="$(grep -oE '^age1[a-z0-9]+$' "$PUBKEY_FILE" | head -1)"
[ -n "$PUBKEY" ] || { echo "::error::no age1... public key found in $PUBKEY_FILE" >&2; exit 1; }

if command -v sops >/dev/null 2>&1; then
  sops --encrypt --age "$PUBKEY" \
    --input-type yaml --output-type yaml \
    "$INPUT" > "$OUTPUT"
  echo "✅ Encrypted $INPUT → $OUTPUT (sops, recipient $PUBKEY)"
else
  command -v age >/dev/null 2>&1 || { echo "::error::neither sops nor age found — install one of them" >&2; exit 1; }
  age --encrypt --recipient "$PUBKEY" --output "$OUTPUT" "$INPUT"
  echo "✅ Encrypted $INPUT → $OUTPUT (age fallback, recipient $PUBKEY)"
fi
echo "🔒 Verify: bash devops/scripts/secrets-decrypt.sh $ENV_NAME"
