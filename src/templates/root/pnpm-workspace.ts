export function generatePnpmWorkspace(): string {
	return `packages:
  - "apps/*"
  - "packages/*"
`;
}
