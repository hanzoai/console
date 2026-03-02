#!/bin/bash

# Load environment variables
[ -f ../../.env ] && source ../../.env

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

# Construct the database URL
if [ "$DATASTORE_MIGRATION_SSL" = true ] ; then
    DATABASE_URL="${DATASTORE_MIGRATION_URL}?username=${DATASTORE_USER}&password=${DATASTORE_PASSWORD}&database=${DATASTORE_DB}&x-multi-statement=true&secure=true&skip_verify=true&x-migrations-table-engine=MergeTree"
else
    DATABASE_URL="${DATASTORE_MIGRATION_URL}?username=${DATASTORE_USER}&password=${DATASTORE_PASSWORD}&database=${DATASTORE_DB}&x-multi-statement=true&x-migrations-table-engine=MergeTree"
fi
# Execute the drop command
migrate -source file://clickhouse/migrations -database "$DATABASE_URL" drop
