import { HttpResponse, http } from "msw";

// Return a minimal valid Chat Completions response with no citations so the
// SDK can parse it successfully and produce sources = [].
// Note: id, created, model are all required by the Perplexity response schema.
export default http.post("https://api.perplexity.ai/chat/completions", () =>
  HttpResponse.json({
    id: "chatcmpl-test",
    created: Math.floor(Date.now() / 1000),
    model: "sonar",
    choices: [
      {
        message: { role: "assistant", content: "No results found." },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 12,
      completion_tokens: 315,
      total_tokens: 327,
    },
  }),
);
