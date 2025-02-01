import fs from 'fs';
import path from 'path';

// Get media URL from environment variables
const isProduction = process.env.PRODUCTION && process.env.PRODUCTION.toLowerCase() === 'true';
const mediaBaseURL = isProduction === true ? process.env.R2_BUCKET_URL : process.env.MEDIA_BASE_URL;

if (!mediaBaseURL) {
	console.error('❌ Error: MEDIA_BASE_URL is not defined.');
	process.exit(1);
}

// Read the seed SQL file and replace `{MEDIA_BASE_URL}`
const seedFilePath = path.join(__dirname, '../migrations/seed_data.sql');
const outputFilePath = path.join(__dirname, '../migrations/prepared_seed_data.sql');

let seedSQL = fs.readFileSync(seedFilePath, 'utf8');
seedSQL = seedSQL.replace(/{MEDIA_BASE_URL}/g, mediaBaseURL);

// Write modified SQL to a new file
fs.writeFileSync(outputFilePath, seedSQL, 'utf8');

console.log(`✅ Seed data prepared for ${process.env.PRODUCTION === 'true' ? 'Production' : 'Local Development'}`);
