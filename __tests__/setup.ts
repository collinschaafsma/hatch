import { afterAll, beforeAll, vi } from "vitest";

// Silence console output during tests to reduce noise
beforeAll(() => {
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterAll(() => {
	vi.restoreAllMocks();
});
