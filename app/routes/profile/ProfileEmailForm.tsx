import { useFetcher } from "react-router";
import { Button } from "~/components/ui/Button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "~/components/ui/FieldSet";
import { Input } from "~/components/ui/Input";

export default function ProfileEmailForm({
  user,
}: {
  user: { email: string };
}) {
  const fetcher = useFetcher<{ success?: string; error?: string }>();
  const data = fetcher.data;

  return (
    <fetcher.Form method="post" action="/profile">
      <FieldSet>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">Your email address</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={user.email}
              required
            />
          </Field>
        </FieldGroup>
        {data?.error && (
          <FieldError className="text-lg">{data.error}</FieldError>
        )}
        {data?.success && (
          <p className="text-success text-lg">{data.success}</p>
        )}
        <Button type="submit" disabled={fetcher.state !== "idle"}>
          Update email
        </Button>
      </FieldSet>
    </fetcher.Form>
  );
}
