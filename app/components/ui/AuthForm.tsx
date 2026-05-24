import { twMerge } from "tailwind-merge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./Card";

export default function AuthForm({
  className,
  title,
  form,
  footer,
}: {
  className?: string;
  title: string;
  form: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main
      className={twMerge(
        "flex min-h-screen items-center justify-center p-4",
        "bg-linear-to-br from-indigo-50 via-white to-purple-50",
      )}
    >
      <Card
        className={twMerge(
          "w-full max-w-md space-y-4",
          "bg-secondary-background text-secondary-foreground",
          className,
        )}
        fadeIn={true}
      >
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>

        <CardContent>{form}</CardContent>

        {footer && <CardFooter className="flex flex-col gap-2 text-center">{footer}</CardFooter>}
      </Card>
    </main>
  );
}
