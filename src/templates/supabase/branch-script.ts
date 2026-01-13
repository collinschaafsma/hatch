export function generateSupabaseBranchScript(): string {
	return `#!/usr/bin/env bash
set -e

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

usage() {
  echo "Supabase Branch Management"
  echo ""
  echo "Usage: ./scripts/supabase-branch <command> <name>"
  echo ""
  echo "Commands:"
  echo "  create <name>  - Create dev and test branches"
  echo "  delete <name>  - Delete dev and test branches"
  echo "  list           - List all branches"
  echo ""
  echo "Examples:"
  echo "  ./scripts/supabase-branch create feature-auth"
  echo "  ./scripts/supabase-branch delete feature-auth"
  echo "  ./scripts/supabase-branch list"
  exit 1
}

# Check for project ref
if [[ ! -f ".supabase/.project-ref" ]]; then
  echo -e "\${RED}Error: Supabase project not configured.\${NC}"
  echo "Run: pnpm supabase:setup"
  exit 1
fi

PROJECT_REF=\$(cat .supabase/.project-ref)

[[ -z "\$1" ]] && usage

case "\$1" in
  create)
    [[ -z "\$2" ]] && usage
    BRANCH_NAME="\$2"
    TEST_BRANCH_NAME="\${2}-test"

    echo "Creating Supabase branches..."
    echo ""

    echo "  Creating '\$BRANCH_NAME' branch..."
    if supabase branches create "\$BRANCH_NAME" --persistent --project-ref "\$PROJECT_REF"; then
      echo -e "  \${GREEN}✓ \$BRANCH_NAME created\${NC}"
    else
      echo -e "  \${RED}✗ Failed to create \$BRANCH_NAME\${NC}"
      exit 1
    fi

    echo "  Creating '\$TEST_BRANCH_NAME' branch..."
    if supabase branches create "\$TEST_BRANCH_NAME" --persistent --project-ref "\$PROJECT_REF"; then
      echo -e "  \${GREEN}✓ \$TEST_BRANCH_NAME created\${NC}"
    else
      echo -e "  \${RED}✗ Failed to create \$TEST_BRANCH_NAME\${NC}"
      # Clean up the first branch
      supabase branches delete "\$BRANCH_NAME" --project-ref "\$PROJECT_REF" --confirm 2>/dev/null || true
      exit 1
    fi

    echo ""
    echo "Waiting for branches to be provisioned..."
    sleep 15

    echo ""
    echo "Applying migrations..."

    # Apply migrations to main branch
    echo "  Pushing to \$BRANCH_NAME..."
    eval "\$(supabase branches get "\$BRANCH_NAME" --project-ref "\$PROJECT_REF" -o env 2>/dev/null)" || true
    if [[ -n "\$POSTGRES_URL" ]]; then
      DATABASE_URL="\$POSTGRES_URL" pnpm --filter web db:push 2>/dev/null && echo -e "  \${GREEN}✓ Migrations applied\${NC}" || echo -e "  \${YELLOW}⚠ Migration failed\${NC}"
    fi

    # Apply migrations to test branch
    echo "  Pushing to \$TEST_BRANCH_NAME..."
    eval "\$(supabase branches get "\$TEST_BRANCH_NAME" --project-ref "\$PROJECT_REF" -o env 2>/dev/null)" || true
    if [[ -n "\$POSTGRES_URL" ]]; then
      DATABASE_URL="\$POSTGRES_URL" pnpm --filter web db:push 2>/dev/null && echo -e "  \${GREEN}✓ Migrations applied\${NC}" || echo -e "  \${YELLOW}⚠ Migration failed\${NC}"
    fi

    echo ""
    echo -e "\${GREEN}Branches created successfully!\${NC}"
    echo ""
    echo "To use these branches, run:"
    echo "  ./scripts/supabase-env \$BRANCH_NAME"
    ;;

  delete)
    [[ -z "\$2" ]] && usage
    BRANCH_NAME="\$2"
    TEST_BRANCH_NAME="\${2}-test"

    echo "Deleting Supabase branches..."
    echo ""

    echo "  Deleting '\$BRANCH_NAME'..."
    if supabase branches delete "\$BRANCH_NAME" --project-ref "\$PROJECT_REF" --confirm 2>/dev/null; then
      echo -e "  \${GREEN}✓ \$BRANCH_NAME deleted\${NC}"
    else
      echo -e "  \${YELLOW}⚠ \$BRANCH_NAME may not exist or failed to delete\${NC}"
    fi

    echo "  Deleting '\$TEST_BRANCH_NAME'..."
    if supabase branches delete "\$TEST_BRANCH_NAME" --project-ref "\$PROJECT_REF" --confirm 2>/dev/null; then
      echo -e "  \${GREEN}✓ \$TEST_BRANCH_NAME deleted\${NC}"
    else
      echo -e "  \${YELLOW}⚠ \$TEST_BRANCH_NAME may not exist or failed to delete\${NC}"
    fi

    echo ""
    echo -e "\${GREEN}Branch cleanup complete!\${NC}"
    ;;

  list)
    echo "Supabase branches for project: \$PROJECT_REF"
    echo ""
    supabase branches list --project-ref "\$PROJECT_REF"
    ;;

  *)
    usage
    ;;
esac
`;
}
