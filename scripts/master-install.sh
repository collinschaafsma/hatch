#!/usr/bin/env bash
set -euo pipefail

# Hatch Master VM Install Script
# Installs hatch and dependencies on the OpenClaw host machine
# Usage: curl -fsSL https://raw.githubusercontent.com/collinschaafsma/hatch/main/scripts/master-install.sh | bash

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

echo ""
info "Hatch Master VM Install Script"
info "This installs hatch for use with OpenClaw"
echo ""

# Set up user-local npm prefix (for environments without sudo)
mkdir -p ~/.local/bin
npm config set prefix ~/.local 2>/dev/null || true
export PATH="$HOME/.local/bin:$PATH"

# ============================================================================
# Step 1: Check/Install Node.js
# ============================================================================
info "Checking Node.js..."

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ "$NODE_VERSION" -ge 22 ]]; then
        success "Node.js $(node -v) is installed"
    else
        warn "Node.js version is too old (need 22+, have $(node -v))"
        INSTALL_NODE=true
    fi
else
    warn "Node.js is not installed"
    INSTALL_NODE=true
fi

if [[ "${INSTALL_NODE:-false}" == "true" ]]; then
    info "Installing Node.js 22 via NodeSource..."

    if [[ -f /etc/debian_version ]]; then
        curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [[ -f /etc/redhat-release ]]; then
        curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
        sudo yum install -y nodejs
    elif [[ "$(uname)" == "Darwin" ]]; then
        if command -v brew &> /dev/null; then
            brew install node@22
        else
            error "Homebrew is required to install Node.js on macOS. Install from https://brew.sh"
        fi
    else
        error "Unsupported operating system. Please install Node.js 22+ manually."
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
    curl -fsSL https://get.pnpm.io/install.sh | sh -
    export PNPM_HOME="$HOME/.local/share/pnpm"
    export PATH="$PNPM_HOME:$PATH"
    success "pnpm installed: $(pnpm -v)"
fi

# ============================================================================
# Step 3: Check/Install jq
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
# Step 4: Check/Install GitHub CLI
# ============================================================================
info "Checking GitHub CLI..."

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

# ============================================================================
# Step 5: Install Claude Code
# ============================================================================
info "Installing/updating Claude Code..."

# Remove any old npm-based installation
if npm list -g @anthropic-ai/claude-code &>/dev/null 2>&1; then
    info "Removing old npm-based Claude Code installation..."
    npm -g uninstall @anthropic-ai/claude-code 2>/dev/null || true
    rm -f ~/.local/bin/claude 2>/dev/null || true
fi

# Install native version
curl -fsSL https://claude.ai/install.sh | bash
export PATH="$HOME/.claude/local/bin:$PATH"
hash -r 2>/dev/null || true

if command -v claude &> /dev/null; then
    success "Claude Code installed: $(claude --version 2>/dev/null || echo 'version unknown')"
else
    warn "Claude Code installation may have failed - not found in PATH"
fi

# ============================================================================
# Step 6: Clone and build hatch
# ============================================================================
HATCH_DIR="$HOME/.hatch-cli"

info "Installing hatch CLI..."

if [[ -d "$HATCH_DIR" ]]; then
    info "Updating existing hatch installation..."
    cd "$HATCH_DIR"
    git pull
else
    info "Cloning hatch repository..."
    git clone --depth 1 https://github.com/collinschaafsma/hatch.git "$HATCH_DIR"
    cd "$HATCH_DIR"
fi

info "Installing dependencies..."
pnpm install

info "Building hatch..."
pnpm build

success "Hatch CLI built"

# ============================================================================
# Step 7: Set up hatch alias
# ============================================================================
ALIAS_LINE='alias hatch="node ~/.hatch-cli/dist/index.js"'
BASHRC="$HOME/.bashrc"

if [[ -f "$BASHRC" ]] && grep -q "alias hatch=" "$BASHRC"; then
    info "Hatch alias already exists in .bashrc"
else
    echo "" >> "$BASHRC"
    echo "# Hatch CLI" >> "$BASHRC"
    echo "$ALIAS_LINE" >> "$BASHRC"
    success "Hatch alias added to .bashrc"
fi

# Also add PATH entries to bashrc if not present
if ! grep -q 'export PATH="$HOME/.local/bin' "$BASHRC" 2>/dev/null; then
    echo 'export PATH="$HOME/.local/bin:$HOME/.local/share/pnpm:$HOME/.claude/local/bin:$PATH"' >> "$BASHRC"
    success "PATH exports added to .bashrc"
fi

# ============================================================================
# Done
# ============================================================================
echo ""
success "Hatch installation complete!"
echo ""
info "Next steps:"
info "  1. Reload your shell: source ~/.bashrc"
info "  2. Transfer your config from your local machine:"
info "     scp ~/.hatch.json user@this-server:~/.hatch.json"
info "  3. Copy the hatch skill to OpenClaw:"
info "     mkdir -p ~/.openclaw/workspace/skills"
info "     cp -r ~/.hatch-cli/skills/hatch ~/.openclaw/workspace/skills/"
info "  4. Tell your OpenClaw assistant to 'refresh skills'"
echo ""
info "Then you can use hatch commands via OpenClaw!"
echo ""
