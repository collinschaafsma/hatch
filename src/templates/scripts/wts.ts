export function generateWtsScript(): string {
	return `#!/usr/bin/env bash
set -e

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

# Load nvm if available
export NVM_DIR="\$HOME/.nvm"
[ -s "\$NVM_DIR/nvm.sh" ] && \\. "\$NVM_DIR/nvm.sh"

# Parse arguments
sandbox_mode=false
branch_name=""
while [[ \$# -gt 0 ]]; do
  case \$1 in
    --sandbox) sandbox_mode=true; shift ;;
    *) branch_name="\$1"; shift ;;
  esac
done

if [[ -z "\$branch_name" ]]; then
  echo "Usage: ./scripts/wts [--sandbox] <branch-name>"
  exit 1
fi
original_dir=\$(pwd)
repo_name=\$(basename "\$original_dir")
safe_branch_name="\${branch_name//\\//-}"
worktree_path="../\${repo_name}-\${safe_branch_name}"
sandbox_image="\${repo_name}-claude-sandbox"

# Check if custom sandbox image exists, build if not (only for sandbox mode)
if [[ "\$sandbox_mode" == "true" ]]; then
  if ! docker image inspect "\$sandbox_image" &>/dev/null; then
    echo "Custom sandbox image not found. Building \$sandbox_image..."
    "\$original_dir/scripts/sandbox/build-sandbox"
  fi
fi

# Check for Supabase project configuration
if [[ ! -f ".supabase/.project-ref" ]]; then
  echo -e "\${RED}Error: Supabase project not configured.\${NC}"
  echo "Run: pnpm supabase:setup"
  exit 1
fi

PROJECT_REF=\$(cat .supabase/.project-ref)
env_file="apps/web/.env.local"

# Supabase branch names
supabase_branch_name="\${safe_branch_name}"
supabase_test_branch="\${safe_branch_name}-test"

echo ""
echo "Creating worktree sandbox: \$branch_name"
echo "  Supabase branches: \$supabase_branch_name, \$supabase_test_branch"
echo ""

git fetch origin main

if ! git worktree add -b "\$branch_name" "\$worktree_path" origin/main; then
  echo -e "\${RED}Failed to create worktree\${NC}"
  exit 1
fi

# Copy .worktreeinclude files
if [[ -f ".worktreeinclude" ]]; then
  while IFS= read -r file || [[ -n "\$file" ]]; do
    [[ -z "\$file" || "\$file" =~ ^# ]] && continue
    file="\${file%/}"
    if [[ -e "\$file" ]]; then
      mkdir -p "\$worktree_path/\$(dirname "\$file")"
      cp -r "\$file" "\$worktree_path/\$file"
      echo "Copied: \$file"
    fi
  done < ".worktreeinclude"
fi

# Copy Claude settings for non-sandbox mode (disables dangerous mode, blocks destructive git commands)
# In sandbox mode, Claude runs in dangerous mode since the Docker sandbox provides isolation
if [[ "\$sandbox_mode" != "true" ]] && [[ -f ".claude/sandbox.settings.local.json" ]]; then
  mkdir -p "\$worktree_path/.claude"
  cp ".claude/sandbox.settings.local.json" "\$worktree_path/.claude/settings.local.json"
  echo "Copied: Claude settings -> .claude/settings.local.json"
fi

# Copy Supabase project reference
mkdir -p "\$worktree_path/.supabase"
cp ".supabase/.project-ref" "\$worktree_path/.supabase/.project-ref"
echo "Copied: Supabase project reference"

cd "\$worktree_path"

echo ""
echo "Creating Supabase branches..."

# Create main dev branch
echo "  Creating '\$supabase_branch_name' branch..."
if supabase branches create "\$supabase_branch_name" --persistent --project-ref "\$PROJECT_REF" 2>/dev/null; then
  echo -e "  \${GREEN}✓ \$supabase_branch_name created\${NC}"
else
  echo -e "  \${YELLOW}⚠ Branch may already exist or creation failed\${NC}"
fi

# Create test branch
echo "  Creating '\$supabase_test_branch' branch..."
if supabase branches create "\$supabase_test_branch" --persistent --project-ref "\$PROJECT_REF" 2>/dev/null; then
  echo -e "  \${GREEN}✓ \$supabase_test_branch created\${NC}"
else
  echo -e "  \${YELLOW}⚠ Branch may already exist or creation failed\${NC}"
fi

echo ""
echo "Waiting for branches to be provisioned (this may take 30-60 seconds)..."

# Poll for branch readiness with retries
max_attempts=12
attempt=0
branches_ready=false

while [[ \$attempt -lt \$max_attempts ]]; do
  attempt=\$((attempt + 1))
  echo "  Checking branch status (attempt \$attempt/\$max_attempts)..."

  # Try to get credentials
  if eval "\$(supabase branches get "\$supabase_branch_name" --project-ref "\$PROJECT_REF" -o env 2>/dev/null)"; then
    if [[ -n "\$POSTGRES_URL" ]]; then
      branches_ready=true
      break
    fi
  fi

  sleep 10
done

if [[ "\$branches_ready" != "true" ]]; then
  echo -e "\${YELLOW}Warning: Could not verify branch readiness. Continuing anyway...\${NC}"
fi

echo ""
echo "Installing dependencies..."
if command -v nvm &> /dev/null; then
  nvm use 2>/dev/null || true
fi
pnpm i

# Fetch credentials and update .env.local
echo ""
echo "Fetching branch credentials..."

# Get main branch URL
eval "\$(supabase branches get "\$supabase_branch_name" --project-ref "\$PROJECT_REF" -o env 2>/dev/null)" || true
new_db_url="\$POSTGRES_URL"

# Get test branch URL
eval "\$(supabase branches get "\$supabase_test_branch" --project-ref "\$PROJECT_REF" -o env 2>/dev/null)" || true
new_test_db_url="\$POSTGRES_URL"

# Update .env.local
worktree_env_file="\$env_file"

if [[ -n "\$new_db_url" ]]; then
  if [[ -f "\$worktree_env_file" ]]; then
    if grep -q "^DATABASE_URL=" "\$worktree_env_file"; then
      sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=\\"\$new_db_url\\"|" "\$worktree_env_file"
    else
      echo "DATABASE_URL=\\"\$new_db_url\\"" >> "\$worktree_env_file"
    fi
  else
    mkdir -p "\$(dirname "\$worktree_env_file")"
    echo "DATABASE_URL=\\"\$new_db_url\\"" > "\$worktree_env_file"
  fi
  echo -e "  \${GREEN}✓ DATABASE_URL configured\${NC}"
else
  echo -e "  \${YELLOW}⚠ Could not get DATABASE_URL - branch may still be provisioning\${NC}"
fi

if [[ -n "\$new_test_db_url" ]]; then
  if grep -q "^TEST_DATABASE_URL=" "\$worktree_env_file" 2>/dev/null; then
    sed -i '' "s|^TEST_DATABASE_URL=.*|TEST_DATABASE_URL=\\"\$new_test_db_url\\"|" "\$worktree_env_file"
  else
    echo "TEST_DATABASE_URL=\\"\$new_test_db_url\\"" >> "\$worktree_env_file"
  fi
  echo -e "  \${GREEN}✓ TEST_DATABASE_URL configured\${NC}"
else
  echo -e "  \${YELLOW}⚠ Could not get TEST_DATABASE_URL - branch may still be provisioning\${NC}"
fi

# Apply migrations to branches
echo ""
echo "Applying migrations to branches..."

if [[ -n "\$new_db_url" ]]; then
  echo "  Pushing to \$supabase_branch_name..."
  cd apps/web
  DATABASE_URL="\$new_db_url" pnpm db:push 2>/dev/null && echo -e "  \${GREEN}✓ Migrations applied\${NC}" || echo -e "  \${YELLOW}⚠ Migration push failed\${NC}"
  cd ../..
fi

if [[ -n "\$new_test_db_url" ]]; then
  echo "  Pushing to \$supabase_test_branch..."
  cd apps/web
  DATABASE_URL="\$new_test_db_url" pnpm db:push 2>/dev/null && echo -e "  \${GREEN}✓ Migrations applied\${NC}" || echo -e "  \${YELLOW}⚠ Migration push failed\${NC}"
  cd ../..
fi

# Push branch to remote
git push -u origin "\$branch_name"

echo ""
echo "========================================"
echo -e "\${GREEN}       Worktree Ready!\${NC}"
echo "========================================"
echo ""
echo "   Path:           \$(pwd)"
echo "   Branch:         \$branch_name"
echo "   Supabase Dev:   \$supabase_branch_name"
echo "   Supabase Test:  \$supabase_test_branch"
echo ""

# Launch iTerm2 with 3-pane layout
compose_project="\${repo_name}-\${safe_branch_name}"
sandbox_name="\${compose_project}"
worktree_dir="\$(pwd)"

if [[ "\$sandbox_mode" == "true" ]]; then
  echo "Launching iTerm2 with Claude Code sandbox and dev terminals..."

  # Pre-create node_modules and turbo volumes with correct ownership (agent user UID=1000)
  echo "📦 Creating node_modules and turbo volumes with correct ownership..."
  docker volume create "\${sandbox_name}_node_modules" >/dev/null 2>&1 || true
  docker volume create "\${sandbox_name}_web_node_modules" >/dev/null 2>&1 || true
  docker volume create "\${sandbox_name}_ui_node_modules" >/dev/null 2>&1 || true
  docker run --rm \\
    -v "\${sandbox_name}_node_modules:/mnt/root" \\
    -v "\${sandbox_name}_web_node_modules:/mnt/web" \\
    -v "\${sandbox_name}_ui_node_modules:/mnt/ui" \\
    alpine chown -R 1000:1000 /mnt/root /mnt/web /mnt/ui

  osascript <<APPLESCRIPT
tell application "iTerm2"
    create window with default profile
    tell current window
        tell current session
            set name to "Claude Sandbox"
            write text "cd '\$worktree_dir' && docker sandbox run --template '\$sandbox_image' --name '\$sandbox_name' --mount-docker-socket -v '\$HOME/.claude:/home/agent/.claude' -v '\$original_dir/.git:\$original_dir/.git' -v '\${sandbox_name}_node_modules:\$worktree_dir/node_modules' -v '\${sandbox_name}_web_node_modules:\$worktree_dir/apps/web/node_modules' -v '\${sandbox_name}_ui_node_modules:\$worktree_dir/packages/ui/node_modules' -w '\$worktree_dir' claude"

            -- Split vertically to create right pane
            set rightPane to (split vertically with default profile)
            tell rightPane
                set name to "Dev Terminal"
                write text "cd '\$worktree_dir' && nvm use 2>/dev/null; echo 'Dev terminal ready'"

                -- Split horizontally to create bottom-right pane
                set bottomPane to (split horizontally with default profile)
                tell bottomPane
                    set name to "Terminal 2"
                    write text "cd '\$worktree_dir' && nvm use 2>/dev/null; echo 'Terminal 2 ready'"
                end tell
            end tell
        end tell
    end tell
end tell
APPLESCRIPT

  echo "iTerm2 launched with 3-pane layout (sandbox mode)"
else
  echo "Launching iTerm2 with Claude Code and dev terminals..."

  osascript <<APPLESCRIPT
tell application "iTerm2"
    create window with default profile
    tell current window
        tell current session
            set name to "Claude"
            write text "cd '\$worktree_dir' && claude"

            -- Split vertically to create right pane
            set rightPane to (split vertically with default profile)
            tell rightPane
                set name to "Dev Terminal"
                write text "cd '\$worktree_dir' && nvm use 2>/dev/null; echo 'Dev terminal ready'"

                -- Split horizontally to create bottom-right pane
                set bottomPane to (split horizontally with default profile)
                tell bottomPane
                    set name to "Terminal 2"
                    write text "cd '\$worktree_dir' && nvm use 2>/dev/null; echo 'Terminal 2 ready'"
                end tell
            end tell
        end tell
    end tell
end tell
APPLESCRIPT

  echo "iTerm2 launched with 3-pane layout"
fi
`;
}
