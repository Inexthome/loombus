export default function CreateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <style>{`
        body:has(.loombus-create-canonical-v2-route) .loombus-desktop-rail,
        body:has(.loombus-create-canonical-v2-route) header,
        body:has(.loombus-create-canonical-v2-route) .loombus-mobile-bottom-nav,
        body:has(.loombus-create-canonical-v2-route) .loombus-bottom-nav,
        body:has(.loombus-create-canonical-v2-route) .loombus-mobile-menu,
        body:has(.loombus-create-canonical-v2-route) .loombus-floating-top-nav,
        body:has(.loombus-create-canonical-v2-route) .loombus-floating-bottom-nav {
          display: none !important;
        }
      `}</style>
      <div className="loombus-create-canonical-v2-route">{children}</div>
    </>
  );
}
