import { HeartIcon } from "lucide-react";
import { Link, NavLink } from "react-router";
import CiteMeInLogo from "./CiteMeInLogo";

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
      { to: "/blog", label: "Blog" },
      {
        to: `mailto:${import.meta.env.VITE_EMAIL_FROM}`,
        label: "Contact",
      },
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
    <footer className="flex flex-col gap-8 border-black border-t-2 bg-[hsl(60,100%,99%)] px-6 py-12 text-base text-black sm:flex-row sm:justify-between print:hidden">
      <aside className="flex flex-col gap-4">
        <CiteMeInLogo />
        <div className="flex flex-col gap-2">
          <p className="font-medium">
            Monitor AI citation visibility for your brand. Built for small
            businesses and seasonal sellers. AI powered.
          </p>
          <p className="flex flex-row items-center gap-1 font-medium">
            © {new Date().getFullYear()} cite.me.in
            <HeartIcon className="h-4 w-4 text-red-500" fill="currentColor" />
            Made in Los Angeles, CA.
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
          </nav>
        ))}
      </div>
    </footer>
  );
}

function SocialLinks() {
  return (
    <div className="flex items-center gap-2">
      <Link
        className="inline-flex items-center gap-1 font-medium transition-colors hover:text-[#F59E0B]"
        rel="noopener noreferrer"
        target="_blank"
        to="https://github.com/cite-me-in/cite.me.in"
      >
        <svg
          className="size-4"
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>GitHub</title>
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
        GitHub
      </Link>
    </div>
  );
}
