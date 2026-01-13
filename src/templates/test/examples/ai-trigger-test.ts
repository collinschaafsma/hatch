export function generateAiTriggerTest(): string {
	return `import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../utils/render";
import { mockFetch, resetFetchMock } from "../utils/mocks";
import { AITriggerButton } from "@/components/dashboard/ai-trigger";

describe("AITriggerButton", () => {
	beforeEach(() => {
		mockFetch({
			"/api/workflow": { runId: "test-run-123" },
		});
	});

	afterEach(() => {
		resetFetchMock();
	});

	it("renders with default prompt", () => {
		render(<AITriggerButton />);

		expect(screen.getByLabelText("Prompt")).toHaveValue(
			"What are 3 interesting facts about TypeScript?",
		);
		expect(
			screen.getByRole("button", { name: /trigger ai workflow/i }),
		).toBeInTheDocument();
	});

	it("allows editing the prompt", async () => {
		const user = userEvent.setup();
		render(<AITriggerButton />);

		const input = screen.getByLabelText("Prompt");
		await user.clear(input);
		await user.type(input, "New prompt");

		expect(input).toHaveValue("New prompt");
	});

	it("disables button when prompt is empty", async () => {
		const user = userEvent.setup();
		render(<AITriggerButton />);

		const input = screen.getByLabelText("Prompt");
		await user.clear(input);

		expect(
			screen.getByRole("button", { name: /trigger ai workflow/i }),
		).toBeDisabled();
	});

	it("shows loading state when triggered", async () => {
		// Use a delayed mock to capture the loading state
		global.fetch = vi.fn(
			() =>
				new Promise((resolve) =>
					setTimeout(
						() =>
							resolve({
								ok: true,
								json: () => Promise.resolve({ runId: "test-run-123" }),
							} as Response),
						100,
					),
				),
		);

		const user = userEvent.setup();
		render(<AITriggerButton />);

		const button = screen.getByRole("button", { name: /trigger ai workflow/i });
		await user.click(button);

		// Check loading state appears
		expect(screen.getByRole("button", { name: /running/i })).toBeInTheDocument();

		// Wait for completion
		await waitFor(() => {
			expect(
				screen.getByText(/workflow started.*test-run-123/i),
			).toBeInTheDocument();
		});
	});

	it("displays success message with run ID", async () => {
		const user = userEvent.setup();
		render(<AITriggerButton />);

		const button = screen.getByRole("button", { name: /trigger ai workflow/i });
		await user.click(button);

		await waitFor(() => {
			expect(
				screen.getByText(/workflow started.*test-run-123/i),
			).toBeInTheDocument();
		});
	});

	it("displays error message on failure", async () => {
		mockFetch({
			"/api/workflow": { ok: false, error: "Something went wrong" },
		});

		const user = userEvent.setup();
		render(<AITriggerButton />);

		await user.click(
			screen.getByRole("button", { name: /trigger ai workflow/i }),
		);

		await waitFor(() => {
			expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
		});
	});
});
`;
}
