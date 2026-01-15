export function generateWtsScript(useDocker = false): string {
	if (useDocker) {
		return generateDockerWtsScript();
	}
	return generateSupabaseWtsScript();
}

function generateDockerWtsScript(): string {
	return `#!/usr/bin/env bash
set -e

# Load nvm if available
export NVM_DIR="\$HOME/.nvm"
[ -s "\$NVM_DIR/nvm.sh" ] && \\. "\$NVM_DIR/nvm.sh"

if [[ -z "\$1" ]]; then
  echo "Usage: ./scripts/wts <branch-name>"
  exit 1
fi

branch_name="\$1"
original_dir=\$(pwd)
repo_name=\$(basename "\$original_dir")
safe_branch_name="\${branch_name//\\//-}"
worktree_path="../\${repo_name}-\${safe_branch_name}"
sandbox_image="\${repo_name}-claude-sandbox"

# Check if custom sandbox image exists, build if not
if ! docker image inspect "\$sandbox_image" &>/dev/null; then
  echo "Custom sandbox image not found. Building \$sandbox_image..."
  "\$original_dir/scripts/sandbox/build-sandbox"
fi

env_file="apps/web/.env.local"

# Parse DATABASE_URL from .env.local
db_url=\$(grep -E "^DATABASE_URL=" "\$env_file" | cut -d '=' -f2- | tr -d '"')

if [[ -z "\$db_url" ]]; then
  echo "Error: DATABASE_URL not found in \$env_file"
  exit 1
fi

# Parse: postgresql://user:password@host:port/database
db_user=\$(echo "\$db_url" | sed -E 's|postgresql://([^:]+):.*|\\1|')
db_password=\$(echo "\$db_url" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\\1|')
db_host=\$(echo "\$db_url" | sed -E 's|postgresql://[^@]+@([^:]+):.*|\\1|')
source_db_port=\$(echo "\$db_url" | sed -E 's|postgresql://[^@]+@[^:]+:([0-9]+)/.*|\\1|')
db_name=\$(echo "\$db_url" | sed -E 's|postgresql://[^/]+/(.+)|\\1|')

echo "Parsed database config from \$env_file:"
echo "   Name: \$db_name"
echo "   Host: \$db_host"
echo "   Port: \$source_db_port"
echo "   User: \$db_user"
echo ""

# Calculate unique ports
# Start at +10 to avoid main repo's test db (typically at +2)
# Use spacing of 4 ports per worktree (db, db_test, plus buffer)
worktree_count=\$(git worktree list | wc -l)
new_db_port=\$((source_db_port + 10 + (worktree_count * 4)))
new_db_test_port=\$((new_db_port + 2))

compose_project="\${repo_name}-\${safe_branch_name}"

git fetch origin main

if ! git worktree add -b "\$branch_name" "\$worktree_path" origin/main; then
  echo "Failed to create worktree"
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

# Copy sandbox Claude settings (disables dangerous mode, blocks destructive git commands)
if [[ -f ".claude/sandbox.settings.local.json" ]]; then
  mkdir -p "\$worktree_path/.claude"
  cp ".claude/sandbox.settings.local.json" "\$worktree_path/.claude/settings.local.json"
  echo "Copied: sandbox settings -> .claude/settings.local.json"
fi

# Create worktree-specific docker-compose
cat > "\$worktree_path/docker-compose.yml" << EOF
services:
  postgres:
    image: pgvector/pgvector:pg18
    container_name: \${compose_project}-postgres
    environment:
      POSTGRES_USER: \${db_user}
      POSTGRES_PASSWORD: \${db_password}
      POSTGRES_DB: \${db_name}
    ports:
      - '\${new_db_port}:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U \${db_user}']
      interval: 10s
      timeout: 5s
      retries: 5

  postgres-test:
    image: pgvector/pgvector:pg18
    container_name: \${compose_project}-postgres-test
    environment:
      POSTGRES_USER: \${db_user}
      POSTGRES_PASSWORD: \${db_password}
      POSTGRES_DB: \${db_name}_test
    ports:
      - '\${new_db_test_port}:5432'
    volumes:
      - postgres_test_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U \${db_user}']
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  postgres_test_data:
EOF

# Update .env.local in worktree with new DATABASE_URL
worktree_env_file="\$worktree_path/\$env_file"

sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=\\"postgresql://\${db_user}:\${db_password}@localhost:\${new_db_port}/\${db_name}\\"|" "\$worktree_env_file"

# Add or update DATABASE_TEST_URL
if grep -q "^DATABASE_TEST_URL=" "\$worktree_env_file"; then
  sed -i '' "s|DATABASE_TEST_URL=.*|DATABASE_TEST_URL=\\"postgresql://\${db_user}:\${db_password}@localhost:\${new_db_test_port}/\${db_name}_test\\"|" "\$worktree_env_file"
else
  echo "DATABASE_TEST_URL=\\"postgresql://\${db_user}:\${db_password}@localhost:\${new_db_test_port}/\${db_name}_test\\"" >> "\$worktree_env_file"
fi

cd "\$worktree_path"

# Ignore local changes to docker-compose.yml in this worktree
git update-index --assume-unchanged docker-compose.yml

echo "Installing dependencies..."
if command -v nvm &> /dev/null; then
  nvm use 2>/dev/null || true
fi
pnpm i

echo "Starting worktree database containers..."
COMPOSE_PROJECT_NAME="\$compose_project" docker compose up -d

echo "Waiting for postgres to be ready..."
max_attempts=30
attempt=0

until PGPASSWORD="\$db_password" psql -h localhost -p "\$new_db_port" -U "\$db_user" -d postgres -c '\\q' 2>&1; do
  attempt=\$((attempt + 1))
  if [[ \$attempt -ge \$max_attempts ]]; then
    echo "Postgres failed to start after \${max_attempts} seconds"
    echo "Check logs: COMPOSE_PROJECT_NAME=\\"\$compose_project\\" docker compose logs postgres"
    exit 1
  fi
  echo "   Attempt \$attempt/\$max_attempts..."
  sleep 1
done

echo "Postgres is ready!"

echo "Running database migrations..."
cd apps/web && pnpm db:migrate
cd ../..

echo "Copying data from source (port \${source_db_port}) to worktree (port \${new_db_port})..."

PGPASSWORD="\$db_password" pg_dump \\
  -h "\$db_host" \\
  -p "\$source_db_port" \\
  -U "\$db_user" \\
  -d "\$db_name" \\
  --data-only \\
  --disable-triggers \\
  --no-owner \\
  --no-privileges \\
  | PGPASSWORD="\$db_password" psql \\
    -h localhost \\
    -p "\$new_db_port" \\
    -U "\$db_user" \\
    -d "\$db_name" \\
    -q

echo "Database cloned successfully!"

git push -u origin "\$branch_name"

echo ""
echo "Worktree ready!"
echo "   Path:          \$(pwd)"
echo "   Branch:        \$branch_name"
echo "   DB:            \${db_name} on port \${new_db_port}"
echo "   Test DB:       \${db_name}_test on port \${new_db_test_port}"
echo ""
echo "   DATABASE_URL:      postgresql://\${db_user}:\${db_password}@localhost:\${new_db_port}/\${db_name}"
echo "   DATABASE_TEST_URL: postgresql://\${db_user}:\${db_password}@localhost:\${new_db_test_port}/\${db_name}_test"
echo ""

# Launch iTerm2 with 3-pane layout
sandbox_name="\${compose_project}"
worktree_dir="\$(pwd)"

echo "Launching iTerm2 with Claude Code sandbox and dev terminals..."

# Pre-create node_modules volumes with correct ownership (agent user UID=1000)
echo "📦 Creating node_modules volumes with correct ownership..."
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

echo "iTerm2 launched with 3-pane layout"
`;
}

function generateSupabaseWtsScript(): string {
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

if [[ -z "\$1" ]]; then
  echo "Usage: ./scripts/wts <branch-name>"
  exit 1
fi

branch_name="\$1"
original_dir=\$(pwd)
repo_name=\$(basename "\$original_dir")
safe_branch_name="\${branch_name//\\//-}"
worktree_path="../\${repo_name}-\${safe_branch_name}"
sandbox_image="\${repo_name}-claude-sandbox"

# Check if custom sandbox image exists, build if not
if ! docker image inspect "\$sandbox_image" &>/dev/null; then
  echo "Custom sandbox image not found. Building \$sandbox_image..."
  "\$original_dir/scripts/sandbox/build-sandbox"
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

# Copy sandbox Claude settings (disables dangerous mode, blocks destructive git commands)
if [[ -f ".claude/sandbox.settings.local.json" ]]; then
  mkdir -p "\$worktree_path/.claude"
  cp ".claude/sandbox.settings.local.json" "\$worktree_path/.claude/settings.local.json"
  echo "Copied: sandbox settings -> .claude/settings.local.json"
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

echo "Launching iTerm2 with Claude Code sandbox and dev terminals..."

# Pre-create node_modules volumes with correct ownership (agent user UID=1000)
echo "📦 Creating node_modules volumes with correct ownership..."
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

echo "iTerm2 launched with 3-pane layout"
`;
}
