-- Launch-year subscription runtime enforcement: rebalance paid AI allowances.
--
-- Premium moves to 150 / 75 / 30 / 75 monthly actions and Premium Pro moves
-- to 300 / 150 / 60 / 150. Billing activation reads the same canonical
-- constants in application code; this migration brings already-active paid
-- entitlement rows forward without changing the legacy stored tier value.
--
-- The first run happens before user_general_subscriptions exists, so it uses
-- the historical plan label/tier plus the old allowance signature and records
-- a durable backfill marker. If this SQL is ever manually replayed after the
-- provider-neutral subscription migration exists, canonical subscription rows
-- are authoritative instead of inferring plan identity from allowance values.

do $$
begin
  if to_regclass('public.user_general_subscriptions') is not null then
    -- Replay path: canonical provider-neutral billing state is available.
    update public.user_ai_entitlements e
    set
      monthly_summary_limit = 300,
      monthly_writing_limit = 150,
      monthly_research_limit = 60,
      monthly_discovery_limit = 150,
      notes = case
        when lower(coalesce(e.notes, '')) like '%[ai-allowance-backfill:pro]%'
          then e.notes
        else trim(concat_ws(' ', nullif(trim(e.notes), ''), '[ai-allowance-backfill:pro]'))
      end,
      updated_at = now()
    where e.ai_assisted_enabled is true
      and coalesce(lower(e.tier), '') <> 'admin'
      and exists (
        select 1
        from public.user_general_subscriptions s
        where s.user_id = e.user_id
          and s.plan_key = 'pro'
          and lower(coalesce(s.status, '')) in ('active', 'trialing', 'past_due', 'grace_period')
          and (
            s.provider <> 'apple'
            or s.current_period_end is null
            or s.current_period_end > now()
          )
      );

    update public.user_ai_entitlements e
    set
      monthly_summary_limit = 150,
      monthly_writing_limit = 75,
      monthly_research_limit = 30,
      monthly_discovery_limit = 75,
      notes = case
        when lower(coalesce(e.notes, '')) like '%[ai-allowance-backfill:premium]%'
          then e.notes
        else trim(concat_ws(' ', nullif(trim(e.notes), ''), '[ai-allowance-backfill:premium]'))
      end,
      updated_at = now()
    where e.ai_assisted_enabled is true
      and coalesce(lower(e.tier), '') <> 'admin'
      and not exists (
        select 1
        from public.user_general_subscriptions s
        where s.user_id = e.user_id
          and s.plan_key = 'pro'
          and lower(coalesce(s.status, '')) in ('active', 'trialing', 'past_due', 'grace_period')
          and (
            s.provider <> 'apple'
            or s.current_period_end is null
            or s.current_period_end > now()
          )
      )
      and exists (
        select 1
        from public.user_general_subscriptions s
        where s.user_id = e.user_id
          and s.plan_key = 'premium'
          and lower(coalesce(s.status, '')) in ('active', 'trialing', 'past_due', 'grace_period')
          and (
            s.provider <> 'apple'
            or s.current_period_end is null
            or s.current_period_end > now()
          )
      );
  else
    -- First-run path: update legacy Pro rows before Premium. New Premium uses
    -- the old Pro numeric signature, so the durable markers make this branch
    -- safe even if it is accidentally executed twice before the next migration.
    update public.user_ai_entitlements
    set
      monthly_summary_limit = 300,
      monthly_writing_limit = 150,
      monthly_research_limit = 60,
      monthly_discovery_limit = 150,
      notes = case
        when lower(coalesce(notes, '')) like '%[ai-allowance-backfill:pro]%'
          then notes
        else trim(concat_ws(' ', nullif(trim(notes), ''), '[ai-allowance-backfill:pro]'))
      end,
      updated_at = now()
    where ai_assisted_enabled is true
      and coalesce(lower(tier), '') <> 'admin'
      and (
        lower(coalesce(tier, '')) in ('pro', 'premium_pro', 'premium_plus')
        or lower(coalesce(notes, '')) like '%premium pro%'
        or lower(coalesce(notes, '')) like '%premium plus%'
        or lower(coalesce(notes, '')) like '%[ai-allowance-backfill:pro]%'
        or (
          coalesce(monthly_summary_limit, 0) = 150
          and coalesce(monthly_writing_limit, 0) = 75
          and coalesce(monthly_research_limit, 0) = 30
          and coalesce(monthly_discovery_limit, 0) = 75
          and lower(coalesce(notes, '')) not like '%[ai-allowance-backfill:premium]%'
        )
      );

    update public.user_ai_entitlements
    set
      monthly_summary_limit = 150,
      monthly_writing_limit = 75,
      monthly_research_limit = 30,
      monthly_discovery_limit = 75,
      notes = case
        when lower(coalesce(notes, '')) like '%[ai-allowance-backfill:premium]%'
          then notes
        else trim(concat_ws(' ', nullif(trim(notes), ''), '[ai-allowance-backfill:premium]'))
      end,
      updated_at = now()
    where ai_assisted_enabled is true
      and coalesce(lower(tier), '') <> 'admin'
      and coalesce(monthly_summary_limit, 0) = 50
      and coalesce(monthly_writing_limit, 0) = 25
      and coalesce(monthly_research_limit, 0) = 10
      and coalesce(monthly_discovery_limit, 0) = 25;
  end if;
end;
$$;
