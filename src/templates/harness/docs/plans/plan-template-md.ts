export function generatePlanTemplate(): string {
	return `# Plan: [Feature Name]

**Spike:** [spike-name]
**Created:** [timestamp]
**Status:** in-progress | completed | abandoned

## Goal

[1-2 sentence description of what we're building and why]

## Approach

[High-level strategy. What patterns are we following? What existing code are we extending?]

## Steps

- [ ] Step 1: [description]
  - Files: [expected files to create/modify]
  - Verification: [how to verify this step worked]
- [ ] Step 2: [description]
- [ ] Step 3: [description]

## Decision Log

| Decision | Rationale | Date |
|----------|-----------|------|
| | | |

## References

- [Link to related docs, past plans, architecture docs]
`;
}
