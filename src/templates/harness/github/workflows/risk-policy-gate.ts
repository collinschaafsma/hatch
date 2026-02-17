export function generateRiskPolicyGateWorkflow(): string {
	return `name: Risk Policy Gate

on:
  pull_request:
    branches: ["*"]

jobs:
  risk-tier:
    name: Compute risk tier
    runs-on: ubuntu-latest
    outputs:
      tier: \${{ steps.compute.outputs.tier }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Install Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - uses: pnpm/action-setup@v4
        name: Install pnpm

      - name: Get pnpm cache directory
        id: pnpm-cache
        run: |
          echo "pnpm_cache_dir=$(pnpm store path)" >> $GITHUB_OUTPUT

      - uses: actions/cache@v4
        name: Setup pnpm cache
        with:
          path: \${{ steps.pnpm-cache.outputs.pnpm_cache_dir }}
          key: \${{ runner.os }}-pnpm-store-\${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            \${{ runner.os }}-pnpm-store-

      - name: Install dependencies
        run: pnpm install

      - name: Compute risk tier
        id: compute
        run: |
          RESULT=$(node scripts/harness/risk-tier.mjs --json)
          echo "tier=$(echo $RESULT | jq -r '.tier')" >> $GITHUB_OUTPUT
          echo "### Risk Tier: $(echo $RESULT | jq -r '.tier')" >> $GITHUB_STEP_SUMMARY

  docs-drift:
    name: Check docs drift
    needs: risk-tier
    if: needs.risk-tier.outputs.tier == 'high' || needs.risk-tier.outputs.tier == 'medium'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Install Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - uses: pnpm/action-setup@v4
        name: Install pnpm

      - name: Get pnpm cache directory
        id: pnpm-cache
        run: |
          echo "pnpm_cache_dir=$(pnpm store path)" >> $GITHUB_OUTPUT

      - uses: actions/cache@v4
        name: Setup pnpm cache
        with:
          path: \${{ steps.pnpm-cache.outputs.pnpm_cache_dir }}
          key: \${{ runner.os }}-pnpm-store-\${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            \${{ runner.os }}-pnpm-store-

      - name: Install dependencies
        run: pnpm install

      - name: Check docs drift
        run: node scripts/harness/docs-drift-check.mjs

  gate:
    name: Policy gate
    needs: [risk-tier, docs-drift]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Report
        run: |
          echo "Risk tier: \${{ needs.risk-tier.outputs.tier }}"
          echo "Gate: informational (not blocking)"
`;
}
