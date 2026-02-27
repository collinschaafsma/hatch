export function generateSignOutButton(): string {
	return `"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
	const router = useRouter();

	const handleSignOut = async () => {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					router.push("/login");
				},
			},
		});
	};

	return (
		<Button variant="outline" onClick={handleSignOut}>
			Sign Out
		</Button>
	);
}
`;
}
