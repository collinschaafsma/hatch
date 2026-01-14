export function generateWtcsScript(useDocker = false): string {
	if (useDocker) {
		return generateDockerWtcsScript();
	}
	return generateSupabaseWtcsScript();
}

function generateDockerWtcsScript(): string {
	return `#!/usr/bin/env bash
set -e

worktree_path=\$(pwd)
git_dir=\$(git rev-parse --git-dir 2>/dev/null)

if [[ ! "\$git_dir" == *".git/worktrees"* ]]; then
  echo "Error: Not in a git worktree"
  exit 1
fi

branch_name=\$(git branch --show-current)
safe_branch_name="\${branch_name//\\//-}"
repo_name=\$(basename "\$(git rev-parse --git-common-dir | sed 's/\\/.git\$//')")
compose_project="\${repo_name}-\${safe_branch_name}"
main_repo=\$(git rev-parse --git-common-dir | sed 's/\\/.git\$//')

echo "This will:"
echo "  - Stop Docker Sandbox for: \$compose_project (if exists)"
echo "  - Stop containers and delete volumes for: \$compose_project"
echo "  - Remove worktree at: \$worktree_path"
echo "  - Delete local branch: \$branch_name"
echo ""
read -p "Are you sure? (y/N) " confirm

if [[ "\$confirm" != [yY] ]]; then
  echo "Aborted"
  exit 0
fi

# Remove Docker Sandbox if it exists (search by name)
# Note: docker sandbox ls doesn't support --format, so we parse the table output
# Format: SANDBOX ID | TEMPLATE | NAME | WORKSPACE | STATUS | CREATED
sandbox_id=\$(docker sandbox ls --no-trunc 2>/dev/null | awk -v name="\$compose_project" '\$3 == name {print \$1}')
if [[ -n "\$sandbox_id" ]]; then
  echo "Removing Docker Sandbox: \$sandbox_id (\$compose_project)"
  docker sandbox rm "\$sandbox_id" 2>/dev/null || true
else
  echo "No Docker Sandbox found with name: \$compose_project"
fi

# Stop containers and remove volumes
COMPOSE_PROJECT_NAME="\$compose_project" docker compose down -v

cd "\$main_repo"
git worktree remove "\$worktree_path" --force
git branch -D "\$branch_name"

cd ..

echo "Cleaned up worktree, sandbox, containers, volumes, and branch '\$branch_name'"
`;
}

function generateSupabaseWtcsScript(): string {
	return `#!/usr/bin/env bash
set -e

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

worktree_path=\$(pwd)
git_dir=\$(git rev-parse --git-dir 2>/dev/null)

if [[ ! "\$git_dir" == *".git/worktrees"* ]]; then
  echo -e "\${RED}Error: Not in a git worktree\${NC}"
  exit 1
fi

branch_name=\$(git branch --show-current)
safe_branch_name="\${branch_name//\\//-}"
repo_name=\$(basename "\$(git rev-parse --git-common-dir | sed 's/\\/.git\$//')")
compose_project="\${repo_name}-\${safe_branch_name}"
main_repo=\$(git rev-parse --git-common-dir | sed 's/\\/.git\$//')

# Supabase branch names
supabase_branch_name="\${safe_branch_name}"
supabase_test_branch="\${safe_branch_name}-test"

# Get Supabase project ref
if [[ -f ".supabase/.project-ref" ]]; then
  PROJECT_REF=\$(cat .supabase/.project-ref)
else
  PROJECT_REF=""
fi

echo ""
echo "This will:"
if [[ -n "\$PROJECT_REF" ]]; then
  echo "  - Delete Supabase branch: \$supabase_branch_name"
  echo "  - Delete Supabase branch: \$supabase_test_branch"
fi
echo "  - Stop Docker Sandbox: \$compose_project (if exists)"
echo "  - Remove worktree at: \$worktree_path"
echo "  - Delete local branch: \$branch_name"
echo ""
read -p "Are you sure? (y/N) " confirm

if [[ "\$confirm" != [yY] ]]; then
  echo "Aborted"
  exit 0
fi

# Delete Supabase branches
if [[ -n "\$PROJECT_REF" ]]; then
  echo ""
  echo "Deleting Supabase branches..."

  echo "  Deleting '\$supabase_branch_name'..."
  if supabase branches delete "\$supabase_branch_name" --project-ref "\$PROJECT_REF" --yes 2>/dev/null; then
    echo -e "  \${GREEN}✓ \$supabase_branch_name deleted\${NC}"
  else
    echo -e "  \${YELLOW}⚠ \$supabase_branch_name may not exist or failed to delete\${NC}"
  fi

  echo "  Deleting '\$supabase_test_branch'..."
  if supabase branches delete "\$supabase_test_branch" --project-ref "\$PROJECT_REF" --yes 2>/dev/null; then
    echo -e "  \${GREEN}✓ \$supabase_test_branch deleted\${NC}"
  else
    echo -e "  \${YELLOW}⚠ \$supabase_test_branch may not exist or failed to delete\${NC}"
  fi
else
  echo -e "\${YELLOW}No Supabase project configured - skipping branch deletion\${NC}"
fi

# Remove Docker Sandbox if it exists (search by name)
# Note: docker sandbox ls doesn't support --format, so we parse the table output
# Format: SANDBOX ID | TEMPLATE | NAME | WORKSPACE | STATUS | CREATED
echo ""
echo "Cleaning up Docker Sandbox..."
sandbox_id=\$(docker sandbox ls --no-trunc 2>/dev/null | awk -v name="\$compose_project" '\$3 == name {print \$1}')
if [[ -n "\$sandbox_id" ]]; then
  echo "  Removing Docker Sandbox: \$sandbox_id (\$compose_project)"
  docker sandbox rm "\$sandbox_id" 2>/dev/null || true
  echo -e "  \${GREEN}✓ Docker Sandbox removed\${NC}"
else
  echo "  No Docker Sandbox found with name: \$compose_project"
fi

# Remove worktree and branch
echo ""
echo "Removing git worktree and branch..."
cd "\$main_repo"
git worktree remove "\$worktree_path" --force
echo -e "  \${GREEN}✓ Worktree removed\${NC}"

git branch -D "\$branch_name"
echo -e "  \${GREEN}✓ Branch deleted\${NC}"

cd ..

echo ""
echo "========================================"
echo -e "\${GREEN}       Cleanup Complete!\${NC}"
echo "========================================"
echo ""
echo "Cleaned up:"
if [[ -n "\$PROJECT_REF" ]]; then
  echo "  - Supabase branches: \$supabase_branch_name, \$supabase_test_branch"
fi
echo "  - Docker Sandbox: \$compose_project"
echo "  - Worktree: \$worktree_path"
echo "  - Branch: \$branch_name"
`;
}
