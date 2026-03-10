import debug from "debug";
import { HttpResponse, http } from "msw";

const logger = debug("anthropic");

export default http.post(
  "https://api.anthropic.com/v1/messages",
  async ({ request }) => {
    const body = await request.text();
    const requestQueries = body.includes(
      "generate search queries a user might type into an AI platform",
    );
    if (requestQueries) {
      logger("Mocking LLM response for query suggestions");
      return HttpResponse.json({
        id: `msg_test_${crypto.randomUUID()}`,
        type: "message",
        role: "assistant",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              elements: [
                { group: "1. discovery", query: "Query 1" },
                { group: "1. discovery", query: "Query 2" },
                { group: "1. discovery", query: "Query 3" },
                { group: "2. active_search", query: "Query 4" },
                { group: "2. active_search", query: "Query 5" },
                { group: "2. active_search", query: "Query 6" },
                { group: "3. comparison", query: "Query 7" },
                { group: "3. comparison", query: "Query 8" },
                { group: "3. comparison", query: "Query 9" },
              ],
            }),
          },
        ],
        model: "claude-3-5-sonnet-20241022",
        stop_reason: "end_turn",
        usage: {
          input_tokens: 5,
          output_tokens: 10,
        },
      });
    } else {
      // Citation query — return a minimal valid response with no sources.
      logger("Mocking LLM response for citation query");
      return HttpResponse.json({
        id: `msg_test_${crypto.randomUUID()}`,
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: "No results found." }],
        model: "claude-haiku-4-5-20251001",
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5 },
      });
    }
  },
);
