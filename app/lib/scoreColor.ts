type RGB = [number, number, number];

const PINK_RED: RGB = [255, 77, 109];
const CALM_YELLOW: RGB = [255, 195, 0];
const LIGHT_GREEN: RGB = [82, 183, 136];

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function rgbToHex([r, g, b]: RGB) {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export default function scoreColor(value: number): string {
  const t = Math.max(0, Math.min(100, value)) / 100;

  const rgb =
    t <= 0.5
      ? lerpRGB(PINK_RED, CALM_YELLOW, t * 2)
      : lerpRGB(CALM_YELLOW, LIGHT_GREEN, (t - 0.5) * 2);

  return rgbToHex(rgb);
}
