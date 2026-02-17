/**
 * Generate minimal stubs for convex/_generated/.
 * These are replaced by real types when `npx convex dev` runs.
 * We use `any` types to avoid complex generic issues in stubs.
 */

export function generateConvexServerStub(): string {
	return `/* eslint-disable */
// Auto-generated stub - replaced by \`npx convex dev\`
// biome-ignore-all: auto-generated stub

import {
	queryGeneric,
	mutationGeneric,
	actionGeneric,
	internalQueryGeneric,
	internalMutationGeneric,
	internalActionGeneric,
} from "convex/server";

// biome-ignore lint/suspicious/noExplicitAny: stub replaced by codegen
export const query: any = queryGeneric;
// biome-ignore lint/suspicious/noExplicitAny: stub replaced by codegen
export const mutation: any = mutationGeneric;
// biome-ignore lint/suspicious/noExplicitAny: stub replaced by codegen
export const action: any = actionGeneric;
// biome-ignore lint/suspicious/noExplicitAny: stub replaced by codegen
export const internalQuery: any = internalQueryGeneric;
// biome-ignore lint/suspicious/noExplicitAny: stub replaced by codegen
export const internalMutation: any = internalMutationGeneric;
// biome-ignore lint/suspicious/noExplicitAny: stub replaced by codegen
export const internalAction: any = internalActionGeneric;
`;
}

export function generateConvexDataModelStub(): string {
	return `/* eslint-disable */
// Auto-generated stub - replaced by \`npx convex dev\`
// biome-ignore-all: auto-generated stub

import type { AnyDataModel } from "convex/server";
import type { GenericId } from "convex/values";

export type DataModel = AnyDataModel;
export type TableNames = string;
export type Id<T extends string> = GenericId<T>;
`;
}

export function generateConvexApiStub(): string {
	return `/* eslint-disable */
// Auto-generated stub - replaced by \`npx convex dev\`
// biome-ignore-all: auto-generated stub

// biome-ignore lint/suspicious/noExplicitAny: stub replaced by codegen
export const api: any = {};
// biome-ignore lint/suspicious/noExplicitAny: stub replaced by codegen
export const internal: any = {};
// biome-ignore lint/suspicious/noExplicitAny: stub replaced by codegen
export const components: any = {};
`;
}
