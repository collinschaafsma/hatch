export function generateMarketingPage(): string {
	return `import { Hero } from "./_components/hero";
import { Footer } from "./_components/footer";

export default function HomePage() {
	return (
		<main className="min-h-screen flex flex-col">
			<Hero />
			<Footer />
		</main>
	);
}
`;
}
