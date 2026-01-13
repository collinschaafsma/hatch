export function generateUIPackageJson(): string {
	return `${JSON.stringify(
		{
			name: "@repo/ui",
			version: "0.0.1",
			private: true,
			exports: {
				".": "./src/index.ts",
			},
			scripts: {
				lint: "biome check .",
			},
			devDependencies: {
				typescript: "^5.6.0",
			},
			peerDependencies: {
				react: "^19.0.0",
			},
		},
		null,
		2,
	)}
`;
}
