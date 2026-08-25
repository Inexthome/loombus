import { LibraryFunctionalSurface } from "@/components/library/library-functional-surface";
import { LibraryMobileImmersiveShell } from "@/components/library/library-mobile-immersive-shell";

export default function LibraryPage() {
  return (
    <LibraryMobileImmersiveShell>
      <LibraryFunctionalSurface />
    </LibraryMobileImmersiveShell>
  );
}
