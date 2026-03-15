import { generateOpenApiSpec } from "~/lib/openapi";

export async function loader() {
  return Response.json(generateOpenApiSpec());
}
