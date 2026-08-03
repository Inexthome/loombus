-- One AI analysis per thesis was only ever an application-level count()
-- check in the analyze route, which is a TOCTOU race: two concurrent
-- requests can both pass the count check, both call the model (double
-- spend), and both insert. A real constraint closes the race atomically;
-- the route now claims its row with an insert before calling the model and
-- relies on this index to reject the loser with 23505.

begin;

create unique index if not exists floor_thesis_analyses_thesis_id_unique_idx
  on public.floor_thesis_analyses (thesis_id);

commit;
