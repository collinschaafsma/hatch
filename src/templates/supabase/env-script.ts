export function generateSupabaseEnvScript(): string {
	return `#!/usr/bin/env bash
set -e

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

BRANCH="\${1:-dev}"
ENV_FILE="apps/web/.env.local"

# Check for project ref
if [[ ! -f ".supabase/.project-ref" ]]; then
  echo -e "\${RED}Error: Supabase project not configured.\${NC}"
  echo "Run: pnpm supabase:setup"
  exit 1
fi

PROJECT_REF=\$(cat .supabase/.project-ref)

echo "Fetching credentials for branch: \$BRANCH"
echo ""

# Get main branch credentials
echo "  Fetching \$BRANCH credentials..."
if ! eval "\$(supabase branches get "\$BRANCH" --project-ref "\$PROJECT_REF" -o env 2>/dev/null)"; then
  echo -e "\${RED}Error: Could not fetch credentials for branch '\$BRANCH'\${NC}"
  echo "Make sure the branch exists. List branches with:"
  echo "  ./scripts/supabase-branch list"
  exit 1
fi

if [[ -z "\$POSTGRES_URL" ]]; then
  echo -e "\${RED}Error: No POSTGRES_URL returned for branch '\$BRANCH'\${NC}"
  echo "The branch may still be provisioning. Try again in a minute."
  exit 1
fi

DB_URL="\$POSTGRES_URL"
echo -e "  \${GREEN}✓ Got DATABASE_URL\${NC}"

# Get test branch credentials
TEST_BRANCH="\${BRANCH}-test"
echo "  Fetching \$TEST_BRANCH credentials..."
if eval "\$(supabase branches get "\$TEST_BRANCH" --project-ref "\$PROJECT_REF" -o env 2>/dev/null)"; then
  if [[ -n "\$POSTGRES_URL" ]]; then
    TEST_DB_URL="\$POSTGRES_URL"
    echo -e "  \${GREEN}✓ Got TEST_DATABASE_URL\${NC}"
  else
    echo -e "  \${YELLOW}⚠ No POSTGRES_URL for test branch\${NC}"
    TEST_DB_URL=""
  fi
else
  echo -e "  \${YELLOW}⚠ Test branch '\$TEST_BRANCH' not found\${NC}"
  TEST_DB_URL=""
fi

# Ensure directory exists
mkdir -p "\$(dirname "\$ENV_FILE")"

# Update or create .env.local
echo ""
if [[ -f "\$ENV_FILE" ]]; then
  echo "Updating \$ENV_FILE..."

  # Update DATABASE_URL
  if grep -q "^DATABASE_URL=" "\$ENV_FILE"; then
    # Use a different delimiter for sed since URLs contain slashes
    sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=\\"\$DB_URL\\"|" "\$ENV_FILE"
  else
    echo "DATABASE_URL=\\"\$DB_URL\\"" >> "\$ENV_FILE"
  fi

  # Update TEST_DATABASE_URL if we have one
  if [[ -n "\$TEST_DB_URL" ]]; then
    if grep -q "^TEST_DATABASE_URL=" "\$ENV_FILE"; then
      sed -i '' "s|^TEST_DATABASE_URL=.*|TEST_DATABASE_URL=\\"\$TEST_DB_URL\\"|" "\$ENV_FILE"
    else
      echo "TEST_DATABASE_URL=\\"\$TEST_DB_URL\\"" >> "\$ENV_FILE"
    fi
  fi
else
  echo "Creating \$ENV_FILE..."
  echo "DATABASE_URL=\\"\$DB_URL\\"" > "\$ENV_FILE"
  if [[ -n "\$TEST_DB_URL" ]]; then
    echo "TEST_DATABASE_URL=\\"\$TEST_DB_URL\\"" >> "\$ENV_FILE"
  fi
fi

echo ""
echo -e "\${GREEN}✓ Updated \$ENV_FILE with '\$BRANCH' branch credentials\${NC}"
echo ""
echo "You can now run: pnpm dev"
`;
}
