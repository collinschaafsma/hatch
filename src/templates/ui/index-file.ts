export function generateUIIndex(): string {
	return `// UI components are exported via package.json exports field
// Import components like: import { Button } from "@workspace/ui/components/button"
export {};
`;
}
