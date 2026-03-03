#!/bin/bash

# Load environment variables
[ -f ../../.env ] && source ../../.env

# Check if DATASTORE_URL is configured
if [ -z "${DATASTORE_URL}" ]; then
  echo "Error: DATASTORE_URL is not configured."
  echo "Please set DATASTORE_URL in your environment variables."
  exit 1
fi

# Check if DATASTORE_MIGRATION_URL is configured
if [ -z "${DATASTORE_MIGRATION_URL}" ]; then
  echo "Error: DATASTORE_MIGRATION_URL is not configured."
  echo "Please set DATASTORE_MIGRATION_URL in your environment variables."
  exit 1
fi

# Check if DATASTORE_USER is set
if [ -z "${DATASTORE_USER}" ]; then
  echo "Error: DATASTORE_USER is not set."
  echo "Please set DATASTORE_USER in your environment variables."
  exit 1
fi

# Check if DATASTORE_PASSWORD is set
if [ -z "${DATASTORE_PASSWORD}" ]; then
  echo "Error: DATASTORE_PASSWORD is not set."
  echo "Please set DATASTORE_PASSWORD in your environment variables."
  exit 1
fi

# Check if golang-migrate is installed
if ! command -v migrate &> /dev/null
then
    echo "Error: golang-migrate is not installed or not in PATH."
    echo "Install from https://github.com/hanzoai/migrate/releases (includes Datastore driver)."
    echo "Or build from source: go install -tags 'clickhouse datastore file' github.com/golang-migrate/migrate/v4/cmd/migrate@latest"
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

# golang-migrate uses the "clickhouse" driver — translate datastore:// protocol
MIGRATION_HOST="${DATASTORE_MIGRATION_URL#*://}"

# Construct the database URL
if [ "$DATASTORE_CLUSTER_ENABLED" == "false" ] ; then
  if [ "$DATASTORE_MIGRATION_SSL" = true ] ; then
      DATABASE_URL="clickhouse://${MIGRATION_HOST}?username=${DATASTORE_USER}&password=${DATASTORE_PASSWORD}&database=${DATASTORE_DB}&x-multi-statement=true&secure=true&skip_verify=true&x-migrations-table-engine=MergeTree"
  else
      DATABASE_URL="clickhouse://${MIGRATION_HOST}?username=${DATASTORE_USER}&password=${DATASTORE_PASSWORD}&database=${DATASTORE_DB}&x-multi-statement=true&x-migrations-table-engine=MergeTree"
  fi

  # Execute the up command
  migrate -source file://datastore/migrations/unclustered -database "$DATABASE_URL" up
else
if [ "$DATASTORE_MIGRATION_SSL" = true ] ; then
      DATABASE_URL="clickhouse://${MIGRATION_HOST}?username=${DATASTORE_USER}&password=${DATASTORE_PASSWORD}&database=${DATASTORE_DB}&x-multi-statement=true&secure=true&skip_verify=true&x-cluster-name=${DATASTORE_CLUSTER_NAME}&x-migrations-table-engine=ReplicatedMergeTree"
  else
      DATABASE_URL="clickhouse://${MIGRATION_HOST}?username=${DATASTORE_USER}&password=${DATASTORE_PASSWORD}&database=${DATASTORE_DB}&x-multi-statement=true&x-cluster-name=${DATASTORE_CLUSTER_NAME}&x-migrations-table-engine=ReplicatedMergeTree"
  fi

  # Execute the up command
  migrate -source file://datastore/migrations/clustered -database "$DATABASE_URL" up
fi
