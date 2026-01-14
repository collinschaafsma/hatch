export function generateUIPackageJson(): string {
	return `${JSON.stringify(
		{
			name: "@workspace/ui",
			version: "0.0.1",
			private: true,
			exports: {
				"./lib/*": "./src/lib/*.ts",
				"./components/*": "./src/components/*.tsx",
				"./hooks/*": "./src/hooks/*.ts",
			},
			scripts: {
				lint: "biome check .",
			},
			dependencies: {
				"@radix-ui/react-slot": "^1.2.4",
				"class-variance-authority": "^0.7.1",
				clsx: "^2.1.1",
				"lucide-react": "^0.562.0",
				"tailwind-merge": "^3.4.0",
			},
			devDependencies: {
				"@types/react": "^19.2.8",
				"@types/react-dom": "^19.2.3",
				typescript: "^5.9.3",
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
