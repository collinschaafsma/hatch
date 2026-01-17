export function generateGitignore(): string {
	return `# Dependencies
node_modules/
.pnpm-store/

# Build
.next/
dist/
.turbo/
*.tsbuildinfo

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

# Setup script state (idempotency tracking)
.setup-state

# Supabase
.supabase/
supabase/.temp/
supabase/.branches/

# Vercel
.vercel/
`;
}
