export const calculateTimeTakenBonus = (timeTaken: number): number => {
	if (timeTaken < 0) return 0;

	const maxBonus = 55;
	const minBonus = 1;
	const timeThreshold = 900;

	const timeBonus = maxBonus - timeTaken * (maxBonus / timeThreshold);
	return Math.min(maxBonus, Math.max(minBonus, timeBonus));
};
