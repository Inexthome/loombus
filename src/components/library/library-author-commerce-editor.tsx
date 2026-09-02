"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Props = {
  publicationId: string | null;
  editable: boolean;
  published?: boolean;
  isFree: boolean;
  priceCents: number | null;
  currency: string | null;
  onSaved: () => void | Promise<void>;
};

type PendingCommerce = {
  accessMode: "free" | "paid";
  price: string;
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
  published = false,
  isFree,
  priceCents,
  currency,
  onSaved,
}: Props) {
  const [accessMode, setAccessMode] = useState<"free" | "paid">(isFree ? "free" : "paid");
  const [price, setPrice] = useState(priceInputFromCents(priceCents));
  const [isPublished, setIsPublished] = useState(published);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previousPublicationId = useRef<string | null>(publicationId);
  const pendingCommerce = useRef<PendingCommerce | null>(null);

  useEffect(() => {
    const previousId = previousPublicationId.current;
    previousPublicationId.current = publicationId;

    if (previousId && !publicationId) {
      pendingCommerce.current = null;
      setAccessMode("free");
      setPrice("");
      setIsPublished(false);
      setMessage(null);
      setError(null);
      return;
    }

    const pending = pendingCommerce.current;
    if (!previousId && publicationId && pending && editable && !published) {
      const pendingPriceCents = pending.accessMode === "paid" ? centsFromPriceInput(pending.price) : null;
      if (pending.accessMode === "paid" && pendingPriceCents === null) {
        setAccessMode(pending.accessMode);
        setPrice(pending.price);
        setError("Draft created. Choose a price between $1.00 and $1,000.00, then save the selling settings.");
        pendingCommerce.current = null;
        return;
      }

      pendingCommerce.current = null;
      setSaving(true);
      setMessage(null);
      setError(null);
      void supabase.rpc("update_library_author_draft_commerce", {
        p_publication_id: publicationId,
        p_is_free: pending.accessMode === "free",
        p_price_cents: pending.accessMode === "paid" ? pendingPriceCents : null,
        p_currency: pending.accessMode === "paid" ? "USD" : null,
      }).then(async (result) => {
        if (result.error) {
          console.error("Unable to save initial Library commerce settings.", result.error);
          setAccessMode(pending.accessMode);
          setPrice(pending.price);
          setError("Draft created, but its selling settings could not be saved. Review them and save again.");
          setSaving(false);
          return;
        }
        setAccessMode(pending.accessMode);
        setPrice(pending.price);
        setMessage(pending.accessMode === "free" ? "Draft created as free to read." : `Draft created with a $${pending.price} price.`);
        await onSaved();
        setSaving(false);
      });
      return;
    }

    setAccessMode(isFree ? "free" : "paid");
    setPrice(priceInputFromCents(priceCents));
    setIsPublished(published);
    setMessage(null);
    setError(null);

    if (!publicationId || published) return;
    let cancelled = false;
    void supabase
      .from("library_publications")
      .select("status")
      .eq("id", publicationId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsPublished(data?.status === "published");
      });
    return () => { cancelled = true; };
  }, [publicationId, isFree, priceCents, currency, published, editable, onSaved]);

  const paidPriceCents = useMemo(
    () => (accessMode === "paid" ? centsFromPriceInput(price) : null),
    [accessMode, price]
  );
  const canEditDraftCommerce = Boolean(publicationId && editable && !isPublished);
  const canEditPublishedPrice = Boolean(publicationId && isPublished && !isFree);
  const canConfigureNewDraft = Boolean(!publicationId && !isPublished);

  function chooseAccessMode(next: "free" | "paid") {
    setAccessMode(next);
    setMessage(null);
    setError(null);
    if (!publicationId) pendingCommerce.current = { accessMode: next, price };
  }

  function updatePrice(next: string) {
    setPrice(next);
    setMessage(null);
    setError(null);
    if (!publicationId) pendingCommerce.current = { accessMode, price: next };
  }

  async function saveCommerce() {
    if (!publicationId || saving) return;
    if (accessMode === "paid" && paidPriceCents === null) {
      setError("Choose a price between $1.00 and $1,000.00.");
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);

    if (isPublished) {
      if (!canEditPublishedPrice || paidPriceCents === null) {
        setError("Published access mode is locked. Only the price of an already-paid publication can be changed here.");
        setSaving(false);
        return;
      }
      const result = await supabase.rpc("update_library_author_published_price", {
        p_publication_id: publicationId,
        p_price_cents: paidPriceCents,
        p_currency: "USD",
      });
      if (result.error) {
        console.error("Unable to update published Library price.", result.error);
        setError("Unable to update this published price.");
        setSaving(false);
        return;
      }
      setMessage(`Published price updated to $${price}. Existing purchases keep their original transaction amount.`);
    } else {
      if (!canEditDraftCommerce) {
        setSaving(false);
        return;
      }
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
    }

    await onSaved();
    setSaving(false);
  }

  return (
    <section aria-labelledby="library-commerce-heading" className="library-publish-commerce">
      <div className="library-publish-commerce-heading">
        <div>
          <p className="library-publish-eyebrow">Selling &amp; Access</p>
          <h3 id="library-commerce-heading">{isPublished ? "Manage this publication’s selling price." : "Choose how readers access this publication."}</h3>
        </div>
      </div>

      <p className="library-publish-commerce-copy">
        {isPublished
          ? isFree
            ? "This publication is already published as free. Changing its access mode requires a controlled publishing transition so reader access is not silently revoked."
            : "This paid publication is live. You can change its one-time USD price without unpublishing it. Existing purchases keep the amount and Loombus fee recorded at the time of sale."
          : canConfigureNewDraft
            ? "Choose free or paid access now. Your selection will be saved automatically when you create the draft; paid checkout remains controlled separately by Loombus commerce readiness."
            : "Free publications are readable by Library members. Paid publications use verified Stripe checkout and unlock permanent access on the buyer’s Loombus account."}
      </p>

      <fieldset disabled={saving || isPublished || (!publicationId && !canConfigureNewDraft)} className="library-publish-commerce-fields">
        <label className="library-publish-commerce-option">
          <input type="radio" name={`library-access-${publicationId ?? "new"}`} checked={accessMode === "free"} onChange={() => chooseAccessMode("free")} />
          <span><strong>Free</strong><small>Readers can access the complete publication at no cost.</small></span>
        </label>
        <label className="library-publish-commerce-option">
          <input type="radio" name={`library-access-${publicationId ?? "new"}`} checked={accessMode === "paid"} onChange={() => chooseAccessMode("paid")} />
          <span><strong>Paid</strong><small>Set the one-time price for permanent access.</small></span>
        </label>
      </fieldset>

      {accessMode === "paid" ? (
        <label className="library-publish-field library-publish-commerce-price">
          <span className="library-publish-field-label">Price <span>USD</span></span>
          <span className="library-publish-commerce-price-input">
            <span aria-hidden="true">$</span>
            <input
              inputMode="decimal"
              value={price}
              onChange={(event) => updatePrice(event.target.value)}
              placeholder="9.99"
              aria-label="Publication price in US dollars"
              disabled={saving || (isPublished && isFree) || (!isPublished && publicationId !== null && !editable)}
            />
          </span>
        </label>
      ) : null}

      {error ? <p role="alert" className="library-publish-commerce-error">{error}</p> : null}
      {message ? <p role="status" className="library-publish-commerce-message">{message}</p> : null}

      {publicationId && (canEditDraftCommerce || canEditPublishedPrice) ? (
        <button type="button" disabled={saving} onClick={() => void saveCommerce()} className="library-publish-secondary">
          {saving ? <Loader2 className="library-publish-spinner" aria-hidden="true" /> : <Save aria-hidden="true" />}
          {isPublished ? "Update published price" : "Save selling settings"}
        </button>
      ) : null}
    </section>
  );
}
