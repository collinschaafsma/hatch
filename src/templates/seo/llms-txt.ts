export function generateLlmsTxt(name: string): string {
	return `# ${name}

> ${name} is a web application built with Next.js.

## Documentation

- [Home](/): Main landing page
- [Login](/login): User authentication page

## Optional

- [Dashboard](/dashboard): Protected user dashboard (requires authentication)
`;
}
