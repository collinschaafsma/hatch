export function generateUtilsTest(): string {
	return `import { describe, it, expect } from "vitest";
import { cn } from "@workspace/ui/lib/utils";

describe("cn utility", () => {
	it("merges class names correctly", () => {
		expect(cn("foo", "bar")).toBe("foo bar");
	});

	it("handles conditional classes", () => {
		expect(cn("base", false && "hidden", true && "visible")).toBe(
			"base visible",
		);
	});

	it("merges tailwind classes correctly", () => {
		expect(cn("px-4 py-2", "px-6")).toBe("py-2 px-6");
	});

	it("handles undefined and null", () => {
		expect(cn("base", undefined, null, "end")).toBe("base end");
	});
});
`;
}
