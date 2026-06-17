type AuthProviderIconProps = {
  className?: string;
};

export function AppleLogoMark({ className = "h-5 w-5" }: AuthProviderIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      focusable="false"
    >
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-2.96 1.78-2.48 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08ZM12.03 7.25C11.88 5.03 13.69 3.18 15.77 3c.29 2.58-2.34 4.5-3.74 4.25Z" />
    </svg>
  );
}

export function GoogleLogoMark({ className = "h-5 w-5" }: AuthProviderIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      focusable="false"
    >
      <path fill="#4285F4" d="M21.6 12.23c0-.74-.07-1.45-.19-2.13H12v4.03h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.32 2.98-7.43Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.34l-3.24-2.51c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.76-5.59-4.12H3.07v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.41 13.98A6.02 6.02 0 0 1 6.09 12c0-.69.12-1.35.32-1.98v-2.6H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.58l3.34-2.6Z" />
      <path fill="#EA4335" d="M12 5.9c1.47 0 2.8.51 3.84 1.51l2.88-2.88C16.98 2.91 14.7 2 12 2a10 10 0 0 0-8.93 5.42l3.34 2.6C7.2 7.66 9.4 5.9 12 5.9Z" />
    </svg>
  );
}
