#!/bin/bash

# Load environment variables
[ -f ../../.env ] && source ../../.env

# Check if DATASTORE_URL is configured
if [ -z "${DATASTORE_URL}" ]; then
  echo "Info: DATASTORE_URL not configured, skipping migration."
  exit 0
fi

# Check if golang-migrate is installed
if ! command -v migrate &> /dev/null
then
    echo "Error: golang-migrate is not installed or not in PATH."
    echo "Please install golang-migrate via 'brew install golang-migrate' to run this script."
    echo "Visit https://github.com/golang-migrate/migrate for more installation instructions."
    exit 1
fi

# Ensure DATASTORE_DB is set
if [ -z "${DATASTORE_DB}" ]; then
    export DATASTORE_DB="default"
fi

# Ensure DATASTORE_CLUSTER_NAME is set
if [ -z "${DATASTORE_CLUSTER_NAME}" ]; then
    export DATASTORE_CLUSTER_NAME="default"
fi

# Construct the database URL
if [ "$DATASTORE_CLUSTER_ENABLED" == "false" ] ; then
  if [ "$DATASTORE_MIGRATION_SSL" = true ] ; then
      MIGRATION_HOST="${DATASTORE_MIGRATION_URL#*://}"
  DATABASE_URL="clickhouse://${MIGRATION_HOST}?username=${DATASTORE_USER}&password=${DATASTORE_PASSWORD}&database=${DATASTORE_DB}&x-multi-statement=true&secure=true&skip_verify=true&x-migrations-table-engine=MergeTree"
  else
      MIGRATION_HOST="${DATASTORE_MIGRATION_URL#*://}"
  DATABASE_URL="clickhouse://${MIGRATION_HOST}?username=${DATASTORE_USER}&password=${DATASTORE_PASSWORD}&database=${DATASTORE_DB}&x-multi-statement=true&x-migrations-table-engine=MergeTree"
  fi

  # If SKIP_CONFIRM is set, automatically answer the confirmation prompt. Otherwise run interactively.
  if [ "$SKIP_CONFIRM" = "1" ] || [ "$SKIP_CONFIRM" = "true" ]; then
    printf 'y\n' | migrate -source file://datastore/migrations/unclustered -database "$DATABASE_URL" down
  else
    migrate -source file://datastore/migrations/unclustered -database "$DATABASE_URL" down
  fi
else
  if [ "$DATASTORE_MIGRATION_SSL" = true ] ; then
      MIGRATION_HOST="${DATASTORE_MIGRATION_URL#*://}"
  DATABASE_URL="clickhouse://${MIGRATION_HOST}?username=${DATASTORE_USER}&password=${DATASTORE_PASSWORD}&database=${DATASTORE_DB}&x-multi-statement=true&secure=true&skip_verify=true&x-cluster-name=${DATASTORE_CLUSTER_NAME}&x-migrations-table-engine=ReplicatedMergeTree"
  else
      MIGRATION_HOST="${DATASTORE_MIGRATION_URL#*://}"
  DATABASE_URL="clickhouse://${MIGRATION_HOST}?username=${DATASTORE_USER}&password=${DATASTORE_PASSWORD}&database=${DATASTORE_DB}&x-multi-statement=true&x-cluster-name=${DATASTORE_CLUSTER_NAME}&x-migrations-table-engine=ReplicatedMergeTree"
  fi

  # If SKIP_CONFIRM is set, automatically answer the confirmation prompt. Otherwise run interactively.
  if [ "$SKIP_CONFIRM" = "1" ] || [ "$SKIP_CONFIRM" = "true" ]; then
    printf 'y\n' | migrate -source file://datastore/migrations/clustered -database "$DATABASE_URL" down
  else
    migrate -source file://datastore/migrations/clustered -database "$DATABASE_URL" down
  fi
fi
