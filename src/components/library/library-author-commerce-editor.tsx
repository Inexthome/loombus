"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Props = {
  publicationId: string | null;
  editable: boolean;
  isFree: boolean;
  priceCents: number | null;
  currency: string | null;
  onSaved: () => void | Promise<void>;
};

function priceInputFromCents(value: number | null) {
  return value === null ? "" : (value / 100).toFixed(2);
}

function centsFromPriceInput(value: string) {
  const normalized = value.trim();
  if (!/^\d{1,4}(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return null;
  const cents = Math.round(amount * 100);
  return cents >= 100 && cents <= 100000 ? cents : null;
}

export function LibraryAuthorCommerceEditor({
  publicationId,
  editable,
  isFree,
  priceCents,
  currency,
  onSaved,
}: Props) {
  const [accessMode, setAccessMode] = useState<"free" | "paid">(isFree ? "free" : "paid");
  const [price, setPrice] = useState(priceInputFromCents(priceCents));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAccessMode(isFree ? "free" : "paid");
    setPrice(priceInputFromCents(priceCents));
    setMessage(null);
    setError(null);
  }, [publicationId, isFree, priceCents, currency]);

  const paidPriceCents = useMemo(
    () => (accessMode === "paid" ? centsFromPriceInput(price) : null),
    [accessMode, price]
  );

  async function saveCommerce() {
    if (!publicationId || !editable || saving) return;
    if (accessMode === "paid" && paidPriceCents === null) {
      setError("Choose a price between $1.00 and $1,000.00.");
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);

    const result = await supabase.rpc("update_library_author_draft_commerce", {
      p_publication_id: publicationId,
      p_is_free: accessMode === "free",
      p_price_cents: accessMode === "paid" ? paidPriceCents : null,
      p_currency: accessMode === "paid" ? "USD" : null,
    });

    if (result.error) {
      console.error("Unable to save Library commerce settings.", result.error);
      setError("Unable to save selling and access settings in this publication state.");
      setSaving(false);
      return;
    }

    setMessage(accessMode === "free" ? "Publication will be free to read." : `Publication price saved at $${price}.`);
    await onSaved();
    setSaving(false);
  }

  return (
    <section aria-labelledby="library-commerce-heading" className="library-publish-commerce">
      <div className="library-publish-commerce-heading">
        <div>
          <p className="library-publish-eyebrow">Selling &amp; Access</p>
          <h3 id="library-commerce-heading">Choose how readers access this publication.</h3>
        </div>
      </div>

      <p className="library-publish-commerce-copy">
        Free publications are readable by every signed-in Library member. Paid publications require a completed purchase before full-text access. Checkout activation is a separate controlled release.
      </p>

      <fieldset disabled={!editable || saving || !publicationId} className="library-publish-commerce-fields">
        <label className="library-publish-commerce-option">
          <input
            type="radio"
            name={`library-access-${publicationId ?? "new"}`}
            checked={accessMode === "free"}
            onChange={() => setAccessMode("free")}
          />
          <span>
            <strong>Free</strong>
            <small>Readers can access the complete publication at no cost.</small>
          </span>
        </label>

        <label className="library-publish-commerce-option">
          <input
            type="radio"
            name={`library-access-${publicationId ?? "new"}`}
            checked={accessMode === "paid"}
            onChange={() => setAccessMode("paid")}
          />
          <span>
            <strong>Paid</strong>
            <small>Set the one-time price for permanent access.</small>
          </span>
        </label>

        {accessMode === "paid" ? (
          <label className="library-publish-field library-publish-commerce-price">
            <span className="library-publish-field-label">Price <span>USD</span></span>
            <span className="library-publish-commerce-price-input">
              <span aria-hidden="true">$</span>
              <input
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="9.99"
                aria-label="Publication price in US dollars"
              />
            </span>
          </label>
        ) : null}
      </fieldset>

      {error ? <p role="alert" className="library-publish-commerce-error">{error}</p> : null}
      {message ? <p role="status" className="library-publish-commerce-message">{message}</p> : null}

      {publicationId && editable ? (
        <button type="button" disabled={saving} onClick={() => void saveCommerce()} className="library-publish-secondary">
          {saving ? <Loader2 className="library-publish-spinner" aria-hidden="true" /> : <Save aria-hidden="true" />}
          Save selling settings
        </button>
      ) : null}
    </section>
  );
}
