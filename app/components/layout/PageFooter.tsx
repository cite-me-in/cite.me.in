import { NavLink } from "react-router";
import MailtoLink from "~/components/ui/MailtoLink";
import socialLinks from "~/lib/socialLinks";
import { ActiveLink } from "../ui/ActiveLink";

const links = [
  {
    title: "Product",
    links: [
      { to: "/pricing", label: "Pricing" },
      { to: "/faq", label: "FAQ" },
      { to: "/docs", label: "API Docs" },
    ],
  },
  {
    title: "Resources",
    links: [
      { to: "/about", label: "About" },
      { to: "https://blog.cite.me.in", label: "Blog" },
      { to: "/visibility-score", label: "Visibility Score" },
      { to: "https://blog.cite.me.in/changelog", label: "Changelog" },
    ],
  },
  {
    title: "Legal",
    links: [
      { to: "/privacy", label: "Privacy Policy" },
      { to: "/terms", label: "Terms of Service" },
    ],
  },
];

export default function PageFooter() {
  return (
    <footer className="flex flex-col gap-8 border-t-2 border-black bg-[hsl(60,100%,99%)] px-6 py-12 text-base text-black sm:flex-row sm:justify-between print:hidden">
      <aside className="flex flex-col gap-4">
        <a href="/">
          <img src="/pixel.png" alt="cite.me.in" height={32} width={139} />
        </a>
        <div className="flex flex-col gap-2">
          <p className="font-medium">
            Monitor AI citation visibility for your brand. Built for small
            businesses and seasonal sellers. AI powered.
          </p>
          <p className="flex flex-row items-center gap-1 font-medium">
            © {new Date().getFullYear()} cite.me.in &mdash; Squirrel-brain
            friendly 🐿️
          </p>
        </div>
        <SocialLinks />
      </aside>

      <div className="mx-auto grid w-full grid-cols-3 gap-4 md:max-w-1/2">
        {links.map((column) => (
          <nav key={column.title} className="flex flex-col gap-2">
            <h3 className="flex flex-col gap-4 font-bold">{column.title}</h3>
            {column.links.map((link) => (
              <NavLink
                aria-label={`Go to ${link.label} page`}
                className="font-medium transition-colors hover:text-[#F59E0B]"
                key={link.to}
                to={link.to}
              >
                {link.label}
              </NavLink>
            ))}
            {column.title === "Resources" && (
              <MailtoLink
                email={import.meta.env.VITE_EMAIL_FROM}
                variant="footer"
                aria-label="Contact us by email"
              >
                Contact
              </MailtoLink>
            )}
          </nav>
        ))}
      </div>
    </footer>
  );
}

function SocialLinks() {
  return (
    <div className="flex items-center gap-8">
      {socialLinks.map(({ name, url, icon }) => (
        <ActiveLink key={url} target="_blank" to={url} variant="silent">
          {icon}
          {name}
        </ActiveLink>
      ))}
    </div>
  );
}
