# Loombus Policy Publication Evidence and Approval Checklist

Status: Internal release-control template  
Prepared: July 27, 2026  
Public release authorized: No

## 1. Purpose

This checklist defines the evidence required before an internal Loombus policy draft may be converted into a public document.

A reviewer must be able to answer not only “Does this language sound reasonable?” but also “What current product, database, Storage, vendor, operational, and legal evidence supports this statement?”

Each public document should have one completed approval packet stored with the document version.

## 2. Document identity

Complete the following:

- Document ID:
- Public title:
- Internal source draft:
- Proposed slug:
- Document type:
- Category:
- Audience:
- Proposed version:
- Proposed effective date:
- Current public document replaced, if any:
- Superseded-version route:
- Accountable owner:
- Product owner:
- Engineering reviewer:
- Trust and Safety reviewer:
- Privacy and Security reviewer:
- Support reviewer:
- Accessibility reviewer:
- Legal reviewer:
- Executive approver:

## 3. Claim register

Every material claim must be entered into a claim register.

| Field | Required content |
|---|---|
| Claim ID | Stable identifier within the document version |
| Public statement | Exact proposed member-facing statement |
| Claim type | Product, privacy, safety, enforcement, billing, legal, AI, Search, support, accessibility, or operational |
| Surface | Page, feature, API, table, Storage bucket, vendor, or workflow involved |
| Source of truth | Code path, migration, query, configuration, contract, operating procedure, or legal authority |
| Production evidence | Screenshot, query output, test result, configuration record, or signed procedure |
| Limitations | Conditions, exceptions, unsupported surfaces, delay, or uncertainty |
| Owner | Person responsible for keeping the claim current |
| Review date | Date evidence was confirmed |
| Change trigger | Product, vendor, price, model, law, or process change requiring re-review |

A paragraph may contain multiple claims and should be split when different evidence supports different parts.

## 4. Product accuracy checklist

For every named feature or control:

- [ ] The route exists in production.
- [ ] The control is visible to the intended member role.
- [ ] The control works on desktop web.
- [ ] The control works on mobile web.
- [ ] The control works in the native application where applicable.
- [ ] The server enforces the behavior independently of the client.
- [ ] Database policies enforce the same access rule where applicable.
- [ ] Notifications do not reveal information outside the intended audience.
- [ ] Search does not expose restricted or unavailable records.
- [ ] AI systems do not receive or reveal unauthorized data.
- [ ] Administrator access is described accurately.
- [ ] Blocking, suspension, deactivation, and deletion states are handled.
- [ ] Error and unavailable states are member-readable.
- [ ] The Help article does not describe a planned control as current.

## 5. Privacy and data checklist

For every data statement:

- [ ] The data category is named in the retention register.
- [ ] The system of record is identified.
- [ ] Access roles are documented.
- [ ] Collection purpose is documented.
- [ ] Sharing and subprocessors are documented.
- [ ] Public, member-only, restricted, Room, message, draft, and administrator boundaries are verified.
- [ ] Retention period or qualitative retention statement is approved.
- [ ] Deletion trigger is documented.
- [ ] Backup and cache behavior is documented.
- [ ] Legal hold, fraud, safety, billing, and dispute exceptions are documented.
- [ ] Data export behavior is documented.
- [ ] Account deletion behavior is documented.
- [ ] Teen or minor data receives the required treatment.
- [ ] No promise of immediate or complete deletion exceeds technical reality.
- [ ] External search-engine and recipient copies are treated realistically.

## 6. Reporting and enforcement checklist

For every report or enforcement statement:

- [ ] The member-facing report target exists.
- [ ] The report reason exists or is mapped to the canonical taxonomy.
- [ ] The report enters an identified queue or workflow.
- [ ] Severity routing is defined.
- [ ] The responsible reviewer role is defined.
- [ ] Evidence access is restricted and logged where required.
- [ ] Reporter, victim, and witness confidentiality is protected.
- [ ] The possible action is technically supported on the named surface.
- [ ] The action has a canonical action code.
- [ ] The member notice is defined.
- [ ] The notice does not reveal confidential or security-sensitive information.
- [ ] Appeal eligibility is accurate.
- [ ] Appeal route and deadline are accurate where offered.
- [ ] Restoration behavior is tested.
- [ ] Report resolution is not described as automatic enforcement.
- [ ] Severe-harm escalation is documented where relevant.
- [ ] Record retention is approved.

## 7. Teen and child-safety checklist

Complete where the document concerns minors, teens, Rooms, messaging, discovery, Jobs, Services, Events, Marketplace, or AI recommendations.

- [ ] Minimum age is confirmed.
- [ ] Minor and teen definitions are consistent.
- [ ] Age declaration and correction are documented.
- [ ] Underage-account reporting exists.
- [ ] Teen defaults described in the document are deployed.
- [ ] Adult-to-teen contact rules are server-enforced.
- [ ] Discoverability, follows, messages, viewers, location, and Discussion audiences are verified.
- [ ] Room duties involving minors are defined.
- [ ] Teen commercial participation is defined.
- [ ] Sensitive-content and recommendation treatment is verified.
- [ ] Child-safety escalation and external reporting are legally approved.
- [ ] Evidence handling minimizes unnecessary exposure.
- [ ] Parent or guardian information is accurate and does not promise unauthorized access.
- [ ] Age-related data collection is minimized and retained under an approved schedule.

## 8. AI and automated-systems checklist

Complete where the document refers to AI, safety detection, Search AI, summaries, Signal, recommendations, matching, duplicates, fingerprints, or automated decisions.

- [ ] Feature owner is identified.
- [ ] Provider and model are verified in production.
- [ ] Input data categories are documented.
- [ ] Private, restricted, Room, message, saved, draft, and attachment treatment is explicit.
- [ ] Permission checks occur before processing.
- [ ] Prompt and output retention is documented.
- [ ] Provider training and abuse-monitoring settings are verified.
- [ ] Human access and review are documented.
- [ ] The system is classified as automatic, human-confirmed, or signal-only.
- [ ] Accuracy and limitation language is appropriate.
- [ ] No forensic, authorship, plagiarism, copyright, or verification capability is implied without evidence.
- [ ] Member feedback and correction routes exist where described.
- [ ] Teen treatment is verified.
- [ ] Provider or model changes trigger policy review.

## 9. Commerce and professional-integrity checklist

Complete where the document concerns Marketplace, Businesses, Services, Requests, Jobs, Events, Appointments, payments, credentials, or professional claims.

- [ ] Prohibited or restricted category maps to #670 taxonomy.
- [ ] Allowed discussion is distinguished from prohibited transaction or facilitation.
- [ ] Age and location restrictions are defined.
- [ ] Licensing or credential language does not imply Loombus verification without a verified program.
- [ ] Seller, employer, provider, or organizer identity language is accurate.
- [ ] Listing, Job, Service, Event, or Business lifecycle is documented.
- [ ] Duplicate and evasive reposting behavior is defined.
- [ ] External application, payment, or intake destinations are disclosed.
- [ ] Loombus does not imply escrow, refund, chargeback, authenticity, safety, quality, hiring, or professional outcome guarantees.
- [ ] Sensitive application or intake data is minimized.
- [ ] Fraud and high-risk escalation are defined.
- [ ] Member notice and appeal behavior is verified.
- [ ] Regulatory, employment, advertising, consumer, and professional-practice legal review is complete.

## 10. Room governance checklist

Complete where the document concerns Room operation.

- [ ] Public role names match the production role model.
- [ ] Each stated permission is server and database enforced.
- [ ] Join requests, invitations, member removal, bans, and role changes are verified.
- [ ] Report, evidence, assignment, response, and resolution access is verified.
- [ ] Resolution is separate from content and membership action.
- [ ] Room-level action is distinguished from Loombus-wide action.
- [ ] Customer Support case isolation is verified.
- [ ] Room files and Storage access are verified.
- [ ] Minors-in-Rooms duties are approved.
- [ ] Ownership transfer and organization administration are verified.
- [ ] Billing and downgrade consequences are accurate.
- [ ] Archive, recovery, retention, legal hold, and deletion are accurate.
- [ ] Permanent deletion is not described as immediate.
- [ ] Moderator retaliation and confidentiality handling are defined.
- [ ] Room review and Loombus appeal boundaries are accurate.

## 11. Search and indexing checklist

Complete where the document concerns public content, discoverability, external indexing, Local, Search Everything, recommendations, or Search AI.

- [ ] Every indexed source type is listed.
- [ ] Source-owned eligibility is authoritative.
- [ ] Public, member-only, restricted, Room, message, saved, and draft exclusions are tested.
- [ ] Private-account and discoverability behavior is distinguished.
- [ ] Block filtering is tested.
- [ ] Search counts and groups update after filtering.
- [ ] Stale and orphan records can be repaired.
- [ ] Sitemap, robots, canonical, and public route behavior are verified.
- [ ] External search-engine cache limitations are disclosed.
- [ ] Local responses do not expose stored coordinates.
- [ ] Search ranking is not described as truth, endorsement, safety, or professional quality.
- [ ] Grounded AI source boundaries are verified.
- [ ] Search, query, click, index, and AI retention are approved.

## 12. Attachment and file checklist

- [ ] Supported type, count, size, and duration limits are correct.
- [ ] Public versus restricted attachment availability is accurate.
- [ ] Storage bucket and delivery mode are identified.
- [ ] Signed URL or authorization behavior is tested where applicable.
- [ ] Caching does not expose private media.
- [ ] File deletion and retention are documented.
- [ ] Report-evidence preservation is documented.
- [ ] Malware scanning posture is explicit.
- [ ] File-type validation is not described as malware scanning.
- [ ] Exact-byte fingerprinting is not described as perceptual matching.
- [ ] Duplicate detection is not described as plagiarism, ownership, or legal infringement detection.
- [ ] AI processing of files is documented.
- [ ] Video range requests and mobile playback respect authorization.

## 13. Legal review checklist

Legal review should address, where applicable:

- [ ] contractual commitments;
- [ ] limitation of liability and warranty implications;
- [ ] privacy notice requirements;
- [ ] U.S. state privacy rights;
- [ ] child and teen privacy and safety;
- [ ] intellectual property and repeat infringement;
- [ ] employment and anti-discrimination law;
- [ ] professional licensing and advertising;
- [ ] consumer protection and unfair or deceptive acts;
- [ ] regulated goods and services;
- [ ] law-enforcement and emergency disclosure;
- [ ] international transfer and jurisdiction language;
- [ ] public-figure, public-interest, documentary, and speech considerations;
- [ ] off-platform conduct;
- [ ] sanctions, trade, and restricted transactions;
- [ ] record retention, preservation, and deletion exceptions;
- [ ] effective-date and material-change notice requirements.

The reviewer should identify:

- approved language;
- required changes;
- jurisdiction-specific supplements;
- product changes required before publication;
- operational conditions;
- residual risk accepted by the executive owner.

## 14. Accessibility checklist

- [ ] Heading hierarchy is logical.
- [ ] Jump to navigation is keyboard accessible.
- [ ] Links describe their destination.
- [ ] Tables have understandable headers and mobile alternatives.
- [ ] Policy labels and status do not rely only on color.
- [ ] Text contrast passes in Light, Dark, and System modes.
- [ ] Focus states are visible.
- [ ] Long documents remain usable with screen readers.
- [ ] Printed legal views remain readable.
- [ ] Report, appeal, contact, and emergency actions are reachable by keyboard.
- [ ] Mobile safe areas are handled.
- [ ] Language avoids unnecessary complexity and unexplained internal jargon.

## 15. Production verification record

For each environment tested, record:

- Environment:
- Deployment URL or release:
- Commit SHA:
- Supabase project:
- Storage configuration:
- Stripe mode and relevant products:
- AI provider configuration date:
- Test accounts and roles:
- Test date:
- Tester:
- Results:
- Failed or conditional checks:
- Screenshots or evidence location:
- Required follow-up:

Production evidence should not include secret keys, authentication tokens, full personal information, illegal material, or unnecessary victim data.

## 16. Approval record

| Gate | Reviewer | Decision | Date | Conditions |
|---|---|---|---|---|
| Product accuracy |  |  |  |  |
| Engineering accuracy |  |  |  |  |
| Trust and Safety |  |  |  |  |
| Privacy and Security |  |  |  |  |
| Support operations |  |  |  |  |
| Accessibility |  |  |  |  |
| Legal |  |  |  |  |
| Executive approval |  |  |  |  |

Allowed decisions:

- Approved;
- Approved with conditions;
- Changes required;
- Blocked;
- Withdrawn.

A document marked `Approved with conditions` may publish only when the conditions are explicitly permitted to remain and are stated accurately to members.

## 17. Release checklist

Immediately before publication:

- [ ] All blockers linked to the document are closed or formally accepted with accurate public limitations.
- [ ] Public text matches the approved version.
- [ ] `public_ready` is true only for the approved version.
- [ ] Effective date is correct.
- [ ] Superseded version is archived.
- [ ] Redirects and canonical links are correct.
- [ ] Related articles and settings exist.
- [ ] Report, appeal, contact, and emergency actions work.
- [ ] Search indexing behavior is intentional.
- [ ] Mobile, desktop, Light, Dark, and System review pass.
- [ ] Accessibility review passes.
- [ ] Legal and executive approvals are recorded.
- [ ] Support has the final document and escalation instructions.
- [ ] Product and engineering owners are subscribed to change triggers.
- [ ] A rollback plan exists for incorrect or premature publication.

## 18. Post-release review

Within the first 30 days after publication:

- verify that links, report routes, appeal routes, and settings remain functional;
- review member questions and support contacts for unclear language;
- verify no internal-draft metadata or publication blockers are exposed publicly;
- review Search and external indexing behavior;
- confirm effective-date and version-history rendering;
- correct inaccuracies immediately with a visible revision note where member rights or obligations are affected;
- record any product behavior that diverges from the approved claim register.

## 19. Recurring review triggers

A document must be re-reviewed when:

- a feature, route, setting, database policy, Storage rule, or role changes;
- a report, moderation, enforcement, appeal, or restoration workflow changes;
- a subscription price or entitlement changes;
- an AI provider, model, prompt, retention setting, or input boundary changes;
- a Search source or ranking category changes;
- a data vendor or retention period changes;
- a new age group, jurisdiction, or regulated activity is supported;
- a serious safety, privacy, security, billing, or legal incident reveals a policy gap;
- applicable law or official guidance materially changes;
- a public claim is found to be inaccurate or incomplete.
