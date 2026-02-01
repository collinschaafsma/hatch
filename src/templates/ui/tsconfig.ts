export function generateUITsconfig(): string {
	return `${JSON.stringify(
		{
			compilerOptions: {
				target: "ES2017",
				lib: ["dom", "dom.iterable", "esnext"],
				allowJs: true,
				skipLibCheck: true,
				strict: true,
				noEmit: true,
				esModuleInterop: true,
				module: "esnext",
				moduleResolution: "bundler",
				resolveJsonModule: true,
				isolatedModules: true,
				jsx: "react-jsx",
				baseUrl: ".",
				paths: {
					"@workspace/ui/*": ["./src/*"],
					"@/*": ["./src/*"],
				},
			},
			include: ["src/**/*"],
			exclude: ["node_modules"],
		},
		null,
		2,
	)}
`;
}
