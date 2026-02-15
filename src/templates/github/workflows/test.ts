export function generateTestWorkflow(projectName: string): string {
	return `name: Test

on:
  pull_request:
    branches: ["*"]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        name: Install pnpm
        id: pnpm-install

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install

      - name: Run tests
        run: pnpm --filter web test
`;
}
