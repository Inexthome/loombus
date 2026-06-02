import Link from "next/link";
import { PageHeader, PageShell, Panel } from "@/components/ui";

export default function AboutPage() {
  return (
    <PageShell width="lg">
      <Link href="/" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white">
        ← Back to Loombus
      </Link>

      <PageHeader
        eyebrow="About"
        title="About Loombus"
        description={
          <>
            Loombus is a signal-first discussion platform for thoughtful
            conversations, durable knowledge, Reality Lenses, AI-assisted
            understanding, saved learning, and meaningful contribution.
          </>
        }
      />

      <div className="space-y-8">
        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            Our philosophy
          </h2>

          <p className="leading-relaxed text-zinc-400">
            Most platforms optimize for addiction, outrage, virality, and
            endless engagement loops. Loombus is being built around a different
            idea: thoughtful discussions, real-life context, saved knowledge,
            and useful insights should outlive trends, algorithms, and noise.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-6 text-2xl font-semibold text-white">
            What Loombus values
          </h2>

          <div className="grid gap-3 text-zinc-400 md:grid-cols-2">
            <p>• Thoughtful discussions over reactive posting</p>
            <p>• Signal over virality</p>
            <p>• Real-life context through Reality Lenses</p>
            <p>• Long-term knowledge over short-term engagement</p>
            <p>• Credibility and contribution over popularity</p>
            <p>• Discovery through substance, not manipulation</p>
            <p>• AI tools that organize ideas without replacing judgment</p>
            <p>• Saved learning, private notes, and cleaner community dialogue</p>
          </div>
        </Panel>

        <Panel>
          <h2 className="mb-6 text-2xl font-semibold text-white">
            What Loombus is not
          </h2>

          <div className="grid gap-3 text-zinc-400 md:grid-cols-2">
            <p>• Not an outrage engine</p>
            <p>• Not optimized for doom scrolling</p>
            <p>• Not designed around vanity metrics</p>
            <p>• Not focused on algorithmic addiction loops</p>
            <p>• Not intended to reward low-effort noise</p>
            <p>• Not a replacement for judgment, safety, or legal advice</p>
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}
