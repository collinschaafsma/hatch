export function generateAiTriggerTest(): string {
	return `import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../utils/render";
import { AITriggerButton } from "@/app/(app)/dashboard/_components/ai-trigger";

// Mock Convex hooks
const mockStartWorkflow = vi.fn();
let mockRunData: Record<string, unknown> | undefined;

vi.mock("convex/react", () => ({
	useMutation: () => mockStartWorkflow,
	useQuery: () => mockRunData,
}));

vi.mock("@/convex/_generated/api", () => ({
	api: {
		workflows: {
			startRun: "workflows:startRun",
			getRun: "workflows:getRun",
		},
	},
}));

vi.mock("@/convex/_generated/dataModel", () => ({}));

describe("AITriggerButton", () => {
	beforeEach(() => {
		mockStartWorkflow.mockReset();
		mockRunData = undefined;
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

	it("calls startWorkflow when triggered", async () => {
		mockStartWorkflow.mockResolvedValue("run-123");

		const user = userEvent.setup();
		render(<AITriggerButton />);

		const button = screen.getByRole("button", { name: /trigger ai workflow/i });
		await user.click(button);

		expect(mockStartWorkflow).toHaveBeenCalledWith({
			prompt: "What are 3 interesting facts about TypeScript?",
		});
	});

	it("shows progress when workflow is running", () => {
		mockRunData = {
			status: "running",
			step: 2,
			totalSteps: 4,
			message: "Generating AI response...",
		};

		render(<AITriggerButton />);

		expect(screen.getByText("Processing")).toBeInTheDocument();
		expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
		expect(screen.getByText("Generating AI response...")).toBeInTheDocument();
	});

	it("shows result when workflow is completed", () => {
		mockRunData = {
			status: "completed",
			step: 4,
			totalSteps: 4,
			message: "Complete",
			result: "Here are 3 facts about TypeScript...",
		};

		render(<AITriggerButton />);

		expect(screen.getByText("Workflow completed!")).toBeInTheDocument();
		expect(
			screen.getByText("Here are 3 facts about TypeScript..."),
		).toBeInTheDocument();
	});

	it("shows error when workflow fails", () => {
		mockRunData = {
			status: "error",
			step: 1,
			totalSteps: 4,
			message: "Failed",
			error: "Something went wrong",
		};

		render(<AITriggerButton />);

		expect(screen.getByText("Something went wrong")).toBeInTheDocument();
	});
});
`;
}
