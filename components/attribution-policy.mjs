const tool = '(?:Claude|Codex|ChatGPT|Copilot|Cursor|Gemini|Anthropic|OpenAI|GPT(?:-[A-Za-z0-9.]+)?|AI(?: Assistant)?|LLM)';
const patterns = [
  new RegExp(`(?:Co-Authored-By|Assisted-By):[^\\n]*${tool}`, 'i'),
  new RegExp(`AI[- ]Assisted-By:[^\\n]*${tool}`, 'i'),
  new RegExp(`(?:Generated|Created|Written|Authored|Made)\\s+(?:with|by)\\s+(?:an?\\s+)?${tool}(?!['’]s)`, 'i'),
  new RegExp(`Built\\s+by\\s+(?:an?\\s+)?${tool}(?!['’]s)`, 'i'),
  new RegExp(`${tool}\\s+(?:authored|generated|created|wrote)\\s+(?:this|the|an?)\\s+(?:artifact|file|code|review|report|document|pull request|PR|commit|comment)`, 'i'),
];

const toolBrandedBranch = /^(?:claude|codex|chatgpt|copilot|cursor|gemini|anthropic|openai|gpt(?:-[a-z0-9.]+)?)(?:[/-]|$)/i;

export function containsAttribution(text) {
  return patterns.some((pattern) => pattern.test(text));
}

export function hasToolBrandedBranchName(branchName) {
  return toolBrandedBranch.test(branchName.trim().replace(/^refs\/heads\//i, ''));
}
