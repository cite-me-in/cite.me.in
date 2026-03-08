import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "@react-email/components";

/**
 * EmailLayout is a component that wraps the email content and provides a consistent layout.
 * It is used to ensure that all emails have the same layout and consistent styling.
 *
 * @param children - The content of the email.
 * @param isCustomer - Whether the email is for a customer. Defaults to true.
 * @param preview - The preview text of the email. If not provided, the subject will be used.
 * @param subject - The subject of the email.
 * @returns The HTML email.
 */
export default function EmailLayout({
  children,
  isCustomer = true,
  preview,
  subject,
}: {
  children: React.ReactNode;
  isCustomer?: boolean;
  preview?: string;
  subject: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview ?? subject}</Preview>
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
          theme: {
            extend: {
              colors: {
                primary: "#4f46e5",
                text: "#374151",
                dark: "#1f2937",
                light: "#6b7280",
                background: "#f6f9fc",
                white: "#ffffff",
                highlightBg: "#f3f4f6",
                border: "#e5e7eb",
                borderLight: "#f0f0f0",
              },
            },
          },
        }}
      >
        <Body className="bg-background font-sans text-text">
          <Container className="mx-auto my-40px max-w-600px bg-white">
            <Header subject={subject} />
            {children}
            <Footer isCustomer={isCustomer} />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

function Header({ subject }: { subject: string }) {
  return (
    <Section>
      <Img
        alt="Rentail.space Logo"
        height="80"
        src="https://citeup.vercel.app/icon-192.png"
        className="mx-auto mb-8 block"
        width="80"
      />

      <Heading className="mb-6 text-center font-bold text-2xl text-gray-800 leading-snug">
        {subject}
      </Heading>
    </Section>
  );
}

function Footer({ isCustomer = true }: { isCustomer: boolean }) {
  return (
    <Section className="mt-8 border-gray-200 border-t pt-6">
      {isCustomer && (
        <Text className="mb-4 text-center text-gray-500 text-sm leading-relaxed">
          You're receiving this email because you signed up for an account at{" "}
          <Link
            href="https://citeup.vercel.app"
            className="text-light underline"
          >
            rentail.space
          </Link>
        </Text>
      )}
      <Text className="my-2 text-center text-light text-sm leading-relaxed">
        <Link
          href="https://citeup.vercel.app/privacy"
          className="text-primary underline"
        >
          Privacy Policy
        </Link>{" "}
        •{" "}
        <Link
          href="https://citeup.vercel.app/terms"
          className="text-primary underline"
        >
          Terms of Service
        </Link>
      </Text>
    </Section>
  );
}
