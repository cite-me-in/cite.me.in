import { useRef, useState } from "react";
import { Button } from "~/components/ui/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/Dialog";
import { Input } from "~/components/ui/Input";

export default function DeleteSiteButton({
  domain,
  onConfirm,
  isSubmitting = false,
}: {
  domain: string;
  onConfirm: () => void;
  isSubmitting?: boolean;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isValid = input === domain;

  const confirmIfValid = () => {
    if (isValid) onConfirm();
  };

  return (
    <Dialog
      onOpenChange={() => {
        setInput("");
      }}
    >
      <DialogTrigger
        render={
          <Button
            aria-label="Delete site"
            disabled={isSubmitting}
            size="sm"
            variant="destructive"
          />
        }
      >
        Delete Site
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Site</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{domain}</strong>? This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <p className="text-foreground/60 mb-4 text-sm">
          Type the domain name below to confirm deletion:
        </p>

        <Input
          className="mb-6"
          disabled={isSubmitting}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirmIfValid();
          }}
          placeholder={domain}
          ref={inputRef}
          type="text"
          value={input}
        />

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            onClick={confirmIfValid}
            disabled={!isValid || isSubmitting}
            variant="destructive"
          >
            Delete Site
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
