import { HttpResponse, http } from "msw";

// OpenAI Responses API (used by openaiClient.server.ts for web search)
const openaiResponses = http.post("https://api.openai.com/v1/responses", () =>
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
      input_tokens: 5,
      output_tokens: 10,
      total_tokens: 15,
    },
  }),
);

export default [openaiResponses];
