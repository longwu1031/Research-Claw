/**
 * Shared Shiki highlighter singleton (lazy-loaded).
 * Used by CodeBlock and FilePreviewModal.
 */

let highlighterPromise: Promise<import('shiki').Highlighter> | null = null;

export function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then((mod) =>
      mod.createHighlighter({
        themes: ['github-dark', 'github-light'],
        langs: [
          'python', 'javascript', 'typescript', 'json', 'bash', 'shell',
          'markdown', 'latex', 'r', 'julia', 'matlab', 'yaml', 'toml',
          'html', 'css', 'sql', 'c', 'cpp', 'java', 'go', 'rust',
        ],
      }),
    );
  }
  return highlighterPromise;
}
