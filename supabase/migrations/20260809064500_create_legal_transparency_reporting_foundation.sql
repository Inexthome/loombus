-- Issue #674: aggregate transparency reporting foundation.
-- Internal methodology metadata only. This migration does not generate or publish
-- transparency-report counts, expose request-specific records, approve disclosure,
-- send notices, or enable external transmission.

begin;

alter table public.legal_operations_authorizations
  add column if not exists can_review_transparency_reporting boolean not null default false;

comment on column public.legal_operations_authorizations.can_review_transparency_reporting is
'Allows restricted review of Legal Operations transparency-reporting methodology metadata only. It does not grant request mutation, export, disclosure, emergency approval, publication, notice, or external-transmission authority.';

-- Existing transparency fields predate the aggregate-reporting methodology. Add an
-- explicit review state so a legacy/default reportability boolean can never be
-- treated as evidence that a request was actually reviewed for reporting.
alter table public.legal_requests
  add column if not exists transparency_review_status text not null default 'unreviewed';

-- New requests fail closed for transparency reportability. Existing rows are not
-- reclassified by this migration and remain subject to explicit review.
alter table public.legal_requests
  alter column transparency_reportable set default false;

comment on column public.legal_requests.transparency_review_status is
'Internal classification-review state for future aggregate transparency reporting. A reportability boolean alone is not sufficient for aggregation or publication.';

comment on column public.legal_requests.transparency_reportable is
'Internal candidate classification only. Default false for new requests. Future aggregate eligibility also requires an approved reporting methodology and explicit transparency review.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'legal_requests_transparency_review_status_check'
      and conrelid = 'public.legal_requests'::regclass
  ) then
    alter table public.legal_requests
      add constraint legal_requests_transparency_review_status_check
      check (transparency_review_status in ('unreviewed', 'reviewed', 'requires_counsel'));
  end if;
end
$$;

-- Extend the existing authoritative review trigger boundary to cover the new
-- transparency review state. The pre-existing transparency classification fields
-- remain protected by this same function.
create or replace function public.legal_enforce_request_review_authorization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  review_fields_changed boolean;
  review_authorized boolean;
begin
  review_fields_changed :=
    old.status is distinct from new.status
    or old.requester_identity_status is distinct from new.requester_identity_status
    or old.requester_identity_summary is distinct from new.requester_identity_summary
    or old.jurisdiction is distinct from new.jurisdiction
    or old.asserted_authority is distinct from new.asserted_authority
    or old.authority_review_status is distinct from new.authority_review_status
    or old.authority_review_summary is distinct from new.authority_review_summary
    or old.narrowed_scope is distinct from new.narrowed_scope
    or old.scope_review_status is distinct from new.scope_review_status
    or old.counsel_review_status is distinct from new.counsel_review_status
    or old.deficiency_reason is distinct from new.deficiency_reason
    or old.rejection_reason is distinct from new.rejection_reason
    or old.emergency_criteria_summary is distinct from new.emergency_criteria_summary
    or old.cross_border_status is distinct from new.cross_border_status
    or old.conflicting_law_summary is distinct from new.conflicting_law_summary
    or old.confidentiality_notes is distinct from new.confidentiality_notes
    or old.member_notice_decision is distinct from new.member_notice_decision
    or old.delayed_notice_basis is distinct from new.delayed_notice_basis
    or old.transparency_reportable is distinct from new.transparency_reportable
    or old.transparency_jurisdiction_group is distinct from new.transparency_jurisdiction_group
    or old.transparency_outcome is distinct from new.transparency_outcome
    or old.transparency_review_status is distinct from new.transparency_review_status;

  if not review_fields_changed then
    return new;
  end if;

  if new.updated_by is null then
    raise exception using
      errcode = '42501',
      message = 'Legal request review changes require an identified reviewer.';
  end if;

  select exists (
    select 1
    from public.legal_operations_authorizations loa
    where loa.user_id = new.updated_by
      and loa.active = true
      and loa.revoked_at is null
      and loa.can_review_requests = true
  )
  into review_authorized;

  if not review_authorized then
    raise exception using
      errcode = '42501',
      message = 'Legal Operations capability can_review_requests is required.';
  end if;

  return new;
end;
$$;

revoke all on function public.legal_enforce_request_review_authorization() from public, anon, authenticated;

create table if not exists public.legal_transparency_reporting_registry (
  control_key text primary key,
  control_kind text not null,
  display_name text not null,
  source_fields text[] not null,
  aggregation_contract text not null,
  null_handling text not null,
  publication_approval_status text not null default 'unapproved',
  aggregation_execution_enabled boolean not null default false,
  publication_enabled boolean not null default false,
  request_specific_data_allowed boolean not null default false,
  counsel_review_required boolean not null default true,
  suppression_rule_required boolean not null default false,
  unresolved_items text[] not null default '{}'::text[],
  evidence_sources text[] not null default '{}'::text[],
  notes text,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_transparency_reporting_control_key_length_check check (
    char_length(control_key) between 2 and 160
  ),
  constraint legal_transparency_reporting_control_kind_check check (
    control_kind in ('dimension', 'counting_rule', 'privacy_control', 'publication_gate')
  ),
  constraint legal_transparency_reporting_display_name_length_check check (
    char_length(display_name) between 2 and 400
  ),
  constraint legal_transparency_reporting_source_fields_check check (
    cardinality(source_fields) between 1 and 40
  ),
  constraint legal_transparency_reporting_contract_length_check check (
    char_length(aggregation_contract) between 5 and 6000
  ),
  constraint legal_transparency_reporting_null_handling_length_check check (
    char_length(null_handling) between 5 and 3000
  ),
  constraint legal_transparency_reporting_publication_status_check check (
    publication_approval_status in ('unapproved', 'approved', 'not_applicable')
  ),
  constraint legal_transparency_reporting_aggregation_disabled_check check (
    aggregation_execution_enabled = false
  ),
  constraint legal_transparency_reporting_publication_disabled_check check (
    publication_enabled = false
  ),
  constraint legal_transparency_reporting_request_specific_data_check check (
    request_specific_data_allowed = false
  ),
  constraint legal_transparency_reporting_counsel_required_check check (
    counsel_review_required = true
  ),
  constraint legal_transparency_reporting_unapproved_gap_check check (
    publication_approval_status <> 'unapproved' or cardinality(unresolved_items) > 0
  ),
  constraint legal_transparency_reporting_evidence_required_check check (
    cardinality(evidence_sources) > 0
  ),
  constraint legal_transparency_reporting_notes_length_check check (
    notes is null or char_length(notes) <= 8000
  ),
  constraint legal_transparency_reporting_payload_size_check check (
    octet_length(array_to_string(source_fields, E'\n')) <= 16000
    and octet_length(array_to_string(unresolved_items, E'\n')) <= 30000
    and octet_length(array_to_string(evidence_sources, E'\n')) <= 30000
  )
);

comment on table public.legal_transparency_reporting_registry is
'Issue #674 internal aggregate transparency-reporting methodology registry. Metadata only; it does not execute aggregation or authorize publication.';

comment on column public.legal_transparency_reporting_registry.aggregation_execution_enabled is
'Hard-disabled in this foundation. A later reviewed migration is required before any aggregate snapshot generation is enabled.';

comment on column public.legal_transparency_reporting_registry.publication_enabled is
'Hard-disabled in this foundation. Public transparency reporting requires qualified counsel approval, validated methodology, and disclosure-risk controls.';

alter table public.legal_transparency_reporting_registry enable row level security;

-- Service-only and read-only. Browser clients never query the registry directly.
revoke all on table public.legal_transparency_reporting_registry from public, anon, authenticated, service_role;
grant select on table public.legal_transparency_reporting_registry to service_role;

insert into public.legal_transparency_reporting_registry (
  control_key,
  control_kind,
  display_name,
  source_fields,
  aggregation_contract,
  null_handling,
  publication_approval_status,
  aggregation_execution_enabled,
  publication_enabled,
  request_specific_data_allowed,
  counsel_review_required,
  suppression_rule_required,
  unresolved_items,
  evidence_sources,
  notes,
  sort_order
)
values
(
  'reporting_period_dimension',
  'dimension',
  'Reporting period candidate',
  array['public.legal_requests.received_at'],
  'A future approved methodology must define the reporting window from a stable request lifecycle timestamp. This foundation identifies received_at as the candidate source but does not approve annual, quarterly, monthly, or other publication windows.',
  'received_at is required by the legal_requests schema, so missing source timestamps are not expected. Any future backfill or timestamp anomaly must be treated as a methodology exception rather than silently reassigned.',
  'unapproved', false, false, false, true, false,
  array['Qualified counsel and Privacy/Data Governance must approve the public reporting period and cutoff rules.', 'Treatment of late corrections, reopened matters, and historical backfills is not approved.'],
  array['supabase/migrations/20260808080000_create_legal_operations_foundation.sql', 'docs/legal-operations/issue-674-transparency-reporting-foundation.md'],
  'No aggregate reporting period is executed in this phase.',
  10
),
(
  'request_type_dimension',
  'dimension',
  'Request type classification',
  array['public.legal_requests.request_type'],
  'Future aggregates may use the database-constrained request_type classification only after public labels and grouping rules are approved. The raw internal enum is not automatically a public taxonomy.',
  'request_type is required. Unknown or newly introduced internal enum values must not be silently folded into a public category without reviewed methodology changes.',
  'unapproved', false, false, false, true, false,
  array['Public category labels and any category collapsing require qualified review.', 'Treatment of other and future request types remains unapproved.'],
  array['supabase/migrations/20260808080000_create_legal_operations_foundation.sql', 'docs/legal-operations/issue-674-transparency-reporting-foundation.md'],
  'This row defines a candidate dimension only and exposes no request records.',
  20
),
(
  'jurisdiction_group_dimension',
  'dimension',
  'Jurisdiction group classification',
  array['public.legal_requests.transparency_jurisdiction_group'],
  'Future aggregate reporting may use only a reviewed jurisdiction-group taxonomy. Free-text or operational jurisdiction values must not be published directly as aggregate labels.',
  'Null jurisdiction-group classifications remain explicitly unclassified. They must not be silently omitted or inferred from requester identity, organization, IP data, or other request-specific attributes.',
  'unapproved', false, false, false, true, true,
  array['No approved jurisdiction grouping taxonomy exists yet.', 'Small-cell and cross-border disclosure risk must be reviewed before jurisdiction-level publication.'],
  array['supabase/migrations/20260808080000_create_legal_operations_foundation.sql', 'supabase/migrations/20260809042000_add_legal_request_review_capability.sql'],
  'The existing field remains review-protected by can_review_requests.',
  30
),
(
  'outcome_dimension',
  'dimension',
  'Transparency outcome classification',
  array['public.legal_requests.transparency_outcome'],
  'Future aggregate reporting may use only an approved outcome taxonomy. Operational request status, disclosure status, and transparency outcome are separate concepts and must not be substituted for one another.',
  'Null outcome classifications remain unclassified. A missing value must not be inferred from request status, disclosure rows, or preservation activity.',
  'unapproved', false, false, false, true, true,
  array['No approved public outcome taxonomy exists yet.', 'Treatment of partial fulfillment, deficiency, rejection, withdrawal, and unresolved matters requires qualified review.'],
  array['supabase/migrations/20260808080000_create_legal_operations_foundation.sql', 'supabase/migrations/20260809042000_add_legal_request_review_capability.sql'],
  'No public outcome label is approved by this migration.',
  40
),
(
  'reportability_dimension',
  'dimension',
  'Transparency reportability classification',
  array['public.legal_requests.transparency_reportable'],
  'The reportability boolean is an internal candidate classification only. Future aggregation must also require an explicitly reviewed transparency classification and an approved reporting methodology.',
  'False and null-equivalent legacy interpretations must not be converted into public inclusion decisions. New requests default to false after this migration.',
  'unapproved', false, false, false, true, false,
  array['Inclusion and exclusion standards require qualified counsel approval.', 'Legacy rows require explicit classification review before any future aggregation.'],
  array['supabase/migrations/20260808080000_create_legal_operations_foundation.sql', 'supabase/migrations/20260809064500_create_legal_transparency_reporting_foundation.sql'],
  'A true value alone never authorizes counting or publication.',
  50
),
(
  'classification_review_status_dimension',
  'dimension',
  'Transparency classification review state',
  array['public.legal_requests.transparency_review_status'],
  'Future aggregate eligibility must distinguish unreviewed, reviewed, and requires_counsel states. This foundation does not execute eligibility filtering or aggregation.',
  'Unreviewed and requires_counsel states remain unresolved for future external reporting. They must not be silently treated as reviewed.',
  'unapproved', false, false, false, true, false,
  array['The exact reviewer workflow and counsel-escalation procedure are not yet implemented.', 'No aggregate eligibility operation is enabled.'],
  array['supabase/migrations/20260809064500_create_legal_transparency_reporting_foundation.sql'],
  'The new review state fails closed at unreviewed for existing and future rows.',
  60
),
(
  'unique_request_count_rule',
  'counting_rule',
  'One legal request per request count',
  array['public.legal_requests.id'],
  'A future approved methodology should count a canonical legal request at most once within its applicable reporting universe, using the legal_requests primary key rather than event, hold, disclosure, or manifest row counts.',
  'Requests missing required classification fields remain unresolved and must not be silently dropped merely to produce a complete-looking report.',
  'unapproved', false, false, false, true, false,
  array['Reporting-universe inclusion and period assignment remain unapproved.', 'Duplicate, superseding, amended, or consolidated legal instruments may require case-specific counting rules.'],
  array['supabase/migrations/20260808080000_create_legal_operations_foundation.sql', 'docs/legal-operations/issue-674-transparency-reporting-foundation.md'],
  'No count query or snapshot function is created in this phase.',
  70
),
(
  'request_disclosure_separation_rule',
  'counting_rule',
  'Request counts remain separate from disclosure counts',
  array['public.legal_requests.id', 'public.legal_disclosures.request_id'],
  'A legal request and a disclosure are different units. Future methodology must not infer the number of requests from disclosure rows or infer disclosures from request status because one request can have zero, one, or multiple disclosure-control records.',
  'Absence of a disclosure row is not treated as a request outcome. Absence of a request-level outcome classification remains unresolved.',
  'unapproved', false, false, false, true, false,
  array['Separate disclosure-volume metrics, if any, require their own approved definitions.', 'Treatment of preservation acknowledgements and non-data responses remains unapproved.'],
  array['supabase/migrations/20260808080000_create_legal_operations_foundation.sql', 'supabase/migrations/20260808111500_restrict_legal_disclosure_preparation.sql'],
  'This rule prevents accidental denominator/numerator substitution between requests and disclosures.',
  80
),
(
  'unreviewed_exclusion_control',
  'privacy_control',
  'Unreviewed classifications cannot become external aggregate output',
  array['public.legal_requests.transparency_review_status', 'public.legal_requests.transparency_reportable'],
  'Any future external aggregate pipeline must fail closed unless the underlying request classification has completed the approved transparency-review workflow. A legacy or default reportability value cannot bypass review.',
  'Unreviewed and requires_counsel classifications remain outside any future external-publication-eligible universe until the approved methodology explicitly resolves them.',
  'unapproved', false, false, false, true, false,
  array['The classification review workflow is not yet implemented.', 'Qualified counsel must approve the inclusion/exclusion methodology.'],
  array['supabase/migrations/20260809042000_add_legal_request_review_capability.sql', 'supabase/migrations/20260809064500_create_legal_transparency_reporting_foundation.sql'],
  'This is a methodology guardrail only; no aggregation is executed here.',
  90
),
(
  'request_specific_data_exclusion_control',
  'privacy_control',
  'Request-specific data excluded from aggregate output',
  array[
    'public.legal_requests.request_number',
    'public.legal_requests.requester_organization',
    'public.legal_requests.requester_name',
    'public.legal_requests.requester_contact_ref',
    'public.legal_requests.original_scope',
    'public.legal_requests.narrowed_scope',
    'public.legal_requests.authority_review_summary',
    'public.legal_requests.confidentiality_notes'
  ],
  'Future aggregate output must not contain request numbers, requester names or contacts, request scope text, legal-review narrative, member identifiers, responsive data, or other request-specific content. This registry itself stores methodology metadata only.',
  'Missing or suppressed request-specific fields are never backfilled into an aggregate output from another source.',
  'unapproved', false, false, false, true, false,
  array['A complete publication-field allowlist must be approved before any external report is generated.', 'Free-text aggregate labels require disclosure-risk review.'],
  array['supabase/migrations/20260808080000_create_legal_operations_foundation.sql', 'docs/legal-operations/issue-674-transparency-reporting-foundation.md'],
  'The schema hard-disables request_specific_data_allowed for every registry row in this foundation.',
  100
),
(
  'small_cell_suppression_control',
  'privacy_control',
  'Small-cell and re-identification suppression required before publication',
  array['future aggregate output cells'],
  'Any future public transparency report must apply an approved suppression or disclosure-control methodology before releasing low-volume or otherwise identifying aggregate cells. This foundation does not select a numeric threshold.',
  'Sparse, unique, or otherwise sensitive combinations remain unpublished until an approved suppression rule determines safe treatment.',
  'unapproved', false, false, false, true, true,
  array['No numeric small-cell threshold is approved.', 'Cross-tabulation and differencing risks require privacy and qualified legal review.'],
  array['docs/legal-operations/issue-674-transparency-reporting-foundation.md'],
  'No threshold is guessed or published in this phase.',
  110
),
(
  'public_release_gate',
  'publication_gate',
  'Public transparency-report release gate',
  array['future aggregate transparency-report output'],
  'External publication remains disabled until qualified counsel approves the reporting universe, categories, counting rules, suppression controls, exclusions, explanatory notes, and review process, and Engineering validates the implementation against those approved rules.',
  'Any unresolved methodology item blocks publication rather than being silently omitted, inferred, or converted into a public claim.',
  'unapproved', false, false, false, true, true,
  array['Qualified counsel approval is outstanding.', 'No publication workflow, snapshot generator, external transmission operation, or public transparency-report page exists in this phase.'],
  array['docs/legal-operations/issue-674-transparency-reporting-foundation.md'],
  'Public publication is structurally disabled by the registry constraint.',
  120
)
on conflict (control_key) do update set
  control_kind = excluded.control_kind,
  display_name = excluded.display_name,
  source_fields = excluded.source_fields,
  aggregation_contract = excluded.aggregation_contract,
  null_handling = excluded.null_handling,
  publication_approval_status = excluded.publication_approval_status,
  aggregation_execution_enabled = excluded.aggregation_execution_enabled,
  publication_enabled = excluded.publication_enabled,
  request_specific_data_allowed = excluded.request_specific_data_allowed,
  counsel_review_required = excluded.counsel_review_required,
  suppression_rule_required = excluded.suppression_rule_required,
  unresolved_items = excluded.unresolved_items,
  evidence_sources = excluded.evidence_sources,
  notes = excluded.notes,
  enabled = true,
  sort_order = excluded.sort_order,
  updated_at = now();

commit;
