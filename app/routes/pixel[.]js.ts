export function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const apiKey = url.searchParams.get("key");

  if (!apiKey) {
    return new Response("Missing API key", {
      status: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  return new Response(
    `
const img = document.createElement("img");
img.src = "${import.meta.env.VITE_APP_URL}/pixel.png";
img.alt = "cite.me.in";
img.height = 32;
img.width = 139;
const anchor = document.createElement("a");
anchor.href = "${import.meta.env.VITE_APP_URL}";
anchor.target = "_blank";
anchor.rel = "noopener noreferrer";
anchor.appendChild(img);
document.currentScript.parentElement.insertBefore(anchor, document.currentScript);

var xhr = new XMLHttpRequest();
xhr.open("POST", "${import.meta.env.VITE_APP_URL}/api/track", true);
xhr.setRequestHeader("Content-Type", "application/json");
xhr.send(
  JSON.stringify({
    apiKey: "${apiKey}",
    referer: document.referrer,
    url: document.location.href,
    userAgent: navigator.userAgent,
  }),
);
xhr.onerror = function() {
  console.error("Error tracking visit");
};
`,
    {
      headers: {
        "Content-Type": "application/javascript",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    },
  );
}
