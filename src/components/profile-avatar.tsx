type ProfileAvatarProfile = {
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
} | null | undefined;

type ProfileAvatarSize = "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<ProfileAvatarSize, string> = {
  sm: "h-9 w-9 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-11 w-11 text-sm",
  xl: "h-12 w-12 text-base",
};

function getSafeAvatarUrl(value: string | null | undefined) {
  const rawValue = value?.trim();

  if (!rawValue) {
    return null;
  }

  try {
    const url = new URL(rawValue);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function getSafeInitial(value: string | undefined) {
  const initial = value?.trim().charAt(0).toUpperCase();

  if (!initial || !/^[A-Z0-9]$/.test(initial)) {
    return "L";
  }

  return initial;
}

export function getProfileInitials(profile: ProfileAvatarProfile) {
  const label = profile?.full_name?.trim() || profile?.username?.trim() || "L";

  const parts = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  const initials = parts.map(getSafeInitial).join("");

  return initials || "L";
}

export function getProfileDisplayName(
  profile: ProfileAvatarProfile,
  fallback = "Loombus member"
) {
  return profile?.full_name || (profile?.username ? `@${profile.username}` : fallback);
}

export function ProfileAvatar({
  profile,
  size = "lg",
}: {
  profile: ProfileAvatarProfile;
  size?: ProfileAvatarSize;
}) {
  const safeAvatarUrl = getSafeAvatarUrl(profile?.avatar_url);
  const initials = getProfileInitials(profile);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-800 bg-black font-medium text-zinc-300 ${sizeClasses[size]}`}
      aria-hidden="true"
    >
      {safeAvatarUrl ? (
        <img
          src={safeAvatarUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span>{initials}</span>
      )}
    </span>
  );
}
