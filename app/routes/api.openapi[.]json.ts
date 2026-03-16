import { data } from "react-router";
import { generateOpenApiSpec } from "~/lib/api/openapi";

export async function loader() {
  return data(generateOpenApiSpec());
}
