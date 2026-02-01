export function generateWebComponentsJson(): string {
	return `${JSON.stringify(
		{
			$schema: "https://ui.shadcn.com/schema.json",
			style: "default",
			rsc: true,
			tsx: true,
			tailwind: {
				config: "",
				css: "app/globals.css",
				baseColor: "slate",
				cssVariables: true,
			},
			iconLibrary: "lucide",
			aliases: {
				components: "@/components",
				hooks: "@/hooks",
				lib: "@/lib",
				utils: "@workspace/ui/lib/utils",
				ui: "@workspace/ui/components",
			},
		},
		null,
		2,
	)}
`;
}
