/**
 * @see https://lucide.dev/guide/react/advanced/aliased-names
 */
declare module "lucide-react" {
  // biome-ignore lint/performance/noReExportAll: we need to export all the icons
  export * from "lucide-react/dist/lucide-react.suffixed";
}
