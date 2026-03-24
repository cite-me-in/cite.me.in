import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

export default function PageAnalytics() {
  return (
    <>
      <GoogleAnalytics />
      <Analytics />
      <SpeedInsights />
      <Agent404 />
    </>
  );
}

function Agent404() {
  // @see https://www.agent404.dev
  return (
    <script
      src="https://agent404.dev/agent-404.min.js"
      data-site-id="e0fe3f86-7e02-4abf-be19-f3055b4026f0"
      data-api-key="key_b4a80066ecff4caf8ece40f3a6c19cb0"
      defer
    />
  );
}

function GoogleAnalytics() {
  return (
    <>
      <script
        async
        src="https://www.googletagmanager.com/gtag/js?id=G-MW5FD65Q2W"
      />
      <script>
        {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-MW5FD65Q2W');`}
      </script>
    </>
  );
}
