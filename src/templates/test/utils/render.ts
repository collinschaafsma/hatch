export function generateTestRenderUtils(): string {
	return `import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

interface ProvidersProps {
	children: ReactNode;
}

function Providers({ children }: ProvidersProps) {
	// Add providers here as needed (e.g., ThemeProvider, QueryClientProvider)
	return <>{children}</>;
}

function customRender(
	ui: ReactElement,
	options?: Omit<RenderOptions, "wrapper">,
) {
	return render(ui, { wrapper: Providers, ...options });
}

export * from "@testing-library/react";
export { customRender as render };
`;
}
