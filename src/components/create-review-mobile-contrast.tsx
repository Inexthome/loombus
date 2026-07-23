export function CreateReviewMobileContrast() {
  return (
    <style>{`
      main aside > section:last-of-type button[type="button"]:first-of-type {
        background-color: #CBAB5B !important;
        background-image: none !important;
        border-color: #CBAB5B !important;
        color: #17140c !important;
        -webkit-text-fill-color: #17140c !important;
        opacity: 1 !important;
      }

      main aside > section:last-of-type button[type="button"]:first-of-type svg {
        color: #17140c !important;
        stroke: #17140c !important;
      }

      main aside > section:last-of-type button[type="button"]:first-of-type:disabled {
        background-color: #CBAB5B !important;
        border-color: #CBAB5B !important;
        color: #17140c !important;
        -webkit-text-fill-color: #17140c !important;
        opacity: 0.7 !important;
      }
    `}</style>
  );
}
