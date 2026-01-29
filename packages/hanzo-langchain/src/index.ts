/**
 * Hanzo LangChain callback handler
 *
 * Re-exports from langfuse-langchain for compatibility.
 * This wrapper allows code to import from "hanzo-langchain" while
 * using the underlying langfuse-langchain implementation.
 */

// @ts-ignore - langfuse-langchain types may not be fully compatible
export { default, default as CallbackHandler } from "langfuse-langchain";

// Re-export any additional types that might be needed
// @ts-ignore
export * from "langfuse-langchain";
