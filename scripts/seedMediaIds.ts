import fs from 'fs';

import { v5 as uuidv5 } from 'uuid';

/**
 * Fixed namespace for UUID generation to ensure consistency.
 */
const NAMESPACE_UUID = 'a614a22b-ead8-448b-9c5d-943c5389a707';

/**
 * Reads brand IDs and names from stdin (passed by the shell script).
 */
async function readStdin(): Promise<{ id: number; brand_name: string }[]> {
	return new Promise((resolve) => {
		let data = '';
		process.stdin.on('data', (chunk) => (data += chunk));
		process.stdin.on('end', () => {
			try {
				console.log('🔍 Raw JSON received from stdin:');
				console.log(data.trim()); // Log raw JSON input for debugging

				const parsedData = JSON.parse(data.trim());

				// Ensure that parsedData is structured correctly
				if (!Array.isArray(parsedData)) {
					throw new Error('Expected an array, but got something else.');
				}

				// Extract the actual results array
				const results = parsedData[0]?.results;

				if (!Array.isArray(results) || results.length === 0) {
					throw new Error('Invalid JSON format: Missing results array.');
				}

				// Extract `id` and `brand_name`
				const brands = results
					.map((brand) => {
						if (typeof brand.id !== 'number' || typeof brand.brand_name !== 'string') {
							console.error(`⚠️ Invalid brand object found:`, brand);
							return null; // Skip invalid entries
						}
						return { id: brand.id, brand_name: brand.brand_name };
					})
					.filter(Boolean); // Remove null values

				resolve(brands.filter((brand): brand is { id: number; brand_name: string } => brand !== null));
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
async function generateMediaIdQueries(): Promise<void> {
	console.log('🔄 Reading brand IDs from input...');
	const brands = await readStdin();

	if (brands.length === 0) {
		console.error('❌ No valid brands found! Exiting...');
		process.exit(1);
	}

	console.log(`📌 Found ${brands.length} valid brands`);

	const updateStatements = brands
		.map(({ id, brand_name }) => {
			const mediaId = uuidv5(brand_name, NAMESPACE_UUID);
			return `UPDATE brands SET media_id = '${mediaId}' WHERE id = ${id};`;
		})
		.join('\n');

	// Save to SQL file
	const filePath = './migrations/0003_update_media_ids.sql';
	fs.writeFileSync(filePath, updateStatements);
	console.log(`✅ SQL queries saved to ${filePath}`);
}

generateMediaIdQueries();
