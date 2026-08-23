"use client";

import { BookOpen, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const COVER_BUCKET = "library-publication-covers";

type Props = {
  storagePath: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
};

export function LibraryCoverImage({ storagePath, alt, className = "h-full w-full object-cover", fallbackClassName = "h-5 w-5" }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(storagePath));

  useEffect(() => {
    let cancelled = false;
    let nextUrl: string | null = null;

    async function loadCover() {
      if (!storagePath) {
        setObjectUrl(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase.storage.from(COVER_BUCKET).download(storagePath);
      if (cancelled) return;
      if (error || !data) {
        setObjectUrl(null);
        setLoading(false);
        return;
      }

      nextUrl = URL.createObjectURL(data);
      setObjectUrl(nextUrl);
      setLoading(false);
    }

    void loadCover();
    return () => {
      cancelled = true;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [storagePath]);

  if (loading) return <Loader2 className={`${fallbackClassName} animate-spin`} aria-label="Loading publication cover" />;
  if (!objectUrl) return <BookOpen className={fallbackClassName} aria-hidden="true" />;
  return <img src={objectUrl} alt={alt} className={className} />;
}
