import Link from "next/link";
import type { ReactNode } from "react";

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "muted";
  className?: string;
};

const variantClass = {
  primary: "bg-white text-black hover:bg-zinc-200",
  secondary: "border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white",
  muted: "border border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-white",
};

export function ButtonLink({
  href,
  children,
  variant = "secondary",
  className = "",
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex rounded-full px-5 py-3 text-sm transition ${variantClass[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
