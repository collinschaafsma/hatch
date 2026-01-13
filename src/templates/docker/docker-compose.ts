export function generateDockerCompose(projectName: string): string {
	return `services:
  postgres:
    image: pgvector/pgvector:pg18
    container_name: ${projectName}-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ${projectName}
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 10s
      timeout: 5s
      retries: 5

  postgres-test:
    image: pgvector/pgvector:pg18
    container_name: ${projectName}-postgres-test
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ${projectName}_test
    ports:
      - '5434:5432'
    volumes:
      - postgres_test_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  postgres_test_data:
`;
}
