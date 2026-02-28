export async function postMonitorEvent(
	monitor: { convexSiteUrl: string; token: string },
	path: string,
	payload: unknown,
): Promise<void> {
	const res = await fetch(`${monitor.convexSiteUrl}${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${monitor.token}`,
		},
		body: JSON.stringify(payload),
		signal: AbortSignal.timeout(10_000),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
