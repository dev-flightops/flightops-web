/** The bar under a large upload (#17): a 50 MB manual takes a while. */
export function UploadProgress({ fraction }: { fraction: number }) {
  const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return (
    <div>
      <div
        role="progressbar"
        aria-label="Upload progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-[0.65rem] text-muted-foreground">
        {percent < 100 ? `Sending to storage… ${percent}%` : "Adding the version…"}
      </p>
    </div>
  );
}
