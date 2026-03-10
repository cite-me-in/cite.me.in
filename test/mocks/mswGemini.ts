import { HttpResponse, http } from "msw";

// Return a minimal valid Gemini generateContent response with no grounding
// metadata so the SDK produces citations = [] and extraQueries = [].
export default http.post(
  /https:\/\/generativelanguage\.googleapis\.com\/.*:generateContent/,
  () =>
    HttpResponse.json({
      candidates: [
        {
          content: {
            parts: [{ text: "No results found." }],
            role: "model",
          },
          finishReason: "STOP",
        },
      ],
      usage: {
        inputTokens: 5,
        outputTokens: 10,
      },
    }),
);
