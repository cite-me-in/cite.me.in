export default function base64ToBlob(dataUrl: string) {
  const [header, base64] = dataUrl.split(",", 2);
  const mime = header?.split(";")[0]?.split(":")[1] ?? "image/png";
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
