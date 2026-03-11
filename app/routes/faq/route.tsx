import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { twMerge } from "tailwind-merge";
import { ActiveLink } from "~/components/ui/ActiveLink";
import envVars from "~/lib/envVars";
import type { Route } from "./+types/route";
import faq from "./faq";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "FAQ | Cite.me.in" },
    {
      name: "description",
      content:
        "Frequently asked questions about Cite.me.in: how LLM citation visibility monitoring works, which AI platforms we track, and how to get started.",
    },
  ];
}

export default function FAQ() {
  return (
    <main
      className="flex min-h-screen flex-col bg-[hsl(60,100%,99%)]"
      aria-label="Frequently asked questions"
    >
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Server-generated structured data
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schemaData()),
        }}
      />

      <section className="mx-auto max-w-4xl bg-[hsl(60,100%,99%)] py-20 text-center">
        <h1 className="mb-6 font-bold text-5xl text-black leading-tight md:text-6xl">
          Frequently Asked Questions
        </h1>
        <p className="font-medium text-black text-xl leading-relaxed md:text-2xl">
          Everything you need to know about monitoring your LLM citation
          visibility.
        </p>
      </section>

      <FAQQuestions />

      <section className="bg-[hsl(47,100%,95%)] py-20 text-center">
        <h2 className="mb-6 font-bold text-4xl text-black leading-tight md:text-5xl">
          Still have questions?
        </h2>
        <p className="mb-8 font-medium text-black text-xl leading-relaxed">
          Our team is here to help. Reach out and we'll get back to you within
          24 hours.
        </p>
        <ActiveLink
          bg="yellow"
          size="xl"
          to={`mailto:${envVars.EMAIL_FROM.replace("noreply@", "hello@")}?subject=${encodeURIComponent("I have questions")}`}
          variant="button"
        >
          Contact Support
        </ActiveLink>
      </section>
    </main>
  );
}

function FAQQuestions() {
  return (
    <section className="mx-auto max-w-4xl bg-[hsl(60,100%,99%)] py-20">
      <div className="flex flex-col gap-12">
        {faq.map((category) => (
          <div key={category.category}>
            <h2 className="mb-6 font-bold text-3xl text-black leading-tight">
              {category.category}
            </h2>
            <div className="flex flex-col gap-4">
              {category.questions.map((faq) => (
                <FAQItem
                  key={faq.question}
                  question={faq.question}
                  answer={faq.answer}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <details
      className="rounded-md border-2 border-black bg-white shadow-[4px_4px_0px_0px_black]"
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      open
    >
      <summary className="flex w-full cursor-pointer items-center justify-between gap-4 p-6 text-left">
        <h3 className="font-bold text-black text-lg" itemProp="name">
          {question}
        </h3>
        <ChevronDown
          className={twMerge(
            "h-5 w-5 shrink-0 text-[#F59E0B] transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </summary>
      <div className="border-black border-t-2 px-6 pt-4 pb-6">
        <p className="font-medium text-black leading-relaxed" itemProp="text">
          {answer}
        </p>
      </div>
    </details>
  );
}

function schemaData() {
  const mainEntity = faq.flatMap((category) =>
    category.questions.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  );

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity,
  };
}
