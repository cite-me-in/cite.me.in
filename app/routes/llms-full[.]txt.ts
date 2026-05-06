import privacyMD from "~/data/privacy.md?raw";
import termsMS from "~/data/terms.md?raw";
import { generateApiDocsMarkdown } from "~/lib/api/docs.server";
import { generateOpenApiSpec } from "~/lib/api/openapi";
import llmsTxt from "../../public/llms.txt?raw";

export async function loader() {
  const docsMD = generateApiDocsMarkdown(generateOpenApiSpec());
  const full = `
${llmsTxt.trim()}

# Privacy Policy

${privacyMD.trim()}

# Terms of Service

${termsMS.trim()}

# API Documentation

${docsMD.trim()}
  `;

  return new Response(full.trim(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
