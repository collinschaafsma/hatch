export function generateDashboardPage(useWorkOS: boolean): string {
	if (useWorkOS) {
		return `import { Suspense } from "react";
import { signOut, withAuth } from "@workos-inc/authkit-nextjs";
import { AITriggerButton } from "./_components/ai-trigger";
import { DashboardSkeleton } from "./_components/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Separator } from "@workspace/ui/components/separator";

async function DashboardContent() {
	const { user } = await withAuth({ ensureSignedIn: true });

	// Extract only needed fields to minimize serialization
	const displayName = user?.firstName || user?.email || "User";
	const avatarUrl = user?.profilePictureUrl || undefined;
	const initials = user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "U";
	const userInfo = {
		email: user?.email,
		firstName: user?.firstName,
		lastName: user?.lastName,
	};

	return (
		<div className="container mx-auto p-8">
			<div className="flex items-center justify-between mb-8">
				<div className="flex items-center gap-4">
					<Avatar className="h-12 w-12">
						<AvatarImage src={avatarUrl} />
						<AvatarFallback>{initials}</AvatarFallback>
					</Avatar>
					<div>
						<h1 className="text-2xl font-bold">Dashboard</h1>
						<p className="text-muted-foreground">
							Welcome back, {displayName}
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
				<Card className="defer-render">
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

				<Card className="defer-render">
					<CardHeader>
						<CardTitle>User Info</CardTitle>
						<CardDescription>Your account details from WorkOS</CardDescription>
					</CardHeader>
					<CardContent>
						<pre className="bg-muted p-4 rounded text-sm overflow-auto">
							{JSON.stringify(userInfo, null, 2)}
						</pre>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

export default function DashboardPage() {
	return (
		<Suspense fallback={<DashboardSkeleton />}>
			<DashboardContent />
		</Suspense>
	);
}
`;
	}

	return `import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AITriggerButton } from "./_components/ai-trigger";
import { SignOutButton } from "./_components/sign-out-button";
import { DashboardSkeleton } from "./_components/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Separator } from "@workspace/ui/components/separator";
import { getSession } from "@/lib/auth";

async function DashboardContent() {
	const session = await getSession();

	if (!session?.user) {
		redirect("/login");
	}

	const user = session.user;

	// Extract only needed fields to minimize serialization
	const displayName = user?.name || user?.email || "User";
	const avatarUrl = user?.image || undefined;
	const initials = user?.name?.[0] || user?.email?.[0]?.toUpperCase() || "U";
	const userInfo = {
		name: user?.name,
		email: user?.email,
	};

	return (
		<div className="container mx-auto p-8">
			<div className="flex items-center justify-between mb-8">
				<div className="flex items-center gap-4">
					<Avatar className="h-12 w-12">
						<AvatarImage src={avatarUrl} />
						<AvatarFallback>{initials}</AvatarFallback>
					</Avatar>
					<div>
						<h1 className="text-2xl font-bold">Dashboard</h1>
						<p className="text-muted-foreground">
							Welcome back, {displayName}
						</p>
					</div>
				</div>
				<SignOutButton />
			</div>

			<Separator className="mb-8" />

			<div className="grid gap-6">
				<Card className="defer-render">
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

				<Card className="defer-render">
					<CardHeader>
						<CardTitle>User Info</CardTitle>
						<CardDescription>Your account details</CardDescription>
					</CardHeader>
					<CardContent>
						<pre className="bg-muted p-4 rounded text-sm overflow-auto">
							{JSON.stringify(userInfo, null, 2)}
						</pre>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

export default function DashboardPage() {
	return (
		<Suspense fallback={<DashboardSkeleton />}>
			<DashboardContent />
		</Suspense>
	);
}
`;
}
