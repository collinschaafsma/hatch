export function generateDashboardPage(useWorkOS: boolean): string {
	if (useWorkOS) {
		return `import { signOut, withAuth } from "@workos-inc/authkit-nextjs";
import { AITriggerButton } from "@/components/dashboard/ai-trigger";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default async function DashboardPage() {
	const { user } = await withAuth({ ensureSignedIn: true });

	return (
		<div className="container mx-auto p-8">
			<div className="flex items-center justify-between mb-8">
				<div className="flex items-center gap-4">
					<Avatar className="h-12 w-12">
						<AvatarImage src={user?.profilePictureUrl || undefined} />
						<AvatarFallback>
							{user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
						</AvatarFallback>
					</Avatar>
					<div>
						<h1 className="text-2xl font-bold">Dashboard</h1>
						<p className="text-muted-foreground">
							Welcome back, {user?.firstName || user?.email || "User"}
						</p>
					</div>
				</div>
				<form
					action={async () => {
						"use server";
						await signOut();
					}}
				>
					<Button variant="outline" type="submit">
						Sign Out
					</Button>
				</form>
			</div>

			<Separator className="mb-8" />

			<div className="grid gap-6">
				<Card>
					<CardHeader>
						<CardTitle>AI Workflow Demo</CardTitle>
						<CardDescription>
							Click the button below to trigger an AI workflow that processes
							your request using Vercel Workflow DevKit.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<AITriggerButton />
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>User Info</CardTitle>
						<CardDescription>Your account details from WorkOS</CardDescription>
					</CardHeader>
					<CardContent>
						<pre className="bg-muted p-4 rounded text-sm overflow-auto">
							{JSON.stringify(user, null, 2)}
						</pre>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
`;
	}

	return `import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AITriggerButton } from "@/components/dashboard/ai-trigger";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user) {
		redirect("/login");
	}

	const user = session.user;

	return (
		<div className="container mx-auto p-8">
			<div className="flex items-center justify-between mb-8">
				<div className="flex items-center gap-4">
					<Avatar className="h-12 w-12">
						<AvatarImage src={user?.image || undefined} />
						<AvatarFallback>
							{user?.name?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
						</AvatarFallback>
					</Avatar>
					<div>
						<h1 className="text-2xl font-bold">Dashboard</h1>
						<p className="text-muted-foreground">
							Welcome back, {user?.name || user?.email || "User"}
						</p>
					</div>
				</div>
				<SignOutButton />
			</div>

			<Separator className="mb-8" />

			<div className="grid gap-6">
				<Card>
					<CardHeader>
						<CardTitle>AI Workflow Demo</CardTitle>
						<CardDescription>
							Click the button below to trigger an AI workflow that processes
							your request using Vercel Workflow DevKit.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<AITriggerButton />
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>User Info</CardTitle>
						<CardDescription>Your account details</CardDescription>
					</CardHeader>
					<CardContent>
						<pre className="bg-muted p-4 rounded text-sm overflow-auto">
							{JSON.stringify(user, null, 2)}
						</pre>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function SignOutButton() {
	return (
		<form
			action={async () => {
				"use server";
				// Sign out is handled client-side with authClient
			}}
		>
			<Button variant="outline" type="button" onClick={() => {
				// This will be handled client-side
			}}>
				Sign Out
			</Button>
		</form>
	);
}
`;
}
