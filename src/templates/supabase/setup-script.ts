export function generateSupabaseSetupScript(): string {
	return `#!/usr/bin/env bash
set -e

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

echo ""
echo "========================================"
echo "       Supabase Project Setup"
echo "========================================"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo -e "\${RED}Error: Supabase CLI is not installed.\${NC}"
  echo ""
  echo "Install it with:"
  echo "  brew install supabase/tap/supabase"
  echo ""
  echo "Or see: https://supabase.com/docs/guides/cli/getting-started"
  exit 1
fi

# Check if already linked
if [[ -f ".supabase/.project-ref" ]]; then
  existing_ref=\$(cat .supabase/.project-ref)
  echo -e "\${YELLOW}Already linked to project: \$existing_ref\${NC}"
  read -p "Re-link to a different project? (y/N) " relink
  if [[ "\$relink" != [yY] ]]; then
    echo "Keeping existing configuration."
    exit 0
  fi
fi

echo "Prerequisites:"
echo "  1. Create a Supabase project at https://supabase.com/dashboard"
echo "  2. Enable branching in Project Settings > Branching (requires Pro plan)"
echo "  3. Copy the project reference ID from Project Settings > General"
echo ""

read -p "Enter your Supabase project reference: " PROJECT_REF

if [[ -z "\$PROJECT_REF" ]]; then
  echo -e "\${RED}Error: Project reference is required.\${NC}"
  exit 1
fi

# Ensure .supabase directory exists
mkdir -p .supabase

# Link to project
echo ""
echo "Linking to Supabase project..."
supabase link --project-ref "\$PROJECT_REF"

# Store project ref for other scripts
echo "\$PROJECT_REF" > .supabase/.project-ref
echo -e "\${GREEN}Project reference saved to .supabase/.project-ref\${NC}"

# Check if branching is enabled
echo ""
echo "Checking branching status..."
if ! supabase branches list --project-ref "\$PROJECT_REF" &> /dev/null; then
  echo -e "\${YELLOW}Warning: Branching may not be enabled for this project.\${NC}"
  echo "Enable it at: https://supabase.com/dashboard/project/\$PROJECT_REF/settings/branching"
  echo ""
  read -p "Continue anyway? (y/N) " continue_setup
  if [[ "\$continue_setup" != [yY] ]]; then
    exit 1
  fi
fi

# Create persistent development branches
echo ""
echo "Creating development branches..."

echo "  Creating 'dev' branch..."
if supabase branches create dev --persistent --project-ref "\$PROJECT_REF" 2>/dev/null; then
  echo -e "  \${GREEN}✓ dev branch created\${NC}"
else
  echo -e "  \${YELLOW}⚠ dev branch may already exist\${NC}"
fi

echo "  Creating 'dev-test' branch..."
if supabase branches create dev-test --persistent --project-ref "\$PROJECT_REF" 2>/dev/null; then
  echo -e "  \${GREEN}✓ dev-test branch created\${NC}"
else
  echo -e "  \${YELLOW}⚠ dev-test branch may already exist\${NC}"
fi

# Wait for branches to be ready
echo ""
echo "Waiting for branches to be provisioned (this may take 1-2 minutes)..."
sleep 10

# Apply migrations to dev branches
echo ""
echo "Applying migrations to development branches..."

echo "  Pushing to dev branch..."
eval "\$(supabase branches get dev --project-ref "\$PROJECT_REF" -o env 2>/dev/null)" || true
if [[ -n "\$POSTGRES_URL" ]]; then
  DATABASE_URL="\$POSTGRES_URL" pnpm --filter web db:push 2>/dev/null || echo -e "  \${YELLOW}⚠ Migration push to dev failed (branch may still be provisioning)\${NC}"
fi

echo "  Pushing to dev-test branch..."
eval "\$(supabase branches get dev-test --project-ref "\$PROJECT_REF" -o env 2>/dev/null)" || true
if [[ -n "\$POSTGRES_URL" ]]; then
  DATABASE_URL="\$POSTGRES_URL" pnpm --filter web db:push 2>/dev/null || echo -e "  \${YELLOW}⚠ Migration push to dev-test failed (branch may still be provisioning)\${NC}"
fi

# Fetch credentials for local development
echo ""
echo "Fetching credentials for local development..."
./scripts/supabase-env dev 2>/dev/null || echo -e "\${YELLOW}⚠ Could not fetch credentials yet. Run './scripts/supabase-env dev' later.\${NC}"

echo ""
echo "========================================"
echo -e "\${GREEN}       Setup Complete!\${NC}"
echo "========================================"
echo ""
echo "Next steps:"
echo ""
echo "  1. For local development:"
echo "     Your .env.local should now have DATABASE_URL configured."
echo "     Run: pnpm dev"
echo ""
echo "  2. For production (Vercel):"
echo "     Add DATABASE_URL to your Vercel environment variables."
echo "     Get it from: https://supabase.com/dashboard/project/\$PROJECT_REF/settings/database"
echo "     Use the 'Transaction' pooler connection string for serverless."
echo ""
`;
}
