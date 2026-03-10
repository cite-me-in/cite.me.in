import { HttpResponse, http } from "msw";

// Return a minimal valid Responses API response with no citations so the SDK
// can parse it successfully and produce sources = [].
// Note: created_at must be present — the SDK calls new Date(created_at * 1000).
export default http.post("https://api.openai.com/v1/responses", () =>
  HttpResponse.json({
    id: "resp_test",
    created_at: Math.floor(Date.now() / 1000),
    output: [
      {
        type: "message",
        role: "assistant",
        id: "msg_test",
        content: [
          {
            type: "output_text",
            text: "No results found.",
            annotations: [],
          },
        ],
      },
    ],
    usage: {
      inputTokens: 5,
      outputTokens: 10,
    },
  }),
);
