/**
 * Example prompts — curated starting points for the composer (the Examples card).
 *
 * Each is a clearly-labelled STARTER (not fabricated history): picking one fills
 * the System + User message and, when the suggested model is in the live catalog,
 * selects it. Pure data; no network. The `model` is a suggestion shown as a chip.
 *
 * EVERY MODEL HERE MUST BE ONE THE GATEWAY SERVES. All six once named `zen-omni` or
 * `zen-coder`, and the catalog carries neither — zen's text models are `zen5…`, while
 * `zen-<noun>` names a modality (embedding, image, video, rerank, voice, vl). Applying
 * an example falls back to the currently-selected model when the suggestion is absent
 * (`models.byId.has(...)`), so nothing broke and nothing was logged: the card simply
 * advertised a model that would never be the one that ran. `examples.test.ts` bites on
 * the shape now, so a modality SKU or a retired id cannot come back.
 */
export type Example = {
  id: string
  /** The card title. */
  label: string
  /** Suggested model id (the chip); selected on apply when it exists in the catalog. */
  model: string
  system: string
  user: string
}

export const EXAMPLES: Example[] = [
  {
    id: 'quantum',
    label: 'Explain quantum computing',
    model: 'zen5-mini',
    system: 'You are a patient teacher. Explain clearly for a curious beginner.',
    user: 'Explain quantum computing in simple terms, with one everyday analogy.',
  },
  {
    id: 'debounce',
    label: 'Write a debounce function',
    model: 'zen5-coder',
    system: 'You are an expert TypeScript engineer. Return only the code, no prose.',
    user: 'Write a typed debounce<T> function with a cancel() method.',
  },
  {
    id: 'summarize',
    label: 'Summarize a paragraph',
    model: 'zen5-mini',
    system: 'Summarize the user text in exactly three bullet points.',
    user: 'Hanzo Cloud is a unified AI gateway exposing hundreds of models behind one OpenAI-compatible API, with built-in retrieval, billing and per-org keys, so orgs switch models without changing code.',
  },
  {
    id: 'json',
    label: 'Extract structured JSON',
    model: 'zen5-mini',
    system: 'Respond with a single minified JSON object and nothing else.',
    user: 'Extract name, role and company as JSON from: "Aoi Tanaka, the CTO at Hanzo, presented today."',
  },
  {
    id: 'reasoning',
    label: 'Step-by-step reasoning',
    model: 'zen5',
    system: 'Think step by step, then give the final answer on its own line.',
    user: 'A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost?',
  },
  {
    id: 'sql',
    label: 'Write a SQL query',
    model: 'zen5-coder',
    system: 'You are a senior data engineer. Return only the SQL.',
    user: 'Given users(id, created_at) and orders(id, user_id, total), write SQL for the top 5 users by total spend in 2026.',
  },
]
