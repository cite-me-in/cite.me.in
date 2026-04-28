import { Column, Heading, Row, Section } from "react-email";
import { twMerge } from "tailwind-merge";

export default function Card({
  children,
  className,
  title,
  subtitle,
  withBorder,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string | React.ReactNode;
  subtitle?: string;
  withBorder?: boolean;
}) {
  return (
    <Section
      className={twMerge(
        "my-4 w-full overflow-hidden bg-white",
        withBorder && "rounded-xl border border-border",
        className,
      )}
    >
      {(title || subtitle) && (
        <Row>
          <Column className="px-5 pt-4">
            {title && (
              <Heading as="h2" className="text-dark text-2xl font-bold">
                {title}
              </Heading>
            )}
            {subtitle && (
              <Heading as="h3" className="text-light text-sm">
                {subtitle}
              </Heading>
            )}
          </Column>
        </Row>
      )}
      <Row>
        <Column className="px-5 pt-4">{children}</Column>
      </Row>
    </Section>
  );
}
