export default function Heading({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-row items-center justify-between gap-4">
      <h1 className="font-heading text-3xl">{title}</h1>
      {children}
    </div>
  );
}
