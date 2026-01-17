export function generateFooter(): string {
	return `import { cacheLife, cacheTag } from "next/cache";

export async function Footer() {
	"use cache";
	cacheLife("weeks");
	cacheTag("marketing-footer");

	return (
		<footer className="border-t py-6 text-center text-sm text-muted-foreground">
			<p>&copy; {new Date().getFullYear()} Your Company. All rights reserved.</p>
		</footer>
	);
}
`;
}
