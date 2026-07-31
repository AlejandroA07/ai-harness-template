const tool = '(?:Claude|Codex|ChatGPT|Copilot|Cursor|Gemini|Anthropic|OpenAI|GPT(?:-[A-Za-z0-9.]+)?)';
const patterns = [
  new RegExp(`(?:Co-Authored-By|Assisted-By):[^\\n]*${tool}`, 'i'),
  new RegExp(`(?:Generated|Created|Written)\\s+(?:with|by)\\s+(?:an?\\s+)?(?:${tool}|AI|LLM)`, 'i'),
  /\bAI[- ](?:assisted|generated)\b/i,
  /🤖/u,
];

export function containsAttribution(text) {
  return patterns.some((pattern) => pattern.test(text));
}
