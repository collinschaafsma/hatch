export function generateTestMocks(): string {
	return `import { vi } from "vitest";

export function createFetchMock(responses: Record<string, unknown> = {}) {
	return vi.fn((url: string) => {
		const response = responses[url] || { ok: true, data: {} };
		return Promise.resolve({
			ok: true,
			json: () => Promise.resolve(response),
			text: () => Promise.resolve(JSON.stringify(response)),
			...response,
		});
	});
}

export function mockFetch(responses: Record<string, unknown> = {}) {
	const mock = createFetchMock(responses);
	global.fetch = mock as unknown as typeof fetch;
	return mock;
}

export function resetFetchMock() {
	vi.restoreAllMocks();
}
`;
}
