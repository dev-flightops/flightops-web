/**
 * Sending a large file straight to storage from the browser (#17).
 *
 * The web host caps a request at 4.5 MB, so a 50 MB manual can't go
 * through a server action. The documents service hands out a presigned
 * URL instead, and the browser PUTs the file there itself.
 *
 * XMLHttpRequest rather than fetch: fetch reports no upload progress,
 * and a 50 MB file needs a bar. The headers come with the URL and are
 * signed into it, so they are sent exactly as given.
 */

export class DirectUploadError extends Error {}

export function putToStorage(
  url: string,
  headers: Record<string, string>,
  file: Blob,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new DirectUploadError(`Storage refused the file (HTTP ${xhr.status}). Try again.`));
    };
    // A CORS refusal looks exactly like this too: the browser hides why.
    xhr.onerror = () => reject(new DirectUploadError("The file couldn't be sent to storage. Check the connection and try again."));
    xhr.ontimeout = () => reject(new DirectUploadError("Sending the file timed out. Try again."));
    xhr.send(file);
  });
}
