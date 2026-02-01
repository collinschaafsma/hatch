export function generateDashboardSkeleton(): string {
	return `export function DashboardSkeleton() {
	return (
		<div className="container mx-auto p-8 animate-pulse">
			<div className="flex items-center justify-between mb-8">
				<div className="flex items-center gap-4">
					<div className="h-12 w-12 bg-muted rounded-full" />
					<div className="space-y-2">
						<div className="h-7 w-32 bg-muted rounded" />
						<div className="h-4 w-48 bg-muted rounded" />
					</div>
				</div>
				<div className="h-9 w-24 bg-muted rounded" />
			</div>

			<div className="h-px w-full bg-muted mb-8" />

			<div className="grid gap-6">
				<div className="border rounded-lg p-6 space-y-4">
					<div className="space-y-2">
						<div className="h-6 w-40 bg-muted rounded" />
						<div className="h-4 w-72 bg-muted rounded" />
					</div>
					<div className="h-10 w-32 bg-muted rounded" />
				</div>

				<div className="border rounded-lg p-6 space-y-4">
					<div className="space-y-2">
						<div className="h-6 w-24 bg-muted rounded" />
						<div className="h-4 w-48 bg-muted rounded" />
					</div>
					<div className="h-32 w-full bg-muted rounded" />
				</div>
			</div>
		</div>
	);
}
`;
}
