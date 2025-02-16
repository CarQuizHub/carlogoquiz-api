import { v5 as uuidv5 } from 'uuid';
import fs from 'fs';

/**
 * Fixed namespace for UUID generation to ensure consistency.
 */
const NAMESPACE_UUID = 'a614a22b-ead8-448b-9c5d-943c5389a707';

/**
 * Reads brand names from stdin (passed by the shell script).
 */
async function readStdin(): Promise<string[]> {
	return new Promise((resolve) => {
		let data = '';
		process.stdin.on('data', (chunk) => (data += chunk));
		process.stdin.on('end', () => {
			try {
				const jsonArray = JSON.parse(data.trim());

				if (!Array.isArray(jsonArray) || jsonArray.length === 0 || !jsonArray[0].results) {
					throw new Error('Invalid JSON format received.');
				}

				const brandNames = jsonArray[0].results.map((brand: { brand_name: string }) => brand.brand_name);
				resolve(brandNames);
			} catch (error) {
				console.error('❌ Failed to parse JSON input:', error);
				process.exit(1);
			}
		});
	});
}

/**
 * Generates UUIDs for brand names and outputs SQL queries.
 */
async function generateMediaIdQueries() {
	console.log('🔄 Reading brand names from input...');
	const brands = await readStdin();

	if (brands.length === 0) {
		console.error('❌ No brands found! Exiting...');
		process.exit(1);
	}

	console.log(`📌 Found ${brands.length} brands`);
	const updateStatements = brands
		.map((brand) => {
			const mediaId = uuidv5(brand, NAMESPACE_UUID);
			return `UPDATE brands SET media_id = '${mediaId}' WHERE brand_name = '${brand}';`;
		})
		.join('\n');

	// Save to SQL file
	const filePath = './migrations/0003_update_media_ids.sql';
	fs.writeFileSync(filePath, updateStatements);
	console.log(`✅ SQL queries saved to ${filePath}`);
}

generateMediaIdQueries();
