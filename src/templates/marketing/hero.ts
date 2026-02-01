export function generateHero(): string {
	return `import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { Button } from "@workspace/ui/components/button";

export async function Hero() {
	"use cache";
	cacheLife("days");
	cacheTag("marketing-hero");

	return (
		<section className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
			<h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
				Welcome to Your App
			</h1>
			<p className="text-lg text-muted-foreground max-w-md">
				Built with Next.js, Turborepo, and Hatch
			</p>
			<Button asChild size="lg">
				<Link href="/login">Sign In</Link>
			</Button>
		</section>
	);
}
`;
}
