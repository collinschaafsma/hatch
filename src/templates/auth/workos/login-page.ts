export function generateWorkOSLoginPage(): string {
	return `import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";

export default function LoginPage() {
	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl">Sign In</CardTitle>
					<CardDescription>
						Sign in to access your account
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						action={async () => {
							"use server";
							const signInUrl = await getSignInUrl();
							redirect(signInUrl);
						}}
					>
						<Button type="submit" className="w-full">
							Sign In with WorkOS
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
`;
}
