export function generateAdrTemplate(): string {
	return `# ADR-NNN: [Decision Title]

## Date

YYYY-MM-DD

## Status

Proposed | Accepted | Deprecated | Superseded by [ADR-NNN](./NNN-title.md)

## Context

What is the issue that we are seeing that motivates this decision or change? Describe the forces at play (technical, business, social). What constraints exist?

## Decision

What is the change that we are proposing and/or doing? State the decision in full sentences, with active voice.

## Consequences

What becomes easier or more difficult to do because of this change? List both positive and negative consequences.

### Positive

- ...

### Negative

- ...

## Alternatives Considered

What other options were evaluated? Why were they not chosen?

### Alternative 1: [Name]

Description and reason for rejection.

### Alternative 2: [Name]

Description and reason for rejection.
`;
}
