export function generateTestWorkflow(projectName: string): string {
	return `name: Test

on:
  pull_request:
    branches: ["*"]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: pgvector/pgvector:pg18
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: ${projectName}_test
        ports:
          - 5434:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

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

      - name: Setup test database
        run: cd apps/web && DATABASE_URL=postgresql://postgres:postgres@localhost:5434/${projectName}_test pnpm db:push
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5434/${projectName}_test

      - name: Run tests
        run: pnpm --filter web test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5434/${projectName}_test
          TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5434/${projectName}_test
`;
}
