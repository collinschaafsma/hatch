export function generateAppLayout(): string {
	return `import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { getToken } from "@/lib/auth";

export default async function AppLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const token = await getToken();

	return (
		<ConvexClientProvider initialToken={token}>
			<div className="min-h-screen">{children}</div>
		</ConvexClientProvider>
	);
}
`;
}
