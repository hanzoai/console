/**
 * The console assistant — the shared, grounded system prompt that makes the
 * built-in chat a genuine expert on the whole Hanzo suite. Imported by every chat
 * surface (the floating bubble + full Chat page via `ChatConversation`, and the ⌘K
 * "Ask AI" path via `CommandPalette`) so there is ONE source of assistant knowledge.
 */
export {
  hanzoAssistantSystemPrompt,
  commandBarSystemPrompt,
  ASSISTANT_DOCS_STORE,
  type AssistantPromptOptions,
} from './system-prompt'
export { assistantState } from './state'
