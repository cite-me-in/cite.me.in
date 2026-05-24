import { useEffect, useRef } from "react";
import { twMerge } from "tailwind-merge";

/**
 * A loading image component that displays a placeholder image until the actual
 * image loads.  Use this for any image of substantial size.
 *
 * @param alt - The alt text for the image.
 * @param figureClassName - The class name for the figure element.
 * @param maxHeight - The maximum height of the image.
 * @param minHeight - The minimum height of the image.
 * @param src - The source of the image.
 */
export default function LoadingImage({
  alt,
  figureClassName,
  maxHeight,
  minHeight = maxHeight,
  src,
}: {
  alt: string;
  figureClassName?: string;
  maxHeight: number;
  minHeight?: number;
  src: string;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // NOTE React doesn't fire onLoad for SSR, so we need this hack.
    if (imgRef.current?.complete) {
      imgRef.current.classList.remove("opacity-0");
      imgRef.current.className = imgRef.current.className.trim();
    }
  }, []);

  return (
    <figure
      className={twMerge("w-full overflow-hidden", figureClassName)}
      style={{
        background:
          "repeating-linear-gradient(135deg, #e5e7eb 0 24px, #fff 24px 48px)",
        maxHeight,
        minHeight,
      }}
    >
      <img
        alt={alt}
        className={twMerge(
          "h-full w-full object-cover object-center",
          !import.meta.env.VITE_TEST_MODE && "opacity-0",
        )}
        onError={(e) => {
          e.currentTarget.remove();
        }}
        onLoad={(e) => {
          e.currentTarget.classList.remove("opacity-0");
        }}
        ref={imgRef}
        src={src}
      />
    </figure>
  );
}
