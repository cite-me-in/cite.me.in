import { TrashIcon } from "lucide-react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { Input } from "~/components/ui/Input";
import type { action } from "./route";

export default function MembersSection({
  site,
  isOwner,
}: {
  site: {
    domain: string;
    owner: { id: string; email: string };
    siteUsers: { user: { id: string; email: string } }[];
    siteInvitations: { id: string; email: string; createdAt: Date }[];
  };
  isOwner: boolean;
}) {
  const fetcher = useFetcher<typeof action>();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y-2 divide-black border-2 border-black">
            <li className="flex items-center justify-between px-4 py-3">
              <span className="font-mono text-sm">{site.owner.email}</span>
              <span className="rounded-base border-2 border-black bg-[#F59E0B] px-2 py-0.5 text-xs font-bold">
                Owner
              </span>
            </li>
            {site.siteUsers.map(({ user }) => (
              <li key={user.id} className="flex items-center justify-between px-4 py-3">
                <span className="font-mono text-sm">{user.email}</span>
                {isOwner && (
                  <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="remove-member" />
                    <input type="hidden" name="userId" value={user.id} />
                    <Button type="submit" variant="destructive" size="sm" className="gap-2">
                      <TrashIcon className="size-4" />
                      Remove
                    </Button>
                  </fetcher.Form>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {isOwner && <InviteSection site={site} invitations={site.siteInvitations} />}
    </>
  );
}

function InviteSection({
  site,
  invitations,
}: {
  site: { domain: string };
  invitations: { id: string; email: string; createdAt: Date }[];
}) {
  const fetcher = useFetcher();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite Member</CardTitle>
      </CardHeader>
      <CardContent>
        <fetcher.Form method="post" action={`/site/${site.domain}/invite`} className="flex gap-3">
          <Input
            type="email"
            name="email"
            placeholder="colleague@example.com"
            required
            className="rounded-base flex-1 border-2 border-black bg-white px-4 py-2 font-mono text-sm focus:ring-2 focus:ring-[#F59E0B] focus:outline-none"
          />
          <Button type="submit" disabled={fetcher.state !== "idle"} variant="secondary">
            Send Invite
          </Button>
        </fetcher.Form>

        {invitations.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold">Pending Invitations</h3>
            <ul className="divide-y-2 divide-black border-2 border-black">
              {invitations.map((invitation) => (
                <li key={invitation.id} className="flex items-center justify-between px-4 py-3">
                  <span className="font-mono text-sm">{invitation.email}</span>
                  <span className="text-foreground/60 text-xs">
                    {new Date(invitation.createdAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
