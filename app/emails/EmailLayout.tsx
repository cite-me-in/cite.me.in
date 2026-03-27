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
 * @param preview - The preview text of the email. If not provided, the subject will be used.
 * @param subject - The subject of the email.
 * @param unsubscribeURL - The URL to unsubscribe from all emails.
 * @returns The HTML email.
 */
export default function EmailLayout({
  children,
  preview,
  subject,
  unsubscribeURL,
}: {
  children: React.ReactNode;
  preview?: string;
  subject: string;
  unsubscribeURL?: string;
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
          <Container className="mx-auto my-40px max-w-600px bg-white p-4">
            <Header subject={subject} />
            {children}
            <Footer unsubscribeURL={unsubscribeURL} />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

function Header({ subject }: { subject: string }) {
  return (
    <Section>
      <Heading className="my-6 flex items-center justify-center gap-2 whitespace-nowrap text-center">
        <Img
          height={32}
          src={new URL("/icon-192.png", "https://cite.me.in").toString()}
          width={32}
        />
        <span className="font-bold text-2xl text-gray-800">{subject}</span>
      </Heading>
    </Section>
  );
}

function Footer({ unsubscribeURL }: { unsubscribeURL?: string }) {
  return (
    <Section className="mt-8 border-gray-200 border-t pt-6">
      {unsubscribeURL && (
        <Text className="my-2 text-center text-light text-xs">
          You're receiving this email because you signed up for an account at{" "}
          <Link
            href={import.meta.env.VITE_APP_URL}
            className="text-light underline"
          >
            cite.me.in
          </Link>
          <br />
          <Link href={unsubscribeURL} className="text-primary underline">
            Unsubscribe from all emails
          </Link>
        </Text>
      )}

      <Text className="my-2 text-center text-light text-sm leading-relaxed">
        <Link
          href={new URL("/privacy", import.meta.env.VITE_APP_URL).toString()}
          className="text-primary underline"
        >
          Privacy Policy
        </Link>{" "}
        •{" "}
        <Link
          href={new URL("/terms", import.meta.env.VITE_APP_URL).toString()}
          className="text-primary underline"
        >
          Terms of Service
        </Link>
      </Text>
    </Section>
  );
}
