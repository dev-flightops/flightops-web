/**
 * Where Home and the branding preview load the company's picture from
 * (#118; uploads since Greg's 13 Nov "both all possible"): an uploaded
 * picture through this app's route, since an <img> can't carry the token,
 * addressed by its upload time so a new picture is never an old cached
 * one; else the company's link; else none.
 */
export function homeImageSource(
  profile: { home_image_url?: string | null; home_image_uploaded_at?: string | null } | null | undefined,
): string | null {
  if (profile?.home_image_uploaded_at) {
    return uploadedHomeImageSource(profile.home_image_uploaded_at);
  }
  return profile?.home_image_url?.trim() || null;
}

export function uploadedHomeImageSource(uploadedAt: string): string {
  return `/api/branding/home-image?v=${encodeURIComponent(uploadedAt)}`;
}
