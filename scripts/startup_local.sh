#!/bin/bash

echo "Starting Cloudflare Wrangler Local Development Environment..."

# Ensure Wrangler is installed
if ! command -v wrangler &> /dev/null
then
    echo "❌ Wrangler CLI not found. Please install it using: npm install -g wrangler"
    exit 1
fi

# Open a new Windows Terminal for Wrangler Dev Server
if ! netstat -ano | grep -q ":8787"
then
    echo "Opening new terminal window to run: wrangler dev --local --env dev --inspect"
    start "Wrangler Dev" cmd /k "cd /d \"%CD%\""
fi

# Wait for Wrangler Dev Server to start
while ! netstat -ano | grep -q ":8787"; do
    echo "🔄 Waiting for port 8787 to be open..."
    echo "Run in another terminal: wrangler dev --local --env dev"
    sleep 5
done
echo "✅ Wrangler Dev is running!"

# Check if `0003_update_media_ids.sql` exists
MEDIA_ID_FILE="./migrations/0003_update_media_ids.sql"
if [ ! -f "$MEDIA_ID_FILE" ]; then
    echo "0003_update_media_ids.sql not found. Generating media_id values..."

    # Fetch brand names and pass them to the TypeScript script
    echo "Fetching brand names from the database..."
    BRANDS_JSON=$(wrangler d1 execute DB --local --env dev --command "SELECT id, brand_name FROM brands;" --json)
    sleep 1

    # Generate UUIDs for media_id using brand names
    echo "Generating UUIDs for media_id..."
    echo "$BRANDS_JSON" | npx tsx ./scripts/seedMediaIds.ts
    sleep 3
else
    echo "✅ 0003_update_media_ids.sql already exists. Skipping media_id generation."
fi


# Run database migrations (ensuring the local database is ready)
echo "Running database migrations locally..."
wrangler d1 migrations apply DB --local --env dev
sleep 1

# Verify if any brands are missing a media_id
echo "Verifying database setup..."
MISSING_MEDIA_ID=$(wrangler d1 execute DB --local --env dev --command "SELECT COUNT(*) as count FROM brands WHERE media_id IS NULL OR media_id = '';" --json)
MISSING_COUNT=$(echo "$MISSING_MEDIA_ID" | grep -o '"count":[0-9]*' | grep -o '[0-9]*')
if [[ "$MISSING_COUNT" -eq 0 ]]; then
    echo "✅ Local database setup complete!"
else
    echo "❌ ERROR: $MISSING_COUNT brands are missing media_id. Check the database setup."
    exit 1
fi

echo "To start a NEW session locally:"
echo "  curl -s http://127.0.0.1:8787/session/start | python -m json.tool"
echo ""
echo "To RESTORE an existing session locally (replace SESSION_ID):"
echo "  curl -s -i -H 'session_id: SESSION_ID' http://127.0.0.1:8787/session/restore"
echo ""
echo "To SUBMIT an answer locally:"
echo "  curl -s -X POST http://127.0.0.1:8787/session/answer -H 'Content-Type: application/json' -H 'session_id: SESSION_ID' -d '{\"questionNumber\":0,\"brandId\":1,\"timeTaken\":null}' | python -m json.tool"
echo ""
echo "To END a session locally:"
echo "  curl -s -i -H 'session_id: SESSION_ID' http://127.0.0.1:8787/session/end"
