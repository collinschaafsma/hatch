export function generateLoginPage(): string {
	return `"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const handleSendOTP = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError("");

		try {
			const { error } = await authClient.emailOtp.sendVerificationOtp({
				email,
				type: "sign-in",
			});

			if (error) {
				setError(error.message || "Failed to send code");
				return;
			}

			// Store email for verification page
			sessionStorage.setItem("pendingEmail", email);
			router.push("/verify-otp");
		} catch {
			setError("An unexpected error occurred");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl">Sign In</CardTitle>
					<CardDescription>
						Enter your email to receive a one-time code
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSendOTP} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								type="email"
								value={email}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
								required
								placeholder="you@example.com"
							/>
						</div>

						{error && (
							<p className="text-sm text-destructive">{error}</p>
						)}

						<Button type="submit" className="w-full" disabled={loading}>
							{loading ? "Sending..." : "Send Code"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
`;
}
