export function generateTestMocks(): string {
	return `import { vi } from "vitest";

export function createFetchMock(responses: Record<string, unknown> = {}) {
	return vi.fn((url: string) => {
		const response = responses[url] || { ok: true, data: {} };

		// Create a mock readable stream body for SSE endpoints
		const mockBody = {
			getReader: () => ({
				read: () => Promise.resolve({ done: true, value: undefined }),
			}),
		};

		return Promise.resolve({
			ok: true,
			json: () => Promise.resolve(response),
			text: () => Promise.resolve(JSON.stringify(response)),
			body: mockBody,
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
