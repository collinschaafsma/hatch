#!/usr/bin/env bash
set -euo pipefail

# Hatch Bootstrap Script
# Usage: curl -fsSL https://raw.githubusercontent.com/collinschaafsma/hatch/main/scripts/install.sh | bash -s -- my-app --config ~/hatch.json

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
PROJECT_NAME=""
CONFIG_PATH=""
EXTRA_ARGS=""

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
            EXTRA_ARGS="$EXTRA_ARGS $1"
            shift
            ;;
        *)
            if [[ -z "$PROJECT_NAME" ]]; then
                PROJECT_NAME="$1"
            else
                EXTRA_ARGS="$EXTRA_ARGS $1"
            fi
            shift
            ;;
    esac
done

if [[ -z "$PROJECT_NAME" ]]; then
    error "Project name is required. Usage: install.sh <project-name> [--config <path>]"
fi

info "Hatch Bootstrap Script"
info "Project: $PROJECT_NAME"
if [[ -n "$CONFIG_PATH" ]]; then
    info "Config: $CONFIG_PATH"
fi
echo ""

# Ensure ~/.local/bin is in PATH for user-local installs
export PATH="$HOME/.local/bin:$PATH"

# Check for config file
if [[ -n "$CONFIG_PATH" ]]; then
    if [[ ! -f "$CONFIG_PATH" ]]; then
        error "Config file not found: $CONFIG_PATH"
    fi

    # Extract tokens from config file for CLI authentication
    if command -v jq &> /dev/null; then
        GITHUB_TOKEN=$(jq -r '.github.token // empty' "$CONFIG_PATH" 2>/dev/null || true)
        VERCEL_TOKEN=$(jq -r '.vercel.token // empty' "$CONFIG_PATH" 2>/dev/null || true)
        SUPABASE_ACCESS_TOKEN=$(jq -r '.supabase.token // empty' "$CONFIG_PATH" 2>/dev/null || true)

        # Export tokens for CLI tools
        [[ -n "$GITHUB_TOKEN" ]] && export GITHUB_TOKEN
        [[ -n "$VERCEL_TOKEN" ]] && export VERCEL_TOKEN
        [[ -n "$SUPABASE_ACCESS_TOKEN" ]] && export SUPABASE_ACCESS_TOKEN
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
    # Try corepack first (built into Node.js 16+), then fall back to npm
    if command -v corepack &> /dev/null; then
        corepack enable pnpm 2>/dev/null || npm install -g pnpm 2>/dev/null || {
            # If global install fails, use user-local prefix
            npm config set prefix ~/.local
            export PATH="$HOME/.local/bin:$PATH"
            npm install -g pnpm
        }
    else
        npm install -g pnpm 2>/dev/null || {
            npm config set prefix ~/.local
            export PATH="$HOME/.local/bin:$PATH"
            npm install -g pnpm
        }
    fi
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

    if [[ -f /etc/debian_version ]]; then
        sudo apt-get install -y jq
    elif [[ -f /etc/redhat-release ]]; then
        sudo yum install -y jq
    elif [[ "$(uname)" == "Darwin" ]]; then
        brew install jq
    else
        warn "Could not install jq. Continuing without it."
    fi
fi

# ============================================================================
# Step 5: Install CLI tools (gh, vercel, supabase, claude)
# ============================================================================
info "Checking CLI tools..."

# Helper function for npm global install with fallback to user-local
npm_install_global() {
    local package="$1"
    npm install -g "$package" 2>/dev/null || {
        # If global fails, ensure user-local prefix is set
        npm config set prefix ~/.local 2>/dev/null || true
        export PATH="$HOME/.local/bin:$PATH"
        npm install -g "$package"
    }
}

# GitHub CLI
if command -v gh &> /dev/null; then
    success "GitHub CLI (gh) is installed"
else
    info "Installing GitHub CLI..."
    # gh is not available via npm, use official install methods
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
    npm_install_global vercel
    success "Vercel CLI installed"
fi

# Supabase CLI
if command -v supabase &> /dev/null; then
    success "Supabase CLI is installed"
else
    info "Installing Supabase CLI..."
    npm_install_global supabase
    success "Supabase CLI installed"
fi

# Claude Code CLI
info "Checking Claude Code CLI..."

if command -v claude &> /dev/null; then
    success "Claude Code CLI is installed"
else
    info "Installing Claude Code CLI..."
    npm_install_global @anthropic-ai/claude-code
    success "Claude Code CLI installed"
fi

# ============================================================================
# Step 6: Authenticate CLIs (if tokens available)
# ============================================================================
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    info "Authenticating GitHub CLI..."
    echo "$GITHUB_TOKEN" | gh auth login --with-token 2>/dev/null && success "GitHub CLI authenticated" || warn "GitHub CLI authentication failed"
fi

# Vercel and Supabase use env vars automatically, just verify
if [[ -n "${VERCEL_TOKEN:-}" ]]; then
    info "Vercel CLI will use VERCEL_TOKEN from environment"
fi

if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    info "Supabase CLI will use SUPABASE_ACCESS_TOKEN from environment"
fi

# ============================================================================
# Step 7: Clone and build Hatch
# ============================================================================
HATCH_DIR="$HOME/hatch"

if [[ -d "$HATCH_DIR" ]]; then
    info "Hatch already cloned at $HATCH_DIR, pulling latest..."
    cd "$HATCH_DIR"
    git pull
else
    info "Cloning Hatch repository to $HATCH_DIR..."
    git clone --depth 1 https://github.com/collinschaafsma/hatch.git "$HATCH_DIR"
    cd "$HATCH_DIR"
fi

info "Installing Hatch dependencies..."
pnpm install

info "Building Hatch..."
pnpm build

# ============================================================================
# Step 8: Run Hatch in headless mode
# ============================================================================
echo ""
PROJECT_PATH="$HOME/$PROJECT_NAME"
info "Creating project: $PROJECT_PATH"
echo ""

# Build the command - use absolute path for project so it's created in home directory
HATCH_CMD="pnpm dev create $PROJECT_PATH --headless --bootstrap"

if [[ -n "$CONFIG_PATH" ]]; then
    # Use absolute path for config
    if [[ "$CONFIG_PATH" != /* ]]; then
        CONFIG_PATH="$(cd "$(dirname "$CONFIG_PATH")" && pwd)/$(basename "$CONFIG_PATH")"
    fi
    HATCH_CMD="$HATCH_CMD --config $CONFIG_PATH"
fi

# Add any extra arguments
HATCH_CMD="$HATCH_CMD $EXTRA_ARGS"

# Run Hatch (stay in hatch dir so pnpm dev works)
eval "$HATCH_CMD"

echo ""
success "Bootstrap complete!"
success "Project created at: $PROJECT_PATH"
success "Hatch CLI available at: $HATCH_DIR"
