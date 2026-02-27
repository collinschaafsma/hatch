export function generateLoginPage(): string {
	return `"use client";

import { useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
	const router = useRouter();
	// Lazy initialization - restore email if user navigated back
	const [email, setEmail] = useState(() =>
		typeof window !== "undefined"
			? sessionStorage.getItem("pendingEmail") || ""
			: ""
	);
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

	const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		// Use transition for non-urgent input updates
		startTransition(() => {
			setEmail(e.target.value);
		});
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
								onChange={handleEmailChange}
								required
								placeholder="you@example.com"
							/>
						</div>

						{error ? (
							<p className="text-sm text-destructive" role="alert">{error}</p>
						) : null}

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
