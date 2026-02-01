export function generateChecksWorkflow(): string {
	return `name: Checks

on:
  pull_request:
    branches: ["*"]

jobs:
  lint:
    runs-on: ubuntu-latest
    name: lint
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
        id: pnpm-install
        with:
          version: 10.4.1
          run_install: false

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

      - run: pnpm --filter web lint

  typecheck:
    runs-on: ubuntu-latest
    name: typecheck
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
        id: pnpm-install
        with:
          version: 10.4.1
          run_install: false

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

      - run: pnpm --filter web typecheck
`;
}
