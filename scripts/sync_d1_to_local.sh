#!/bin/bash

echo "Syncing Cloudflare D1 Database to Local SQLite..."

# Ensure Wrangler is installed
if ! command -v wrangler &> /dev/null
then
    echo "❌ Wrangler CLI not found. Please install it using: npm install -g wrangler"
    exit 1
fi

# Define database name
DB_NAME="hardestcarquiz"

# Step 1: Export Cloudflare D1 database to a SQL dump file
echo "Exporting Cloudflare D1 database..."
wrangler d1 execute $DB_NAME --command ".dump" > migrations/prod_d1_backup.sql

# Step 2: Convert the dump into a local SQLite database
if [ -s migrations/prod_d1_backup.sql ]; then
    echo "Creating local SQLite database..."
    sqlite3 migrations/local_d1.db < migrations/prod_d1_backup.sql
    echo "✅ Local SQLite database created: migrations/local_d1.db"
else
    echo "❌ Error: Dump file is empty. Make sure your Cloudflare D1 database is not empty."
fi

echo "Sync complete! Open migrations/local_d1.db in DB Browser for SQLite or another tool."
