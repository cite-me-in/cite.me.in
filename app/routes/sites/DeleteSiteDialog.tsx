import { TrashIcon } from "lucide-react";
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

export default function DeleteSiteDialog({
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
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          disabled={isSubmitting}
          aria-label="Delete site"
        >
          <TrashIcon className="size-4" />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Site</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{domain}</strong>? This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <p className="mb-4 text-foreground/60 text-sm">
          Type the domain name below to confirm deletion:
        </p>

        <Input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={domain}
          disabled={isSubmitting}
          className="mb-6"
          onKeyDown={(e) => {
            if (e.key === "Enter") confirmIfValid();
          }}
        />

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
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
