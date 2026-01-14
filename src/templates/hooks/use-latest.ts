export function generateUseLatest(): string {
	return `"use client";

import { useRef, useEffect } from "react";

/**
 * Returns a ref that always contains the latest value.
 * Useful for accessing values in callbacks without adding them to dependency arrays.
 */
export function useLatest<T>(value: T) {
	const ref = useRef(value);
	useEffect(() => {
		ref.current = value;
	}, [value]);
	return ref;
}
`;
}
