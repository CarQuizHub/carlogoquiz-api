export function CalculateTimeTakenBonus(timeTaken: number): number {
	const maxBonus = 55;
	const minBonus = 1;
	const timeThreshold = 180;

	let timeBonus = Math.max(minBonus, maxBonus - timeTaken * (maxBonus / timeThreshold));
	return timeBonus;
}
