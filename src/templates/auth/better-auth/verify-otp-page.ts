export function generateVerifyOTPPage(): string {
	return `"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function VerifyOTPPage() {
	const router = useRouter();
	const [otp, setOtp] = useState("");
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		const pendingEmail = sessionStorage.getItem("pendingEmail");
		if (!pendingEmail) {
			router.push("/login");
			return;
		}
		setEmail(pendingEmail);
	}, [router]);

	const handleVerify = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError("");

		try {
			const { error } = await authClient.signIn.emailOtp({
				email,
				otp,
			});

			if (error) {
				setError(error.message || "Invalid code");
				return;
			}

			sessionStorage.removeItem("pendingEmail");
			router.push("/dashboard");
		} catch {
			setError("An unexpected error occurred");
		} finally {
			setLoading(false);
		}
	};

	const handleResend = async () => {
		setLoading(true);
		setError("");

		try {
			const { error } = await authClient.emailOtp.sendVerificationOtp({
				email,
				type: "sign-in",
			});

			if (error) {
				setError(error.message || "Failed to resend code");
			}
		} catch {
			setError("Failed to resend code");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl">Enter Code</CardTitle>
					<CardDescription>
						We sent a code to {email}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleVerify} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="otp">Verification Code</Label>
							<Input
								id="otp"
								type="text"
								value={otp}
								onChange={(e) => setOtp(e.target.value)}
								required
								maxLength={6}
								className="text-center text-2xl tracking-widest"
								placeholder="000000"
							/>
						</div>

						{error && (
							<p className="text-sm text-destructive">{error}</p>
						)}

						<Button type="submit" className="w-full" disabled={loading}>
							{loading ? "Verifying..." : "Verify"}
						</Button>

						<button
							type="button"
							onClick={handleResend}
							className="w-full text-sm text-muted-foreground hover:underline"
							disabled={loading}
						>
							Resend code
						</button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
`;
}
