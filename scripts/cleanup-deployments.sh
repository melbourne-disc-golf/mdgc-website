#!/usr/bin/env bash
#
# Clean up old Cloudflare Pages deployments
#
# Required environment variables:
#   CLOUDFLARE_API_TOKEN   - API token with Pages:Edit permission
#   CLOUDFLARE_ACCOUNT_ID  - Cloudflare account ID
#   CLOUDFLARE_PROJECT     - Cloudflare Pages project name
#
# Optional environment variables:
#   MAX_AGE_DAYS           - Delete deployments older than this (default: 30)
#   DRY_RUN                - If "true", list but don't delete
#

set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?Required}"
: "${CLOUDFLARE_ACCOUNT_ID:?Required}"
: "${CLOUDFLARE_PROJECT:?Required}"
: "${MAX_AGE_DAYS:=30}"
: "${DRY_RUN:=false}"

API_BASE="https://api.cloudflare.com/client/v4"

# Calculate cutoff date (works on both Linux and macOS)
if date --version >/dev/null 2>&1; then
  # GNU date (Linux)
  CUTOFF_DATE=$(date -d "-${MAX_AGE_DAYS} days" +%Y-%m-%dT%H:%M:%SZ)
else
  # BSD date (macOS)
  CUTOFF_DATE=$(date -v-${MAX_AGE_DAYS}d +%Y-%m-%dT%H:%M:%SZ)
fi

echo "Cleaning up deployments older than ${MAX_AGE_DAYS} days (before ${CUTOFF_DATE})"
echo "Project: ${CLOUDFLARE_PROJECT}"
echo "Dry run: ${DRY_RUN}"
echo ""

page=1
deleted=0
skipped=0
kept=0

while true; do
  response=$(curl -s -X GET \
    "${API_BASE}/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${CLOUDFLARE_PROJECT}/deployments?page=${page}&per_page=25" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json")

  # Check for errors
  success=$(echo "$response" | jq -r '.success')
  if [ "$success" != "true" ]; then
    echo "API error:"
    echo "$response" | jq -r '.errors'
    exit 1
  fi

  # Get deployments from this page
  count=$(echo "$response" | jq '.result | length')

  if [ "$count" -eq 0 ]; then
    break
  fi

  for i in $(seq 0 $((count - 1))); do
    deployment=$(echo "$response" | jq -c ".result[$i]")

    id=$(echo "$deployment" | jq -r '.id')
    created_on=$(echo "$deployment" | jq -r '.created_on')
    aliases=$(echo "$deployment" | jq -r '.aliases // [] | length')
    branch=$(echo "$deployment" | jq -r '.deployment_trigger.metadata.branch // "unknown"')

    # Skip deployments with aliases (current production, active branch previews)
    if [ "$aliases" -gt 0 ]; then
      echo "SKIP: ${id} (has ${aliases} alias(es), branch: ${branch})"
      skipped=$((skipped + 1))
      continue
    fi

    # Check if deployment is older than cutoff
    if [[ "$created_on" < "$CUTOFF_DATE" ]]; then
      if [ "$DRY_RUN" = "true" ]; then
        echo "WOULD DELETE: ${id} (created: ${created_on}, branch: ${branch})"
      else
        echo "DELETE: ${id} (created: ${created_on}, branch: ${branch})"
        delete_response=$(curl -s -X DELETE \
          "${API_BASE}/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${CLOUDFLARE_PROJECT}/deployments/${id}?force=true" \
          -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
          -H "Content-Type: application/json")

        delete_success=$(echo "$delete_response" | jq -r '.success')
        if [ "$delete_success" != "true" ]; then
          echo "  Failed to delete: $(echo "$delete_response" | jq -r '.errors')"
        fi
      fi
      deleted=$((deleted + 1))
    else
      echo "KEEP: ${id} (created: ${created_on}, branch: ${branch})"
      kept=$((kept + 1))
    fi
  done

  # Check if there are more pages
  total_pages=$(echo "$response" | jq -r '.result_info.total_pages // 1')
  if [ "$page" -ge "$total_pages" ]; then
    break
  fi
  page=$((page + 1))
done

echo ""
if [ "$DRY_RUN" = "true" ]; then
  echo "Summary: Would delete ${deleted}, Skipped ${skipped}, Kept ${kept}"
else
  echo "Summary: Deleted ${deleted}, Skipped ${skipped}, Kept ${kept}"
fi
