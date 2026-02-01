export function generateUIComponentsJson(): string {
	return `${JSON.stringify(
		{
			$schema: "https://ui.shadcn.com/schema.json",
			style: "default",
			rsc: true,
			tsx: true,
			tailwind: {
				config: "",
				css: "../../apps/web/app/globals.css",
				baseColor: "slate",
				cssVariables: true,
			},
			iconLibrary: "lucide",
			aliases: {
				components: "@workspace/ui/components",
				utils: "@workspace/ui/lib/utils",
				ui: "@workspace/ui/components",
				hooks: "@workspace/ui/hooks",
				lib: "@workspace/ui/lib",
			},
		},
		null,
		2,
	)}
`;
}
