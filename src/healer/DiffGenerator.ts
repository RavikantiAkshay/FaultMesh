/**
 * FaultMesh Unified Diff Generator
 * Produces standard Git-compatible unified diffs for reviewable code remediation.
 */

export class DiffGenerator {
  /**
   * Generates a unified diff string comparing original and remediated content
   */
  static generateDiff(filePath: string, original: string, remediated: string): string {
    const origLines = original.split(/\r?\n/);
    const remLines = remediated.split(/\r?\n/);

    const normPath = filePath.replace(/\\/g, '/');
    const header = [
      `--- a/${normPath}`,
      `+++ b/${normPath}`,
    ];

    if (original === remediated) {
      return '';
    }

    // Find the first line that differs
    let startLine = 0;
    while (
      startLine < origLines.length &&
      startLine < remLines.length &&
      origLines[startLine] === remLines[startLine]
    ) {
      startLine++;
    }

    // Find common trailing lines
    let origEnd = origLines.length - 1;
    let remEnd = remLines.length - 1;

    while (
      origEnd > startLine &&
      remEnd > startLine &&
      origLines[origEnd] === remLines[remEnd]
    ) {
      origEnd--;
      remEnd--;
    }

    // Context lines before difference (up to 3)
    const contextBefore = Math.max(0, startLine - 3);
    const hunkOrigStart = contextBefore + 1;
    const hunkRemStart = contextBefore + 1;

    const hunkLines: string[] = [];

    // Add context before
    for (let i = contextBefore; i < startLine; i++) {
      hunkLines.push(` ${origLines[i]}`);
    }

    // Add removed lines
    for (let i = startLine; i <= origEnd; i++) {
      hunkLines.push(`-${origLines[i]}`);
    }

    // Add added lines
    for (let i = startLine; i <= remEnd; i++) {
      hunkLines.push(`+${remLines[i]}`);
    }

    // Context lines after difference (up to 3)
    const contextAfter = Math.min(origLines.length, origEnd + 4);
    for (let i = origEnd + 1; i < contextAfter; i++) {
      hunkLines.push(` ${origLines[i]}`);
    }

    const origCount = hunkLines.filter(l => l.startsWith(' ') || l.startsWith('-')).length;
    const remCount = hunkLines.filter(l => l.startsWith(' ') || l.startsWith('+')).length;

    const rangeHeader = `@@ -${hunkOrigStart},${origCount} +${hunkRemStart},${remCount} @@`;

    return [...header, rangeHeader, ...hunkLines].join('\n');
  }
}
