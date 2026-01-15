export function generateSandboxDockerfile(): string {
	return `FROM docker/sandbox-templates:claude-code

# Clear NPM_CONFIG_PREFIX from base image - it conflicts with nvm
# Setting to empty string effectively unsets it at the image level
ENV NPM_CONFIG_PREFIX=""

# Set proper terminal type for color support
# Note: Shift+Enter doesn't work in Docker sandbox - use \\ + Enter for newlines
ENV TERM=xterm-256color

# Install nvm and Node.js LTS (jod = v22)
ENV NVM_DIR="/home/agent/.nvm"
RUN unset NPM_CONFIG_PREFIX \\
    && curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash \\
    && . "$NVM_DIR/nvm.sh" \\
    && nvm install lts/jod \\
    && nvm alias default lts/jod \\
    && nvm use default

# Enable Corepack and install pnpm
ENV SHELL="/bin/bash"
ENV PNPM_HOME="/home/agent/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN unset NPM_CONFIG_PREFIX \\
    && . "$NVM_DIR/nvm.sh" \\
    && corepack enable \\
    && corepack prepare pnpm@latest --activate \\
    && pnpm setup \\
    && . ~/.bashrc

# Install biome globally for linting (node_modules may be from different platform)
RUN unset NPM_CONFIG_PREFIX \\
    && . "$NVM_DIR/nvm.sh" \\
    && pnpm add -g @biomejs/biome

# Add nvm and pnpm to shell startup
RUN echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.bashrc \\
    && echo '[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"' >> ~/.bashrc \\
    && echo '[ -s "$NVM_DIR/bash_completion" ] && \\. "$NVM_DIR/bash_completion"' >> ~/.bashrc \\
    && echo 'export PNPM_HOME="/home/agent/.local/share/pnpm"' >> ~/.bashrc \\
    && echo 'export PATH="$PNPM_HOME:$PATH"' >> ~/.bashrc

# Run pnpm install on first bash shell (rebuilds binaries for Linux)
# Uses a flag file to ensure it only runs once per container session
RUN echo '' >> ~/.bashrc \\
    && echo '# Auto-run pnpm install once to rebuild binaries for Linux' >> ~/.bashrc \\
    && echo 'if [ ! -f /tmp/.pnpm_installed ] && [ -f "$HOME/project/package.json" ]; then' >> ~/.bashrc \\
    && echo '    echo "Running pnpm install to ensure Linux-compatible binaries..."' >> ~/.bashrc \\
    && echo '    (cd "$HOME/project" && pnpm install --frozen-lockfile 2>/dev/null || pnpm install)' >> ~/.bashrc \\
    && echo '    touch /tmp/.pnpm_installed' >> ~/.bashrc \\
    && echo 'fi' >> ~/.bashrc
`;
}
