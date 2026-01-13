export function generateAppLayout(): string {
	return `export default function AppLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <div className="min-h-screen">{children}</div>;
}
`;
}
