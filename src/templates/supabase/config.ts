export function generateSupabaseConfig(): string {
	return `# Supabase configuration
# See: https://supabase.com/docs/guides/cli/config

[api]
enabled = true
port = 54321
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = 54322
shadow_port = 54320
major_version = 15

[db.pooler]
enabled = true
port = 54329
pool_mode = "session"
default_pool_size = 20
max_client_conn = 100

[db.seed]
enabled = true
sql_paths = ["./seed.sql"]

[studio]
enabled = true
port = 54323
api_url = "http://127.0.0.1"

[auth]
enabled = true
site_url = "http://127.0.0.1:3000"

[storage]
enabled = true
file_size_limit = "50MiB"

# Enable pgvector extension for vector operations
# Extension is available in Supabase by default
`;
}
