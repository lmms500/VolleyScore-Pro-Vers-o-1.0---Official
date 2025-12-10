
/**
 * Calculates the Levenshtein distance between two strings.
 * Used for fuzzy matching voice commands to player/team names.
 */
export const levenshteinDistance = (a: string, b: string): number => {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

/**
 * Checks if a spoken phrase matches a target string within a tolerance threshold.
 * @param input The spoken text (e.g., "Joao")
 * @param target The actual name (e.g., "João")
 * @param threshold Max distance allowed (default 2 edits)
 */
export const isFuzzyMatch = (input: string, target: string, threshold: number = 2): boolean => {
  const cleanInput = input.toLowerCase().trim();
  const cleanTarget = target.toLowerCase().trim();
  
  if (cleanTarget.includes(cleanInput) || cleanInput.includes(cleanTarget)) return true;
  
  const dist = levenshteinDistance(cleanInput, cleanTarget);
  // Allow more flexibility for longer names
  const dynamicThreshold = Math.max(threshold, Math.floor(target.length * 0.3));
  
  return dist <= dynamicThreshold;
};
