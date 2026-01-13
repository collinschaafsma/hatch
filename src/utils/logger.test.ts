import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { log } from "./logger.js";

describe("logger utilities", () => {
	let consoleSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleSpy.mockRestore();
	});

	describe("log.info", () => {
		it("should log message with cyan color prefix", () => {
			log.info("test message");
			expect(consoleSpy).toHaveBeenCalledTimes(1);
			const call = consoleSpy.mock.calls[0];
			expect(call[0]).toContain("info");
			expect(call[1]).toBe("test message");
		});
	});

	describe("log.success", () => {
		it("should log message with green color prefix", () => {
			log.success("success message");
			expect(consoleSpy).toHaveBeenCalledTimes(1);
			const call = consoleSpy.mock.calls[0];
			expect(call[0]).toContain("success");
			expect(call[1]).toBe("success message");
		});
	});

	describe("log.warn", () => {
		it("should log message with yellow color prefix", () => {
			log.warn("warning message");
			expect(consoleSpy).toHaveBeenCalledTimes(1);
			const call = consoleSpy.mock.calls[0];
			expect(call[0]).toContain("warn");
			expect(call[1]).toBe("warning message");
		});
	});

	describe("log.error", () => {
		it("should log message with red color prefix", () => {
			log.error("error message");
			expect(consoleSpy).toHaveBeenCalledTimes(1);
			const call = consoleSpy.mock.calls[0];
			expect(call[0]).toContain("error");
			expect(call[1]).toBe("error message");
		});
	});

	describe("log.step", () => {
		it("should log message with blue arrow prefix", () => {
			log.step("step message");
			expect(consoleSpy).toHaveBeenCalledTimes(1);
			const call = consoleSpy.mock.calls[0];
			expect(call[0]).toContain("->");
			expect(call[1]).toBe("step message");
		});
	});

	describe("log.blank", () => {
		it("should log empty line", () => {
			log.blank();
			expect(consoleSpy).toHaveBeenCalledTimes(1);
			expect(consoleSpy.mock.calls[0].length).toBe(0);
		});
	});
});
