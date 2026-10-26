/**
 * A phone photo made small in the browser before it's sent (#121): a 12
 * to 50 megapixel camera JPEG is 3 to 12 MB, past the web host's 4.5 MB
 * request cap, and the weather service keeps it at 1,280 px anyway.
 *
 * Drawn upright (the camera's EXIF orientation applied) onto a canvas at
 * most `edge` px across and saved as a JPEG. Anything the browser can't
 * decode or draw is sent as it is, and the weather service says if it
 * can't use it.
 */
export async function downscalePhoto(file: File, edge = 1600): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}
