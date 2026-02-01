import { generateBetterAuthSchema } from "./better-auth-schema.js";
import { generateWorkOSSchema } from "./workos-schema.js";

export function generateDbSchema(useWorkOS = false): string {
	if (useWorkOS) {
		return generateWorkOSSchema();
	}

	return generateBetterAuthSchema();
}
