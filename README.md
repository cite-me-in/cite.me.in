# Cite.me.in

![Cite.me.in — Monitor LLM citation visibility](public/og-image.png)

**Monitor your brand's visibility in AI-generated responses.**

Cite.me.in tracks when and where AI platforms — ChatGPT, Claude, Gemini, Perplexity — cite your website in their answers. Think of it as Google Search Console, but for LLMs.

## What it does

Cite.me.in runs predefined search queries against major AI platforms (with web search enabled) and records every citation — every URL that appears in a response. Over time you see which platforms cite you, which queries trigger citations, and how your visibility changes week over week.

## How it started

Cite.me.in grew out of [Rentail](https://rentail.space), a platform for finding temporary retail space in shopping centers. Users kept mentioning they'd found Rentail through ChatGPT or Perplexity, but there was no way to verify that or track it consistently. A quick monitoring script turned into a proper product when it became clear the problem wasn't unique to Rentail — every brand building an online presence needs to know whether AI platforms are citing them.

## For contributors and AI assistants

See [CLAUDE.md](CLAUDE.md) for commands, architecture, and coding conventions.

## Dependencies

### Front-end

Generally speaking, being a React app we use [React
Router](https://reactrouter.com)) for web-app and [React
Email](https://react.email) for sending emails.

UI components are generated using [shadcn/ui](https://ui.shadcn.com), which
relies on naked components from [Base UI](https://base-ui.com), which are
typically styled using the [Neobrutalism](https://www.neobrutalism.dev) look.

CSS styling is handled by [Tailwind CSS](https://tailwindcss.com) with light
[animations](https://github.com/Wombosvideo/tw-animate-css).

Common utility functions using [es-toolkit](https://es-toolkit.dev) and React
hooks with [usehooks-ts](https://usehooks-ts.com). Document schema validation
with the help of [ZOD](https://zod.dev)

- [Base UI](https://base-ui.com)
- [es-toolkit](https://es-toolkit.dev)
- [Lucide React](https://lucide.dev)
- [Neobrutalism](https://www.neobrutalism.dev)
- [React Email](https://react.email)
- [React Router](https://reactrouter.com)
- [Recharts](https://recharts.github.io)
- [respinner](https://respinner.vercel.app)
- [shadcn/ui](https://ui.shadcn.com)
- [Tailwind CSS animate](https://github.com/Wombosvideo/tw-animate-css)
- [Tailwind CSS](https://tailwindcss.com)
- [usehooks-ts](https://usehooks-ts.com)
- [ZOD](https://zod.dev)

### Back-end

The back-end uses [Prisma](https://www.prisma.io) as the ORM for database
access, with [PostgreSQL](https://www.postgresql.org) as the primary database.

For querying AI platforms, we use the [Vercel AI SDK](https://sdk.vercel.ai)
with provider-specific integrations for [OpenAI](https://openai.com),
[Anthropic](https://www.anthropic.com), [Google](https://ai.google.dev), and
[Perplexity](https://www.perplexity.ai).

Session and caching layer is handled by [Redis](https://redis.io) with
[ioredis](https://github.com/luin/ioredis) as the client. Password hashing uses
[bcryptjs](https://github.com/dcodeIO/bcrypt.js), and emails are sent through
[Resend](https://resend.com). Markdown content is parsed using
[marked](https://marked.js.org).

- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-python)
- [bcryptjs](https://github.com/dcodeIO/bcrypt.js)
- [Google Generative AI](https://ai.google.dev)
- [ioredis](https://github.com/luin/ioredis)
- [marked](https://marked.js.org)
- [OpenAI SDK](https://openai.com)
- [Perplexity SDK](https://docs.perplexity.ai)
- [PostgreSQL](https://www.postgresql.org)
- [Prisma](https://www.prisma.io)
- [Resend](https://resend.com)
- [Vercel AI SDK](https://sdk.vercel.ai)
