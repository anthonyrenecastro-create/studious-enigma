#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${1:-${SCRIPT_DIR}/../db/aurora_tables.sql}"

: "${AWS_AURORA_CLUSTER_ARN:?AWS_AURORA_CLUSTER_ARN is required}"
: "${AWS_AURORA_SECRET_ARN:?AWS_AURORA_SECRET_ARN is required}"

AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_AURORA_DATABASE="${AWS_AURORA_DATABASE:-atlantean}"

if [[ ! -f "${SQL_FILE}" ]]; then
  echo "SQL file not found: ${SQL_FILE}" >&2
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI is not installed or not in PATH." >&2
  exit 1
fi

TMP_SQL="$(mktemp)"
cleanup() {
  rm -f "${TMP_SQL}"
}
trap cleanup EXIT

# Drop comment-only lines; keep SQL body intact.
sed -E '/^[[:space:]]*--/d' "${SQL_FILE}" > "${TMP_SQL}"

applied=0

while IFS= read -r raw_stmt; do
  stmt="$(echo "${raw_stmt}" | tr '\n' ' ' | sed -E 's/[[:space:]]+/ /g; s/^ //; s/ $//')"
  if [[ -z "${stmt}" ]]; then
    continue
  fi

  aws rds-data execute-statement \
    --region "${AWS_REGION}" \
    --resource-arn "${AWS_AURORA_CLUSTER_ARN}" \
    --secret-arn "${AWS_AURORA_SECRET_ARN}" \
    --database "${AWS_AURORA_DATABASE}" \
    --sql "${stmt};" \
    >/dev/null

  applied=$((applied + 1))
  echo "Applied statement ${applied}"
done < <(awk 'BEGIN { RS=";" } { print }' "${TMP_SQL}")

if [[ "${applied}" -eq 0 ]]; then
  echo "No SQL statements were applied from ${SQL_FILE}."
  exit 1
fi

echo "Aurora schema apply complete. Statements applied: ${applied}"
