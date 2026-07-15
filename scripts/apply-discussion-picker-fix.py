from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing expected block: {label}")
    return text.replace(old, new, 1)


discussions_path = Path("src/app/discussions/page.tsx")
discussions = discussions_path.read_text(encoding="utf-8")

discussions = replace_once(
    discussions,
    '''            <button
              type="button"
              onClick={() => setSelectedTopic("All")}
              className="mt-5 flex w-full items-center justify-between rounded-2xl px-1 py-2 text-sm font-semibold text-[#b45309] transition hover:text-[color:var(--loombus-text)]"
            >
              View all topics
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>''',
    '''            <Link
              href="/topics"
              className="mt-5 flex w-full items-center justify-between rounded-2xl px-1 py-2 text-sm font-semibold text-[#b45309] transition hover:text-[color:var(--loombus-text)]"
            >
              View all topics
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </Link>''',
    "left View all topics",
)

discussions = replace_once(
    discussions,
    '''              <button
                type="button"
                onClick={() => setSelectedTopic("All")}
                className="mt-7 flex w-full items-center justify-between text-sm font-bold text-[#b45309] transition hover:text-[color:var(--loombus-text)]"
              >
                View all topics
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </button>''',
    '''              <Link
                href="/topics"
                className="mt-7 flex w-full items-center justify-between text-sm font-bold text-[#b45309] transition hover:text-[color:var(--loombus-text)]"
              >
                View all topics
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </Link>''',
    "trending View all topics",
)

discussions = replace_once(
    discussions,
    'href="/saved"\n                className="mt-5 flex items-center justify-between text-sm font-bold text-[#b45309] transition hover:text-[color:var(--loombus-text)]"',
    'href="/saved#folders"\n                className="mt-5 flex items-center justify-between text-sm font-bold text-[#b45309] transition hover:text-[color:var(--loombus-text)]"',
    "View all folders destination",
)
discussions_path.write_text(discussions, encoding="utf-8")

saved_path = Path("src/app/saved/page.tsx")
saved = saved_path.read_text(encoding="utf-8")
saved = replace_once(
    saved,
    '<aside className="space-y-4">',
    '<aside id="folders" className="scroll-mt-28 space-y-4">',
    "saved folders anchor",
)
saved_path.write_text(saved, encoding="utf-8")

create_path = Path("src/app/create/create-v2-client-page.tsx")
create = create_path.read_text(encoding="utf-8")
create = replace_once(
    create,
    'onClick={() => { setTopic("Other"); setPickerPanel("reality"); }}',
    'onClick={() => { setTopic("Other"); setRealityLens(""); setPurposeLane(""); setPickerPanel("reality"); }}',
    "Other selection reset",
)
create = replace_once(
    create,
    'Other — choose a Reality Lens and Purpose Lane instead',
    'Other — choose a Reality Lens or Purpose Lane instead',
    "Other picker label",
)
create = replace_once(
    create,
    'onClick={() => { if (pickerPanel === "topics") { setTopic(option); setPickerOpen(false); } else if (pickerPanel === "reality") { setRealityLens(option); setPickerPanel("purpose"); } else { setPurposeLane(option); setPickerOpen(false); } }}',
    'onClick={() => { if (pickerPanel === "topics") { setTopic(option); setPickerOpen(false); } else if (pickerPanel === "reality") { setRealityLens(option); if (topic === "Other") { setPurposeLane(""); setPickerOpen(false); } else { setPickerPanel("purpose"); } } else { setPurposeLane(option); if (topic === "Other") setRealityLens(""); setPickerOpen(false); } }}',
    "exclusive Other picker behavior",
)
create = replace_once(
    create,
    'Use the plus menu to choose a topic. Use Other only to choose Reality Lens and Purpose Lane.',
    'Use the plus menu to choose a topic. With Other selected, choose either one Reality Lens or one Purpose Lane.',
    "Other helper text",
)
create = replace_once(
    create,
    '''    if (topic === "Other" && !realityLens && !purposeLane) {
      setMessage("Choose a Reality Lens or Purpose Lane when Topic is Other.");
      setPublishing(false);
      return;
    }
''',
    '''    if (topic === "Other" && !realityLens && !purposeLane) {
      setMessage("Choose a Reality Lens or Purpose Lane when Topic is Other.");
      setPublishing(false);
      return;
    }
    if (topic === "Other" && realityLens && purposeLane) {
      setMessage("Choose either a Reality Lens or a Purpose Lane, not both, when Topic is Other.");
      setPublishing(false);
      return;
    }
''',
    "client Other validation",
)
create_path.write_text(create, encoding="utf-8")

route_path = Path("src/app/api/discussions/create/route.ts")
route = route_path.read_text(encoding="utf-8")
route = replace_once(
    route,
    '''    const topic = requestedTopic as DiscussionTopic;

    const content = normalizePublicText(body.body).trim();''',
    '''    const topic = requestedTopic as DiscussionTopic;

    if (topic === "Other" && !reality_lens && !purpose_lane) {
      return NextResponse.json(
        { error: "Choose a Reality Lens or Purpose Lane when Topic is Other." },
        { status: 400 }
      );
    }

    if (topic === "Other" && reality_lens && purpose_lane) {
      return NextResponse.json(
        { error: "Choose either a Reality Lens or a Purpose Lane, not both, when Topic is Other." },
        { status: 400 }
      );
    }

    const content = normalizePublicText(body.body).trim();''',
    "server Other validation",
)
route_path.write_text(route, encoding="utf-8")
