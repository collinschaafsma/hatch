export function generateSetupPreviewDeploySkill(): string {
	return `---
name: setup-preview-deploy
description: Guide through setting up Convex preview deploy keys for feature branch isolation. Use when preview deployments need to be configured or when hatch feature/spike commands fail with missing preview deploy key errors.
allowed-tools: Bash(hatch:*), Bash(npx:*), Read, Grep
---

# Convex Preview Deploy Key Setup

## What is a Preview Deploy Key?

A Convex preview deploy key enables automatic preview deployments — isolated Convex backends for each git branch. When \`npx convex deploy\` runs with a preview deploy key, it automatically creates a branch-scoped deployment.

## Setup Steps

### 1. Generate a Preview Deploy Key

1. Go to [https://dashboard.convex.dev](https://dashboard.convex.dev)
2. Select your project
3. Navigate to **Settings** → **Deploy Keys**
4. Click **Generate Preview Deploy Key**
5. Copy the key (starts with \`prod:\` or \`preview:\`)

### 2. Configure Hatch

Run the following command with the key you copied:

\`\`\`bash
hatch set-preview-deploy-key <your-key> --project <project-name>
\`\`\`

This will:
- Save the key to your project record
- Set \`CONVEX_DEPLOY_KEY\` as a Vercel preview environment variable

### 3. Verify

After setting the key, you can create feature VMs:

\`\`\`bash
hatch feature <feature-name> --project <project-name>
\`\`\`

## How It Works

- **Vercel preview builds**: The preview deploy key is set as \`CONVEX_DEPLOY_KEY\` for the preview environment. When Vercel builds a preview deployment, \`npx convex deploy --cmd 'pnpm build'\` uses this key to create a branch-scoped Convex deployment automatically.
- **Feature VMs**: \`hatch feature\` and \`hatch spike\` pull the preview deploy key from Vercel env vars and use it to create a preview deployment on the VM.
- **Cleanup**: Preview deployments are automatically cleaned up by Convex — no manual project deletion needed.

## Troubleshooting

### "Convex preview deploy key not configured" error
Run \`hatch set-preview-deploy-key <key> --project <name>\` to configure it.

### Preview deployment not created
Ensure the key is valid and has the correct permissions. Generate a new key from the Convex dashboard if needed.

## Instructions

1. Ask the user which project they want to configure
2. Guide them through generating a key in the Convex dashboard
3. Help them run the \`hatch set-preview-deploy-key\` command
4. Verify the setup works with a test feature VM if desired
`;
}
