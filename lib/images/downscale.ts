/**
 * A phone photo made small in the browser before it's sent (#121): a 12
 * to 50 megapixel camera JPEG is 3 to 12 MB, past the web host's 4.5 MB
 * request cap, and the weather service keeps it at 1,280 px anyway.
 *
 * Drawn upright (the camera's EXIF orientation applied) onto a canvas at
 * most `edge` px across and saved as a JPEG. Anything the browser can't
 * decode or draw is sent as it is, and the weather service says if it
 * can't use it.
 *
 * With `maxBytes` (the Home picture, which passes a gateway that takes
 * 1 MB): a detailed photo can stay larger than that at a good quality, so
 * the quality steps down, then the size, until it fits.
 */
export async function downscalePhoto(file: File, edge = 1600, maxBytes = Infinity): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      let longest = Math.min(edge, Math.max(bitmap.width, bitmap.height));
      let smallest: Blob | null = null;
      for (let round = 0; round < 3; round++) {
        const scale = longest / Math.max(bitmap.width, bitmap.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d");
        if (!context) return smallest ?? file;
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        for (const quality of [0.85, 0.7, 0.55]) {
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
          if (!blob) return smallest ?? file;
          smallest = blob;
          if (blob.size <= maxBytes) return blob;
        }
        longest = Math.round(longest * 0.75);
      }
      return smallest ?? file;
    } finally {
      bitmap.close?.();
    }
  } catch {
    return file;
  }
}
