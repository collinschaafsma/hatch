export function generateAuthSkeleton(): string {
	return `export function AuthSkeleton() {
	return (
		<div className="flex min-h-screen items-center justify-center p-4 animate-pulse">
			<div className="w-full max-w-md border rounded-lg p-6 space-y-6">
				<div className="text-center space-y-2">
					<div className="h-7 w-24 bg-muted rounded mx-auto" />
					<div className="h-4 w-56 bg-muted rounded mx-auto" />
				</div>
				<div className="space-y-4">
					<div className="space-y-2">
						<div className="h-4 w-12 bg-muted rounded" />
						<div className="h-10 w-full bg-muted rounded" />
					</div>
					<div className="h-10 w-full bg-muted rounded" />
				</div>
			</div>
		</div>
	);
}
`;
}
