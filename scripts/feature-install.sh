#!/usr/bin/env bash
set -euo pipefail

# Hatch Feature VM Install Script
# Usage: curl -fsSL https://raw.githubusercontent.com/collinschaafsma/hatch/main/scripts/feature-install.sh | bash -s -- https://github.com/org/repo --config ~/.hatch.json

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}info${NC} $1"; }
success() { echo -e "${GREEN}success${NC} $1"; }
warn() { echo -e "${YELLOW}warn${NC} $1"; }
error() { echo -e "${RED}error${NC} $1"; exit 1; }

# Parse arguments
GITHUB_URL=""
CONFIG_PATH=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --config)
            CONFIG_PATH="$2"
            shift 2
            ;;
        --config=*)
            CONFIG_PATH="${1#*=}"
            shift
            ;;
        -*)
            shift
            ;;
        *)
            if [[ -z "$GITHUB_URL" ]]; then
                GITHUB_URL="$1"
            fi
            shift
            ;;
    esac
done

if [[ -z "$GITHUB_URL" ]]; then
    error "GitHub URL is required. Usage: feature-install.sh <github-url> [--config <path>]"
fi

# Extract project name from URL (e.g., https://github.com/org/my-app -> my-app)
PROJECT_NAME=$(basename "$GITHUB_URL" .git)

info "Hatch Feature VM Install Script"
info "GitHub URL: $GITHUB_URL"
info "Project: $PROJECT_NAME"
if [[ -n "$CONFIG_PATH" ]]; then
    info "Config: $CONFIG_PATH"
fi
echo ""

# Set up user-local npm prefix (for environments without sudo)
mkdir -p ~/.local/bin
npm config set prefix ~/.local 2>/dev/null || true
export PATH="$HOME/.local/bin:$PATH"

# Check for config file (expand tilde if present)
if [[ -n "$CONFIG_PATH" ]]; then
    CONFIG_PATH="${CONFIG_PATH/#\~/$HOME}"
    if [[ ! -f "$CONFIG_PATH" ]]; then
        error "Config file not found: $CONFIG_PATH"
    fi
fi

# ============================================================================
# Step 1: Check/Install Node.js
# ============================================================================
info "Checking Node.js..."

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ "$NODE_VERSION" -ge 18 ]]; then
        success "Node.js $(node -v) is installed"
    else
        warn "Node.js version is too old (need 18+, have $(node -v))"
        INSTALL_NODE=true
    fi
else
    warn "Node.js is not installed"
    INSTALL_NODE=true
fi

if [[ "${INSTALL_NODE:-false}" == "true" ]]; then
    info "Installing Node.js 22 via NodeSource..."

    # Detect OS
    if [[ -f /etc/debian_version ]]; then
        # Debian/Ubuntu
        curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [[ -f /etc/redhat-release ]]; then
        # RHEL/CentOS/Fedora
        curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
        sudo yum install -y nodejs
    elif [[ "$(uname)" == "Darwin" ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install node@22
        else
            error "Homebrew is required to install Node.js on macOS. Install from https://brew.sh"
        fi
    else
        error "Unsupported operating system. Please install Node.js 18+ manually."
    fi

    success "Node.js installed: $(node -v)"
fi

# ============================================================================
# Step 2: Check/Install pnpm
# ============================================================================
info "Checking pnpm..."

if command -v pnpm &> /dev/null; then
    success "pnpm $(pnpm -v) is installed"
else
    info "Installing pnpm..."
    # Use pnpm's standalone installer (works without sudo)
    curl -fsSL https://get.pnpm.io/install.sh | sh -
    # Source the updated PATH
    export PNPM_HOME="$HOME/.local/share/pnpm"
    export PATH="$PNPM_HOME:$PATH"
    success "pnpm installed: $(pnpm -v)"
fi

# ============================================================================
# Step 3: Check/Install git
# ============================================================================
info "Checking git..."

if command -v git &> /dev/null; then
    success "git $(git --version | cut -d' ' -f3) is installed"
else
    info "Installing git..."

    if [[ -f /etc/debian_version ]]; then
        sudo apt-get install -y git
    elif [[ -f /etc/redhat-release ]]; then
        sudo yum install -y git
    elif [[ "$(uname)" == "Darwin" ]]; then
        xcode-select --install 2>/dev/null || true
    else
        error "Please install git manually"
    fi

    success "git installed"
fi

# ============================================================================
# Step 4: Check/Install jq (for JSON parsing)
# ============================================================================
info "Checking jq..."

if command -v jq &> /dev/null; then
    success "jq is installed"
else
    info "Installing jq..."

    if [[ -f /etc/debian_version ]] && command -v sudo &> /dev/null; then
        sudo apt-get install -y jq
    elif [[ -f /etc/redhat-release ]] && command -v sudo &> /dev/null; then
        sudo yum install -y jq
    elif [[ "$(uname)" == "Darwin" ]] && command -v brew &> /dev/null; then
        brew install jq
    else
        # Download jq binary directly (works without sudo)
        JQ_VERSION="1.7.1"
        mkdir -p ~/.local/bin
        if [[ "$(uname -m)" == "x86_64" ]]; then
            curl -sL "https://github.com/jqlang/jq/releases/download/jq-${JQ_VERSION}/jq-linux-amd64" -o ~/.local/bin/jq
        elif [[ "$(uname -m)" == "aarch64" ]]; then
            curl -sL "https://github.com/jqlang/jq/releases/download/jq-${JQ_VERSION}/jq-linux-arm64" -o ~/.local/bin/jq
        fi
        chmod +x ~/.local/bin/jq 2>/dev/null || true
    fi
    command -v jq &> /dev/null && success "jq installed" || warn "Could not install jq"
fi

# ============================================================================
# Step 4.5: Extract config values (now that jq is available)
# ============================================================================
# Refresh command hash table to find newly installed jq
hash -r 2>/dev/null || true

if [[ -n "$CONFIG_PATH" ]] && command -v jq &> /dev/null; then
    info "Reading config values from $CONFIG_PATH..."

    # Tokens
    GITHUB_TOKEN=$(jq -r '.github.token // empty' "$CONFIG_PATH" 2>/dev/null || true)
    VERCEL_TOKEN=$(jq -r '.vercel.token // empty' "$CONFIG_PATH" 2>/dev/null || true)
    SUPABASE_ACCESS_TOKEN=$(jq -r '.supabase.token // empty' "$CONFIG_PATH" 2>/dev/null || true)

    # Orgs/teams/regions
    HATCH_GITHUB_ORG=$(jq -r '.github.org // empty' "$CONFIG_PATH" 2>/dev/null || true)
    HATCH_VERCEL_TEAM=$(jq -r '.vercel.team // empty' "$CONFIG_PATH" 2>/dev/null || true)
    HATCH_SUPABASE_ORG=$(jq -r '.supabase.org // empty' "$CONFIG_PATH" 2>/dev/null || true)
    HATCH_SUPABASE_REGION=$(jq -r '.supabase.region // empty' "$CONFIG_PATH" 2>/dev/null || true)

    # Git user config (for commits to match GitHub account)
    HATCH_GITHUB_EMAIL=$(jq -r '.github.email // empty' "$CONFIG_PATH" 2>/dev/null || true)
    HATCH_GITHUB_NAME=$(jq -r '.github.name // empty' "$CONFIG_PATH" 2>/dev/null || true)

    # Export for CLI tools
    [[ -n "$GITHUB_TOKEN" ]] && export GITHUB_TOKEN
    [[ -n "$VERCEL_TOKEN" ]] && export VERCEL_TOKEN
    [[ -n "$SUPABASE_ACCESS_TOKEN" ]] && export SUPABASE_ACCESS_TOKEN
    [[ -n "$HATCH_GITHUB_ORG" ]] && export HATCH_GITHUB_ORG
    [[ -n "$HATCH_VERCEL_TEAM" ]] && export HATCH_VERCEL_TEAM
    [[ -n "$HATCH_SUPABASE_ORG" ]] && export HATCH_SUPABASE_ORG
    [[ -n "$HATCH_SUPABASE_REGION" ]] && export HATCH_SUPABASE_REGION

    success "Config values loaded"
else
    warn "Could not read config: CONFIG_PATH=$CONFIG_PATH, jq=$(command -v jq || echo 'not found')"
fi

# ============================================================================
# Step 5: Install CLI tools (gh, vercel, supabase, claude)
# ============================================================================
info "Checking CLI tools..."

# GitHub CLI
if command -v gh &> /dev/null; then
    success "GitHub CLI (gh) is installed"
else
    info "Installing GitHub CLI..."
    if [[ -f /etc/debian_version ]] && command -v sudo &> /dev/null; then
        curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg 2>/dev/null
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
        sudo apt update && sudo apt install gh -y
    elif [[ "$(uname)" == "Darwin" ]] && command -v brew &> /dev/null; then
        brew install gh
    else
        # Download binary directly
        GH_VERSION=$(curl -s https://api.github.com/repos/cli/cli/releases/latest | grep '"tag_name"' | cut -d'"' -f4 | sed 's/v//')
        if [[ -n "$GH_VERSION" ]]; then
            mkdir -p ~/.local/bin
            curl -sL "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz" | tar xz -C /tmp
            mv "/tmp/gh_${GH_VERSION}_linux_amd64/bin/gh" ~/.local/bin/
            export PATH="$HOME/.local/bin:$PATH"
        else
            warn "Could not install GitHub CLI. Install manually if needed."
        fi
    fi
    command -v gh &> /dev/null && success "GitHub CLI installed" || warn "GitHub CLI not installed"
fi

# Vercel CLI
if command -v vercel &> /dev/null; then
    success "Vercel CLI is installed"
else
    info "Installing Vercel CLI..."
    mkdir -p ~/.local/lib ~/.local/bin
    npm install --prefix ~/.local/lib vercel
    cat > ~/.local/bin/vercel << 'WRAPPER'
#!/bin/bash
exec node ~/.local/lib/node_modules/vercel/dist/vc.js "$@"
WRAPPER
    chmod +x ~/.local/bin/vercel
    command -v vercel &> /dev/null && success "Vercel CLI installed" || warn "Vercel CLI installation failed"
fi

# Supabase CLI
if command -v supabase &> /dev/null; then
    success "Supabase CLI is installed"
else
    info "Installing Supabase CLI..."
    mkdir -p ~/.local/lib ~/.local/bin
    npm install --prefix ~/.local/lib supabase
    cat > ~/.local/bin/supabase << 'WRAPPER'
#!/bin/bash
exec ~/.local/lib/node_modules/supabase/bin/supabase "$@"
WRAPPER
    chmod +x ~/.local/bin/supabase
    command -v supabase &> /dev/null && success "Supabase CLI installed" || warn "Supabase CLI installation failed"
fi

# Claude Code
if command -v claude &> /dev/null; then
    # Check if it's an npm installation that needs cleanup
    if npm list -g @anthropic-ai/claude-code &>/dev/null 2>&1; then
        info "Removing npm-based Claude Code installation..."
        npm -g uninstall @anthropic-ai/claude-code 2>/dev/null || true
        rm -f ~/.local/bin/claude 2>/dev/null || true
        info "Installing Claude Code natively..."
        curl -fsSL https://claude.ai/install.sh | bash
        success "Claude Code installed natively"
    else
        success "Claude Code is installed (native)"
    fi
else
    info "Installing Claude Code..."
    curl -fsSL https://claude.ai/install.sh | bash
    success "Claude Code installed"
fi

# Set up Claude Code credentials from config
if [[ -n "$CONFIG_PATH" ]] && command -v jq &> /dev/null; then
    CLAUDE_ACCESS_TOKEN=$(jq -r '.claude.accessToken // empty' "$CONFIG_PATH" 2>/dev/null || true)
    CLAUDE_REFRESH_TOKEN=$(jq -r '.claude.refreshToken // empty' "$CONFIG_PATH" 2>/dev/null || true)
    CLAUDE_EXPIRES_AT=$(jq -r '.claude.expiresAt // empty' "$CONFIG_PATH" 2>/dev/null || true)
    CLAUDE_SCOPES=$(jq -c '.claude.scopes // empty' "$CONFIG_PATH" 2>/dev/null || true)
    CLAUDE_SUBSCRIPTION_TYPE=$(jq -r '.claude.subscriptionType // empty' "$CONFIG_PATH" 2>/dev/null || true)
    CLAUDE_RATE_LIMIT_TIER=$(jq -r '.claude.rateLimitTier // empty' "$CONFIG_PATH" 2>/dev/null || true)

    if [[ -n "${CLAUDE_ACCESS_TOKEN:-}" && -n "${CLAUDE_REFRESH_TOKEN:-}" ]]; then
        info "Setting up Claude Code credentials..."
        mkdir -p ~/.claude
        # Build the credentials JSON, including optional fields if present
        CLAUDE_CREDS="{\"accessToken\":\"$CLAUDE_ACCESS_TOKEN\",\"refreshToken\":\"$CLAUDE_REFRESH_TOKEN\",\"expiresAt\":$CLAUDE_EXPIRES_AT,\"scopes\":$CLAUDE_SCOPES"
        [[ -n "$CLAUDE_SUBSCRIPTION_TYPE" ]] && CLAUDE_CREDS="$CLAUDE_CREDS,\"subscriptionType\":\"$CLAUDE_SUBSCRIPTION_TYPE\""
        [[ -n "$CLAUDE_RATE_LIMIT_TIER" ]] && CLAUDE_CREDS="$CLAUDE_CREDS,\"rateLimitTier\":\"$CLAUDE_RATE_LIMIT_TIER\""
        CLAUDE_CREDS="$CLAUDE_CREDS}"
        echo "{\"claudeAiOauth\":$CLAUDE_CREDS}" | jq '.' > ~/.claude/.credentials.json
        chmod 600 ~/.claude/.credentials.json
        success "Claude Code credentials configured"
    fi
fi

# ============================================================================
# Step 6: Authenticate CLIs (if tokens available)
# ============================================================================
GIT_AUTH_CONFIGURED=false

if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    info "Authenticating GitHub CLI..."
    # Don't suppress errors so we can debug auth issues
    if echo "$GITHUB_TOKEN" | gh auth login --with-token; then
        success "GitHub CLI authenticated"
        # Configure git to use gh as credential helper
        if gh auth setup-git; then
            success "Git configured to use GitHub CLI"
            GIT_AUTH_CONFIGURED=true
        else
            warn "Could not configure git credential helper"
        fi
    else
        warn "GitHub CLI authentication failed - will try direct token auth for git"
    fi

    # Fallback: Configure git to use token directly via credential helper
    if [[ "$GIT_AUTH_CONFIGURED" != "true" ]]; then
        info "Setting up git credential helper with token..."
        git config --global credential.helper store
        # Store credentials for github.com
        mkdir -p ~/.git-credentials 2>/dev/null || true
        echo "https://${GITHUB_TOKEN}:x-oauth-basic@github.com" > ~/.git-credentials
        chmod 600 ~/.git-credentials
        git config --global credential.helper "store --file ~/.git-credentials"
        success "Git credentials configured via token"
        GIT_AUTH_CONFIGURED=true
    fi
fi

# Configure git user (required for commits to match GitHub account)
if [[ -n "${HATCH_GITHUB_EMAIL:-}" ]]; then
    info "Configuring git user email..."
    git config --global user.email "$HATCH_GITHUB_EMAIL"
    success "Git user.email set to $HATCH_GITHUB_EMAIL"
fi

if [[ -n "${HATCH_GITHUB_NAME:-}" ]]; then
    info "Configuring git user name..."
    git config --global user.name "$HATCH_GITHUB_NAME"
    success "Git user.name set to $HATCH_GITHUB_NAME"
fi

# Vercel and Supabase use env vars automatically
if [[ -n "${VERCEL_TOKEN:-}" ]]; then
    info "Vercel CLI will use VERCEL_TOKEN from environment"
fi

if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    info "Supabase CLI will use SUPABASE_ACCESS_TOKEN from environment"
fi

# ============================================================================
# Step 7: Clone the project repo
# ============================================================================
PROJECT_PATH="$HOME/$PROJECT_NAME"

if [[ -d "$PROJECT_PATH" ]]; then
    warn "Project directory already exists at $PROJECT_PATH"
    info "Pulling latest changes..."
    cd "$PROJECT_PATH"
    git pull
else
    info "Cloning repository to $PROJECT_PATH..."
    if ! git clone "$GITHUB_URL" "$PROJECT_PATH"; then
        error "Failed to clone repository: $GITHUB_URL"
        echo ""
        echo "This could be because:"
        echo "  - The repository is private and credentials are not configured"
        echo "  - The repository URL is incorrect"
        echo "  - Network issues"
        echo ""
        echo "GitHub token present: ${GITHUB_TOKEN:+yes}${GITHUB_TOKEN:-no}"
        echo "Git auth configured: $GIT_AUTH_CONFIGURED"
        exit 1
    fi
    cd "$PROJECT_PATH"
fi

# ============================================================================
# Step 8: Install dependencies
# ============================================================================
info "Installing project dependencies..."
pnpm install
success "Dependencies installed"

# ============================================================================
# Step 9: Link Supabase project (if supabase directory exists)
# ============================================================================
if [[ -d "$PROJECT_PATH/supabase" ]] || [[ -f "$PROJECT_PATH/supabase/config.toml" ]]; then
    info "Linking Supabase project..."
    # The supabase link command needs the project ref, which should be in .env or config
    # For now, just verify the CLI is working
    if command -v supabase &> /dev/null; then
        success "Supabase CLI ready (run 'supabase link' manually if needed)"
    fi
fi

echo ""
success "Feature VM setup complete!"
success "Project cloned to: $PROJECT_PATH"
echo ""
info "Next steps:"
info "  cd $PROJECT_PATH"
info "  claude"
