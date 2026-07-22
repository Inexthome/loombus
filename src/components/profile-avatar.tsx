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

export function getProfileInitials(profile: ProfileAvatarProfile) {
  const label = profile?.full_name?.trim() || profile?.username?.trim() || "L";

  const parts = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts
    .map((part) => part[0]?.toUpperCase())
    .join("") || "L";
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
  const avatarUrl = profile?.avatar_url?.trim();

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] font-medium text-[var(--loombus-text-muted)] ${sizeClasses[size]}`}
      aria-hidden="true"
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        getProfileInitials(profile)
      )}
    </span>
  );
}
