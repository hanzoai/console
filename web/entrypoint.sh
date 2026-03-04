#!/bin/sh

# Run cleanup script before running migrations
# Check if DATABASE_URL is not set
if [ -z "$DATABASE_URL" ]; then
    # Check if all required variables are provided
    if [ -n "$DATABASE_HOST" ] && [ -n "$DATABASE_USERNAME" ] && [ -n "$DATABASE_PASSWORD" ]  && [ -n "$DATABASE_NAME" ]; then
        # Construct DATABASE_URL from the provided variables
        DATABASE_URL="postgresql://${DATABASE_USERNAME}:${DATABASE_PASSWORD}@${DATABASE_HOST}/${DATABASE_NAME}"
        export DATABASE_URL
    else
        echo "Error: Required database environment variables are not set. Provide a postgres url for DATABASE_URL."
        exit 1
    fi
    if [ -n "$DATABASE_ARGS" ]; then
        # Append ARGS to DATABASE_URL
        DATABASE_URL="${DATABASE_URL}?$DATABASE_ARGS"
        export DATABASE_URL
    fi
fi

# Check if DATASTORE_URL is not set
if [ -z "$DATASTORE_URL" ]; then
    echo "Error: DATASTORE_URL is not configured. Set DATASTORE_URL in your environment variables."
    exit 1
fi

# Set DIRECT_URL to the value of DATABASE_URL if it is not set, required for migrations
if [ -z "$DIRECT_URL" ]; then
    export DIRECT_URL="${DATABASE_URL}"
fi

# Always execute the postgres migration, except when disabled.
if [ "$HANZO_AUTO_POSTGRES_MIGRATION_DISABLED" != "true" ]; then
    prisma db execute --url "$DIRECT_URL" --file "./packages/shared/scripts/cleanup.sql"

    # Apply migrations
    prisma migrate deploy --schema=./packages/shared/prisma/schema.prisma
fi
status=$?

# If migration fails (returns non-zero exit status), exit script with that status
if [ $status -ne 0 ]; then
    echo "Applying database migrations failed. This is mostly caused by the database being unavailable."
    echo "Exiting..."
    exit $status
fi

# Execute the datastore migration, except when disabled.
if [ "$DATASTORE_AUTO_MIGRATION_DISABLED" != "true" ]; then
    # Retry datastore migrations with backoff.
    # The native protocol (port 9000) can lag behind the HTTP health check (8123),
    # causing "Authentication failed" on first attempt. Retry handles this race.
    ds_attempt=0
    ds_max_attempts=10
    status=1
    while [ "$ds_attempt" -lt "$ds_max_attempts" ] && [ "$status" -ne 0 ]; do
        ds_attempt=$((ds_attempt + 1))
        if [ "$ds_attempt" -gt 1 ]; then
            echo "Datastore migration attempt ${ds_attempt}/${ds_max_attempts} (retrying in 3s)..."
            sleep 3
        fi
        cd ./packages/shared
        sh ./datastore/scripts/up.sh
        status=$?
        cd ../../
    done
fi

# If migration fails (returns non-zero exit status), exit script with that status
if [ $status -ne 0 ]; then
    echo "Applying datastore migrations failed. This is mostly caused by the database being unavailable."
    echo "Exiting..."
    exit $status
fi

# Run the command passed to the docker image on start
exec "$@"
