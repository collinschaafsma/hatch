export function generateSandboxDockerfile(): string {
	return `FROM docker/sandbox-templates:claude-code

# Clear NPM_CONFIG_PREFIX from base image - it conflicts with nvm
# Setting to empty string effectively unsets it at the image level
ENV NPM_CONFIG_PREFIX=""

# Set proper terminal type for color support
# Note: Shift+Enter doesn't work in Docker sandbox - use \\ + Enter for newlines
ENV TERM=xterm-256color

# Use relative cache dir to avoid absolute path issues across worktrees
ENV TURBO_CACHE_DIR=".turbo/cache"

# Install nvm and Node.js LTS (jod = v22)
ENV NVM_DIR="/home/agent/.nvm"
RUN unset NPM_CONFIG_PREFIX \\
    && curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash \\
    && . "$NVM_DIR/nvm.sh" \\
    && nvm install lts/jod \\
    && nvm alias default lts/jod \\
    && nvm use default

# Enable Corepack and install pnpm
RUN unset NPM_CONFIG_PREFIX \\
    && . "$NVM_DIR/nvm.sh" \\
    && corepack enable \\
    && corepack prepare pnpm@latest --activate

# Add nvm to shell startup
RUN echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.bashrc \\
    && echo '[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"' >> ~/.bashrc \\
    && echo '[ -s "$NVM_DIR/bash_completion" ] && \\. "$NVM_DIR/bash_completion"' >> ~/.bashrc
`;
}
