import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/Button";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet } from "~/components/ui/FieldSet";
import { Input } from "~/components/ui/Input";

export default function ProfilePasswordForm() {
  const fetcher = useFetcher<{ success?: string; error?: string }>();
  const data = fetcher.data;
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (data?.success) formRef.current?.reset();
  }, [data?.success]);

  return (
    <fetcher.Form method="post" action="/profile" ref={formRef}>
      <FieldSet>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="newPassword">New password</FieldLabel>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>
        </FieldGroup>
        {data?.error && <FieldError className="text-lg">{data.error}</FieldError>}
        {data?.success && <p className="text-success text-lg">{data.success}</p>}
        <Button type="submit" disabled={fetcher.state !== "idle"}>
          Change password
        </Button>
      </FieldSet>
    </fetcher.Form>
  );
}
