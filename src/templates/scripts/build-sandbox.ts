export function generateBuildSandbox(): string {
	return `#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROJECT_NAME="$(basename "$PROJECT_ROOT")"
IMAGE_NAME="\${PROJECT_NAME}-claude-sandbox"

echo "Building custom Claude sandbox image for project: $PROJECT_NAME"
docker build -t "$IMAGE_NAME" "$SCRIPT_DIR"
echo "Done! Image tagged as: $IMAGE_NAME"
`;
}
