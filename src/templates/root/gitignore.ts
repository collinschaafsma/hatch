export function generateGitignore(): string {
	return `# Dependencies
node_modules/
.pnpm-store/

# Build
.next/
dist/
.turbo/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Testing
coverage/

# Drizzle
drizzle/

# Setup script state (idempotency tracking)
.setup-state
`;
}
