"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { VillageAirportResponse } from "@/lib/api/types";
import { downscalePhoto } from "@/lib/images/downscale";

import {
  fileVillageReportAction,
  type VillageActionState,
} from "@/app/(app)/village-wx/actions";

const CLOUD_COVERS: { value: string; label: string }[] = [
  { value: "", label: "— Pick if known —" },
  { value: "SKC", label: "SKC — sky clear" },
  { value: "CLR", label: "CLR — clear below 12k" },
  { value: "FEW", label: "FEW — few" },
  { value: "SCT", label: "SCT — scattered" },
  { value: "BKN", label: "BKN — broken" },
  { value: "OVC", label: "OVC — overcast" },
  { value: "VV", label: "VV — vertical visibility" },
];

export function AddReportDialog({
  airports,
  defaultAirportId,
}: {
  airports: VillageAirportResponse[];
  defaultAirportId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<
    VillageActionState,
    FormData
  >(fileVillageReportAction, { status: "idle" });
  // The photos to send with the report (#121), once it's filed; and how
  // that went.
  const [photos, setPhotos] = useState<File[]>([]);
  const [sending, setSending] = useState<string | null>(null);
  const [unsent, setUnsent] = useState<string[]>([]);
  // Each filing is handled once: clearing the photos after sending, or
  // picking new ones after an earlier report, must not act on it again.
  const handled = useRef<VillageActionState | null>(null);

  const close = () => {
    setOpen(false);
    setPhotos([]);
    setUnsent([]);
  };

  useEffect(() => {
    if (state.status !== "ok" || handled.current === state) return;
    handled.current = state;
    const reportId = state.reportId;
    if (!reportId || photos.length === 0) {
      setOpen(false);
      return;
    }
    void (async () => {
      const failed: string[] = [];
      for (const [index, photo] of photos.entries()) {
        setSending(`Sending photo ${index + 1} of ${photos.length}…`);
        try {
          const body = new FormData();
          body.append("photo", await downscalePhoto(photo), photo.name || "photo.jpg");
          const response = await fetch(`/api/village-reports/${reportId}/photos`, { method: "POST", body });
          if (!response.ok) {
            const detail = (await response.json().catch(() => ({}))).detail;
            failed.push(`${photo.name || `Photo ${index + 1}`}: ${photoRefusal(detail, response.status)}`);
          }
        } catch {
          failed.push(`${photo.name || `Photo ${index + 1}`}: no connection`);
        }
      }
      setSending(null);
      setPhotos([]);
      router.refresh();
      if (failed.length) setUnsent(failed);
      else setOpen(false);
    })();
  }, [state, photos, router]);

  const fieldError = (key: string) =>
    state.status === "field-errors" ? state.errors[key] : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={airports.length === 0}
        title={
          airports.length === 0 ? "Add an airport first" : undefined
        }
        className="btn-caps inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50 text-[0.72rem]"
      >
        + Add Report
      </button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (pending || sending !== null) return;
          if (o) setOpen(true);
          else close();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>File a village weather report</DialogTitle>
            <DialogDescription>
              Quick observation — only the airport is required. Fill the
              fields you actually know; the server stamps the flight
              category (VFR / MVFR / IFR / LIFR) from ceiling + visibility.
            </DialogDescription>
          </DialogHeader>

          <form action={action} className="space-y-4">
            {state.status === "api-error" && (
              <div
                role="alert"
                className="notice notice-red"
              >
                {state.message}
              </div>
            )}

            <Select
              name="village_airport_id"
              label="Airport"
              required
              defaultValue={defaultAirportId ?? ""}
              error={fieldError("village_airport_id")}
              options={[
                { value: "", label: "— Select airport —" },
                ...airports.map((a) => ({
                  value: a.id,
                  label: `${a.icao} — ${a.name}`,
                })),
              ]}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <Select
                name="cloud_cover"
                label="Cloud cover"
                options={CLOUD_COVERS}
                error={fieldError("cloud_cover")}
              />
              <Field
                name="ceiling_ft"
                label="Ceiling (ft AGL)"
                type="number"
                placeholder="1000"
                min={0}
                max={50000}
                error={fieldError("ceiling_ft")}
              />
              <Field
                name="visibility_sm"
                label="Visibility (SM)"
                type="number"
                step="0.25"
                placeholder="3"
                min={0}
                max={99}
                error={fieldError("visibility_sm")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                name="wind_dir_deg"
                label="Wind direction (°)"
                type="number"
                placeholder="180"
                min={0}
                max={360}
                error={fieldError("wind_dir_deg")}
              />
              <Field
                name="wind_speed_kt"
                label="Wind speed (kt)"
                type="number"
                placeholder="12"
                min={0}
                max={200}
                error={fieldError("wind_speed_kt")}
              />
              <Field
                name="wind_gust_kt"
                label="Wind gust (kt)"
                type="number"
                placeholder="18"
                min={0}
                max={200}
                error={fieldError("wind_gust_kt")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="temperature_c"
                label="Temperature (°C)"
                type="number"
                placeholder="-5"
                min={-90}
                max={60}
                error={fieldError("temperature_c")}
              />
              <Field
                name="altimeter_in_hg"
                label="Altimeter (inHg)"
                type="number"
                step="0.01"
                placeholder="29.92"
                min={25}
                max={33}
                error={fieldError("altimeter_in_hg")}
              />
            </div>

            <div>
              <label
                htmlFor="notes"
                className="field-label"
              >
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                placeholder="Light snow showers; runway packed"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            {/* #121: visibility, clouds, the runway. Not part of the
                form's data: they go one at a time once the report is filed. */}
            <div>
              <label htmlFor="report-photos" className="field-label">
                Photos
              </label>
              <input
                id="report-photos"
                type="file"
                // As for ramp photos: not image/*, so iOS turns a camera
                // HEIC into a JPEG and a desktop picker greys out the HEIC
                // files most browsers can't show.
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, 6))}
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs text-foreground"
              />
              <p className="mt-1 text-[0.65rem] text-muted-foreground">
                {photos.length
                  ? `${photos.length} photo${photos.length === 1 ? "" : "s"} to send with the report.`
                  : "Up to six: visibility, clouds, the runway. Dispatch and the pilots see them on the packet."}
              </p>
            </div>

            {sending ? (
              <p role="status" className="text-xs text-muted-foreground">
                {sending}
              </p>
            ) : null}
            {unsent.length ? (
              <div role="alert" className="notice notice-yellow text-xs">
                <p className="notice-label">Report filed; not every photo went</p>
                <ul className="mt-1">
                  {unsent.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <DialogFooter>
              <button
                type="button"
                onClick={close}
                disabled={pending || sending !== null}
                className="btn-caps rounded-md border border-input px-3 py-2 text-foreground hover:bg-accent text-[0.72rem]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || sending !== null || unsent.length > 0}
                className="btn-caps inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-60 text-[0.72rem]"
              >
                {(pending || sending) && <Spinner size="xs" />}
                {pending ? "Filing…" : sending ? "Sending photos…" : "File report"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  name,
  label,
  error,
  ...inputProps
}: React.InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  error?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="field-label"
      >
        {label}
        {inputProps.required && <span className="text-status-red"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={error ? "true" : undefined}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none aria-[invalid=true]:border-status-red"
        {...inputProps}
      />
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

function Select({
  name,
  label,
  required,
  defaultValue,
  options,
  error,
}: {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
  options: readonly { value: string; label: string }[];
  error?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="field-label"
      >
        {label}
        {required && <span className="text-status-red"> *</span>}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        required={required}
        aria-invalid={error ? "true" : undefined}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none aria-[invalid=true]:border-status-red"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** Why the weather service didn't take a photo, in the dialog's words. */
function photoRefusal(detail: unknown, status: number): string {
  switch (detail) {
    case "content_type_must_be_image":
      return "not a picture";
    case "photo_must_be_jpeg_png_webp_or_gif":
      return "a format browsers can't show; take it as a JPEG";
    case "photo_exceeds_15mb":
    case "photo_too_large":
      return "too large";
    case "photo_unreadable":
      return "couldn't be read as a picture";
    case "too_many_photos":
      return "six photos at most";
    default:
      // A 413 without a reason is the web host's own request cap.
      if (status === 413) return "too large";
      return status === 401 ? "signed out" : `not taken (HTTP ${status})`;
  }
}

