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

# Start Wrangler in the background
echo "📡 Starting Wrangler Dev Server..."
wrangler dev &

# Wait a few seconds to let Wrangler initialize
sleep 7

# Run database migrations
echo "Running database migrations..."
wrangler d1 execute CarQuizHub --file migrations/0001_create_tables.sql

# Check if database is already seeded
SEED_COUNT=$(wrangler d1 execute CarQuizHub --command "SELECT COUNT(*) FROM media;" | grep -o '[0-9]*')

if [ "$SEED_COUNT" -gt "0" ]; then
    echo "✅ Database is already seeded. Skipping seed script..."
else
    echo "Preparing seed data..."
    node scripts/prepare_seed_data.ts
    echo "Seeding database..."
    wrangler d1 execute CarQuizHub --file migrations/0002_seed_brands.sql
fi

echo "✅ Local Cloudflare D1 setup complete!"
echo "✅ Wrangler Dev Server & HTTP Asset Server are running!"