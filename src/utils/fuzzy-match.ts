/**
 * Fuzzy text matching using Levenshtein distance
 */

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;

	const matrix: number[][] = [];

	// Initialize first column
	for (let i = 0; i <= b.length; i++) {
		matrix[i] = [i];
	}

	// Initialize first row
	for (let j = 0; j <= a.length; j++) {
		matrix[0]![j] = j;
	}

	// Fill in the rest of the matrix
	for (let i = 1; i <= b.length; i++) {
		for (let j = 1; j <= a.length; j++) {
			const cost = a[j - 1] === b[i - 1] ? 0 : 1;
			matrix[i]![j] = Math.min(
				matrix[i - 1]![j]! + 1, // deletion
				matrix[i]![j - 1]! + 1, // insertion
				matrix[i - 1]![j - 1]! + cost // substitution
			);
		}
	}

	return matrix[b.length]![a.length]!;
}

/**
 * Calculate similarity ratio between two strings (0-1)
 */
export function similarityRatio(a: string, b: string): number {
	const maxLength = Math.max(a.length, b.length);
	if (maxLength === 0) return 1;

	const distance = levenshteinDistance(a, b);
	return 1 - distance / maxLength;
}

/**
 * Find best match in content for a search string
 * Returns the matched text and its position, or null if no good match
 */
export function findBestMatch(
	content: string,
	searchText: string,
	threshold: number = 0.7
): { match: string; start: number; end: number; similarity: number } | null {
	// First try exact match
	const exactIndex = content.indexOf(searchText);
	if (exactIndex !== -1) {
		return {
			match: searchText,
			start: exactIndex,
			end: exactIndex + searchText.length,
			similarity: 1,
		};
	}

	// Normalize whitespace for fuzzy matching
	const normalizedSearch = normalizeWhitespace(searchText);
	const searchLength = normalizedSearch.length;

	// Use a sliding window approach
	let bestMatch: { match: string; start: number; end: number; similarity: number } | null = null;

	// Try different window sizes around the search length
	const windowSizes = [
		searchLength,
		Math.floor(searchLength * 0.9),
		Math.floor(searchLength * 1.1),
		Math.floor(searchLength * 0.8),
		Math.floor(searchLength * 1.2),
	];

	for (const windowSize of windowSizes) {
		if (windowSize <= 0 || windowSize > content.length) continue;

		// Slide window through content
		for (let i = 0; i <= content.length - windowSize; i++) {
			const window = content.slice(i, i + windowSize);
			const normalizedWindow = normalizeWhitespace(window);

			const similarity = similarityRatio(normalizedSearch, normalizedWindow);

			if (similarity >= threshold && (!bestMatch || similarity > bestMatch.similarity)) {
				bestMatch = {
					match: window,
					start: i,
					end: i + windowSize,
					similarity,
				};

				// If we found a very good match, stop early
				if (similarity >= 0.95) break;
			}
		}

		if (bestMatch && bestMatch.similarity >= 0.95) break;
	}

	return bestMatch;
}

/**
 * Normalize whitespace in a string for comparison
 */
function normalizeWhitespace(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

/**
 * Find line numbers containing text (1-indexed)
 */
export function findLineNumbers(content: string, searchText: string): number[] {
	const lines = content.split("\n");
	const result: number[] = [];
	const searchLower = searchText.toLowerCase();

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line && line.toLowerCase().includes(searchLower)) {
			result.push(i + 1);
		}
	}

	return result;
}
