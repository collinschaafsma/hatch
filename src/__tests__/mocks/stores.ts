import type { ProjectRecord, VMRecord } from "../../types/index.js";

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
		convex: {
			projectSlug: "test-project",
			deploymentUrl: "https://test-project.convex.cloud",
			deployKey: "dk_test123",
			deploymentName: "happy-animal-456",
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
		githubBranch: "add-auth",
		convexFeatureProject: {
			projectId: "proj_default",
			projectSlug: "test-project-add-auth",
			deploymentName: "happy-animal-123",
			deploymentUrl: "https://test-project-add-auth.convex.cloud",
			deployKey: "dk_default",
		},
		...overrides,
	};
}
