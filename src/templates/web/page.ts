export function generateHomePage(): string {
	return `import Link from "next/link";
import { Button } from "@workspace/ui/components/button";

export default function HomePage() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
			<div className="text-center">
				<h1 className="text-4xl font-bold mb-4">Welcome to Your App</h1>
				<p className="text-muted-foreground text-lg">
					Built with Next.js, Turborepo, and Hatch
				</p>
			</div>

			<div className="flex gap-4">
				<Button asChild>
					<Link href="/login">Get Started</Link>
				</Button>
				<Button variant="outline" asChild>
					<Link href="/dashboard">Dashboard</Link>
				</Button>
			</div>
		</div>
	);
}
`;
}
