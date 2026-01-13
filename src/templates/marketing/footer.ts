export function generateFooter(): string {
	return `export function Footer() {
	return (
		<footer className="border-t py-6 text-center text-sm text-muted-foreground">
			<p>&copy; {new Date().getFullYear()} Your Company. All rights reserved.</p>
		</footer>
	);
}
`;
}
