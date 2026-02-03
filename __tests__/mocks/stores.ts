import type { ProjectRecord, VMRecord } from "../../src/types/index.js";

export function createMockProjectRecord(
	overrides: Partial<ProjectRecord> = {},
): ProjectRecord {
	return {
		name: "test-project",
		createdAt: new Date().toISOString(),
		github: {
			url: "https://github.com/test/test-project",
			owner: "test",
			repo: "test-project",
		},
		vercel: {
			url: "https://test-project.vercel.app",
			projectId: "prj_123456789",
		},
		supabase: {
			projectRef: "abc123def456",
			region: "us-east-1",
		},
		...overrides,
	};
}

export function createMockVMRecord(
	overrides: Partial<VMRecord> = {},
): VMRecord {
	return {
		name: "fortune-sprite",
		sshHost: "fortune-sprite.exe.xyz",
		project: "test-project",
		feature: "add-auth",
		createdAt: new Date().toISOString(),
		supabaseBranches: ["add-auth", "add-auth-test"],
		githubBranch: "add-auth",
		...overrides,
	};
}
