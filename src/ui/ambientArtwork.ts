import { safeUrl } from "../utils/format";

export function refreshAmbientArtwork(artwork?: string): void {
  if (!artwork) return;
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = safeUrl(artwork);
  image.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 24;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(image, 0, 0, 24, 24);
      const pixels = context.getImageData(0, 0, 24, 24).data;
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let index = 0; index < pixels.length; index += 16) {
        const brightness = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
        if (brightness < 220 && brightness > 18) {
          r += pixels[index];
          g += pixels[index + 1];
          b += pixels[index + 2];
          count++;
        }
      }
      if (!count) return;
      document.documentElement.style.setProperty("--ambient-color", `rgb(${Math.round(r / count * 0.42)}, ${Math.round(g / count * 0.42)}, ${Math.round(b / count * 0.42)})`);
    } catch {
      // Artwork sampling can fail for cross-origin images; keep the fallback palette.
    }
  };
}
