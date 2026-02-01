export function generateVSCodeExtensions(): string {
	return JSON.stringify({ recommendations: ["biomejs.biome"] }, null, "\t");
}
