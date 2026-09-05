export const DISCUSSION_AI_CITATION_SCHEMA = "semantic-citations-v1";

export const DISCUSSION_AI_CITATION_INSTRUCTIONS = `When attributing a claim or analytical finding to a discussion contribution, append a source token using exactly this form: [[source:SOURCE_ID|AUTHOR_NAME|ROLE]]. SOURCE_ID must be "opening" or an exact reply UUID supplied in the source material. AUTHOR_NAME must match the supplied author. ROLE must be one of: Opening claim, Supporting point, Counterpoint, Evidence, Example, Clarification, Question, Synthesis, Changed view, Proposed solution. Never output [Original post], [Reply N], reply numbers, ordinal source labels, or invented source IDs. Cite only contributions that materially support the statement.`;

const SOURCE_TOKEN_PATTERN = /\[\[source:([^|\]]+)\|([^|\]]+)\|([^\]]+)\]\]/g;
const CONTRIBUTION_ROLES = new Set([
  "Opening claim",
  "Supporting point",
  "Counterpoint",
  "Evidence",
  "Example",
  "Clarification",
  "Question",
  "Synthesis",
  "Changed view",
  "Proposed solution",
  "Contribution",
]);

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
};

export type CitationReply = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export function safeCitationField(value: string) {
  return value.replace(/[|\[\]]/g, " ").replace(/\s+/g, " ").trim();
}

export function citationProfileName(profile?: ProfileRow | null) {
  return profile?.full_name?.trim() || profile?.username?.trim() || "Loombus member";
}

export async function buildDiscussionAiCitationContext({
  supabase,
  discussionUserId,
  discussionBody,
  replies,
  clamp,
}: {
  supabase: any;
  discussionUserId: string;
  discussionBody: string;
  replies: CitationReply[];
  clamp: (text: string) => string;
}) {
  const profileIds = [...new Set([discussionUserId, ...replies.map((reply) => reply.user_id)])];
  const { data: profileData } = profileIds.length
    ? await supabase.from("profiles").select("id, full_name, username").in("id", profileIds)
    : { data: [] };
  const profiles = new Map(
    ((profileData ?? []) as ProfileRow[]).map((profile) => [profile.id, profile])
  );

  const openingAuthor = citationProfileName(profiles.get(discussionUserId));
  const sourceAuthors = new Map<string, string>([["opening", openingAuthor]]);
  for (const reply of replies) {
    sourceAuthors.set(reply.id, citationProfileName(profiles.get(reply.user_id)));
  }

  const replyText = replies
    .map((reply) => {
      const author = sourceAuthors.get(reply.id) ?? "Loombus member";
      return `[Source reply id=${reply.id} author="${safeCitationField(author)}"]\n${reply.body}`;
    })
    .join("\n\n");

  const sourceText = `[Source opening id=opening author="${safeCitationField(openingAuthor)}"]\n${discussionBody}\n\nReplies in chronological order:\n${clamp(replyText || "No replies yet.")}`;
  const hashMaterial = [
    DISCUSSION_AI_CITATION_SCHEMA,
    `opening:${discussionUserId}:${openingAuthor}:${discussionBody}`,
    ...replies.map(
      (reply) => `reply:${reply.id}:${reply.user_id}:${sourceAuthors.get(reply.id) ?? "Loombus member"}:${reply.body}`
    ),
  ];

  return { sourceText, hashMaterial, sourceAuthors };
}

export function normalizeDiscussionAiCitationTokens(
  text: string,
  sourceAuthors: Map<string, string>
) {
  return text.replace(SOURCE_TOKEN_PATTERN, (_match, rawId: string, _rawAuthor: string, rawRole: string) => {
    const sourceId = rawId.trim();
    const author = sourceAuthors.get(sourceId);
    if (!author) return "";
    const requestedRole = rawRole.trim();
    const role = CONTRIBUTION_ROLES.has(requestedRole) ? requestedRole : "Contribution";
    return `[[source:${sourceId}|${safeCitationField(author)}|${role}]]`;
  });
}
