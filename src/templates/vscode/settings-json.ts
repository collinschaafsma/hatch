export function generateVSCodeSettings(): string {
	return JSON.stringify(
		{
			"editor.defaultFormatter": "biomejs.biome",
			"editor.formatOnSave": true,
			"editor.tabSize": 2,
			"editor.insertSpaces": true,
			"eslint.enable": false,
			"prettier.enable": false,
			"typescript.tsdk": "node_modules/typescript/lib",
			"editor.codeActionsOnSave": {
				"source.organizeImports.biome": "explicit",
				"source.fixAll.biome": "explicit",
			},
			"biome.lspBin": "./node_modules/@biomejs/biome/bin/biome",
			"[javascript]": { "editor.defaultFormatter": "biomejs.biome" },
			"[typescript]": { "editor.defaultFormatter": "biomejs.biome" },
			"[typescriptreact]": { "editor.defaultFormatter": "biomejs.biome" },
			"[json]": { "editor.defaultFormatter": "biomejs.biome" },
			"[jsonc]": { "editor.defaultFormatter": "biomejs.biome" },
		},
		null,
		"\t",
	);
}
