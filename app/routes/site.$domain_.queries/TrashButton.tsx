import { TrashIcon } from "lucide-react";
import { Button } from "~/components/ui/Button";

export default function TrashButton({
  title,
  onClick,
}: {
  title: string;
  onClick: () => void;
}) {
  return (
    <Button
      className="transition-all hover:border-red-600 hover:shadow-[3px_3px_0px_0px_red] focus-visible:border-red-600 focus-visible:shadow-[3px_3px_0px_0px_red]"
      onClick={onClick}
      size="sm"
      title={title}
      type="button"
      variant="ghost"
    >
      <TrashIcon className="size-4" />
    </Button>
  );
}
