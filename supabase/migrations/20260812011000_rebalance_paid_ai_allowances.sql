-- Launch-year subscription runtime enforcement: rebalance paid AI allowances.
--
-- Premium moves to 150 / 75 / 30 / 75 monthly actions and Premium Pro moves
-- to 300 / 150 / 60 / 150. Billing activation reads the same canonical
-- constants in application code; this migration brings already-active paid
-- entitlement rows forward without changing the legacy stored tier value.
--
-- IMPORTANT: update legacy Pro rows first. The new Premium allowance equals
-- the old Pro allowance, so reversing this order would collapse the distinction
-- between the two plans during the backfill.

update public.user_ai_entitlements
set
  monthly_summary_limit = 300,
  monthly_writing_limit = 150,
  monthly_research_limit = 60,
  monthly_discovery_limit = 150,
  updated_at = now()
where ai_assisted_enabled is true
  and coalesce(lower(tier), '') <> 'admin'
  and (
    lower(coalesce(tier, '')) in ('pro', 'premium_pro', 'premium_plus')
    or lower(coalesce(notes, '')) like '%premium pro%'
    or lower(coalesce(notes, '')) like '%premium plus%'
    or (
      coalesce(monthly_summary_limit, 0) = 150
      and coalesce(monthly_writing_limit, 0) = 75
      and coalesce(monthly_research_limit, 0) = 30
      and coalesce(monthly_discovery_limit, 0) = 75
    )
  );

update public.user_ai_entitlements
set
  monthly_summary_limit = 150,
  monthly_writing_limit = 75,
  monthly_research_limit = 30,
  monthly_discovery_limit = 75,
  updated_at = now()
where ai_assisted_enabled is true
  and coalesce(lower(tier), '') <> 'admin'
  and coalesce(monthly_summary_limit, 0) = 50
  and coalesce(monthly_writing_limit, 0) = 25
  and coalesce(monthly_research_limit, 0) = 10
  and coalesce(monthly_discovery_limit, 0) = 25;
