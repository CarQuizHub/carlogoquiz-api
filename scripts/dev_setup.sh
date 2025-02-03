#!/bin/bash

echo "Starting Cloudflare Wrangler Dev Environment..."

# Ensure Wrangler is installed
if ! command -v wrangler &> /dev/null
then
    echo "❌ Wrangler CLI not found. Please install it using: npm install -g wrangler"
    exit 1
fi

# Start HTTP Server for local assets
echo "Starting HTTP Server for Local Assets..."
npx http-server ./assets -p 8787 &

# Initialize and seed your database
echo "Initializing and seeding the database..."

# Check if the database already exists
DB_EXISTS=$(wrangler d1 list | grep -c CarQuizHub)

if [ "$DB_EXISTS" -eq "0" ]; then
    echo "Creating new database CarQuizHub..."
    wrangler d1 create CarQuizHub
else
    echo "Database CarQuizHub already exists. Skipping creation..."
fi

# Extract the new database_id
echo "Extracting the new database_id..."
DATABASE_ID=$(wrangler d1 list | grep CarQuizHub | awk '{print $2}')

if [ -z "$DATABASE_ID" ]; then
    echo "❌ Failed to retrieve the database_id."
    exit 1
fi

# Export the DATABASE_ID environment variable
export DATABASE_ID

# Run database migrations
echo "Running database migrations..."
wrangler d1 execute CarQuizHub --file migrations/0001_create_tables.sql

# Check if database is already seeded
SEED_COUNT=$(wrangler d1 execute CarQuizHub --command "SELECT COUNT(*) FROM brands;" | grep -o '[0-9]*')

if [ "$SEED_COUNT" -gt "0" ]; then
    echo "✅ Database is already seeded. Skipping seed script..."
else
    echo "Seeding database..."
    wrangler d1 execute CarQuizHub --file migrations/0002_seed_brands.sql
fi

# Start Wrangler in the background with the updated environment variable
echo "Starting Wrangler Dev Server with DATABASE_ID=$DATABASE_ID..."
DATABASE_ID=$DATABASE_ID wrangler dev &

echo "✅ Local Cloudflare D1 setup complete!"
echo "✅ Wrangler Dev Server & HTTP Asset Server are running!"