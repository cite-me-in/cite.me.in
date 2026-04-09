export async function loader() {
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
    referer: document.referrer,
    url: document.location.href,
    userAgent: navigator.userAgent,
  }),
);
`,
    { headers: { "Content-Type": "application/javascript" } },
  );
}
