export function generateOpengraphImage(name: string): string {
	return `import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "${name}";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
	return new ImageResponse(
		(
			<div
				style={{
					fontSize: 128,
					background: "linear-gradient(to bottom right, #000000, #1a1a1a)",
					color: "white",
					width: "100%",
					height: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				${name}
			</div>
		),
		{ ...size },
	);
}
`;
}
