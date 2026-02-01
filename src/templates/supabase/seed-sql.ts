export function generateSupabaseSeedSql(useWorkOS: boolean): string {
	if (useWorkOS) {
		return `-- Seed data for development and testing (WorkOS schema)
-- This file is applied when branches are created

-- Insert test user
INSERT INTO users (id, workos_id, email, first_name, last_name, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'user_test_123',
  'test@example.com',
  'Test',
  'User',
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Insert test organization
INSERT INTO organizations (id, workos_id, name, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'org_test_123',
  'Test Organization',
  NOW(),
  NOW()
) ON CONFLICT (workos_id) DO NOTHING;

-- Link user to organization
INSERT INTO organization_memberships (id, user_id, organization_id, role, status, created_at)
SELECT
  gen_random_uuid(),
  u.id,
  o.id,
  'admin',
  'active',
  NOW()
FROM users u, organizations o
WHERE u.email = 'test@example.com'
  AND o.workos_id = 'org_test_123'
ON CONFLICT DO NOTHING;
`;
	}

	return `-- Seed data for development and testing (Better Auth schema)
-- This file is applied when branches are created

-- Insert test user
INSERT INTO "user" (id, email, name, created_at, updated_at)
VALUES (
  'test-user-id-123',
  'test@example.com',
  'Test User',
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Insert test session (expires in 30 days)
INSERT INTO session (id, user_id, expires_at, created_at, updated_at)
SELECT
  'test-session-id-123',
  id,
  NOW() + INTERVAL '30 days',
  NOW(),
  NOW()
FROM "user"
WHERE email = 'test@example.com'
ON CONFLICT (id) DO NOTHING;
`;
}
