import { TrendingUpIcon } from "lucide-react";
import MailtoLink from "~/components/ui/MailtoLink";
import { ActiveLink } from "~/components/ui/ActiveLink";

export default function AboutCTA() {
  return (
    <section className="bg-[hsl(47,100%,95%)] px-5 py-20">
      <div className="container mx-auto max-w-3xl text-center">
        <div className="mb-8 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-md border-2 border-black bg-[#F59E0B] shadow-[4px_4px_0px_0px_black]">
            <TrendingUpIcon className="h-10 w-10 text-black" />
          </div>
        </div>
        <h2 className="mb-6 font-bold text-4xl text-black leading-tight md:text-5xl">
          Start monitoring your citations
        </h2>
        <p className="mb-8 font-medium text-black text-xl leading-relaxed">
          Find out if AI platforms are citing your domain — and track whether
          that's improving over time.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <ActiveLink variant="button" to="/sign-up" bg="yellow" size="xl">
            Get Started Free
          </ActiveLink>
          <MailtoLink
            className="px-8"
            email={import.meta.env.VITE_EMAIL_FROM}
            size="xl"
            variant="button"
          >
            Get in Touch
          </MailtoLink>
        </div>
      </div>
    </section>
  );
}
