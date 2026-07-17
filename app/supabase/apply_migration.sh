#!/usr/bin/env bash
# Apply a migration file to the hosted Supabase project (amd Hackathon,
# birxppzpkybqoyldxktz) through the Management API — the same path the earlier
# migrations used. Auth comes from YOUR `supabase login` token (macOS keychain
# or ~/.supabase/access-token); the token is never printed.
#
#   bash app/supabase/apply_migration.sh app/supabase/migrations/20260717210000_loan_orders.sql
set -euo pipefail

FILE="${1:?usage: apply_migration.sh <migration.sql>}"
REF="birxppzpkybqoyldxktz"

TOKEN="$(cat "$HOME/.supabase/access-token" 2>/dev/null \
  || security find-generic-password -s 'Supabase CLI' -w 2>/dev/null \
  || security find-generic-password -l 'Supabase CLI' -w 2>/dev/null \
  || security find-generic-password -s 'supabase-cli' -w 2>/dev/null \
  || true)"
if [ -z "$TOKEN" ]; then
  echo "No Supabase CLI token found — run \`supabase login\` first." >&2
  exit 1
fi

BODY="$(python3 - "$FILE" <<'PY'
import json, sys
print(json.dumps({"query": open(sys.argv[1]).read()}))
PY
)"

# NB: a curl User-Agent is required — other UAs get Cloudflare-blocked (1010).
HTTP_CODE="$(curl -sS -o /tmp/supabase_migration_out.json -w '%{http_code}' \
  -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data "$BODY")"

echo "HTTP $HTTP_CODE"
head -c 800 /tmp/supabase_migration_out.json; echo
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo "✓ migration applied: $FILE"
else
  echo "✗ migration failed — paste the SQL into the Supabase dashboard SQL editor instead." >&2
  exit 1
fi
