-- Seed the first Loombus Research Desk launch set as private review drafts.
-- Administrators must verify and explicitly publish each report. Until then,
-- member RLS keeps these rows out of the Research Desk.

begin;

do $$
declare
  seed_admin_id uuid;
begin
  select id
  into seed_admin_id
  from public.profiles
  where is_admin
  order by created_at asc
  limit 1;

  if seed_admin_id is null then
    raise exception 'An administrator profile is required to seed Floor research reports.';
  end if;

  insert into public.floor_research_publications (
    slug,
    publication_type,
    title,
    excerpt,
    body,
    tickers,
    sources,
    author_id,
    reviewer_id,
    public_byline,
    public_approval_label,
    status,
    published_at
  )
  values
    (
      'nvidia-ai-demand-meets-execution-test-q1-fy2027',
      'earnings_review',
      'NVIDIA: AI demand meets its next execution test',
      'Record data-center growth supports the infrastructure thesis, while concentration, supply execution, and expectations remain the central tests.',
      $report$
## Research question

Can NVIDIA convert exceptional AI infrastructure demand into durable growth without allowing supply constraints, customer concentration, or elevated expectations to weaken the case?

## Base case

NVIDIA remains the primary compute platform for accelerated AI workloads. Fiscal first-quarter 2027 revenue reached $81.6 billion, up 85% from a year earlier, while Data Center revenue reached $75.2 billion, up 92%. Those results show that demand is not confined to an early experimentation phase. Customers are deploying larger systems and treating accelerated computing as core infrastructure.

The strongest part of the case is not one quarter of growth. It is the combination of hardware, networking, software, and a large developer ecosystem. That integrated platform can reduce deployment friction and make replacement decisions more difficult than a simple chip comparison suggests. Gross margin also remained high at 74.9% on a GAAP basis, indicating that rapid growth has not yet required a material sacrifice in pricing or mix.

## Contrary evidence and risks

Data Center represented roughly 92% of quarterly revenue, so the company is increasingly dependent on one spending cycle. A small number of hyperscale and sovereign customers can change procurement schedules quickly. Large customers are also developing internal accelerators, and competing silicon could become more credible for specialized inference workloads.

The current operating performance leaves little room for execution errors. Delays in new architectures, networking bottlenecks, power constraints, export restrictions, or slower customer monetization could create an air pocket even if the long-term AI theme remains intact. High gross margin is evidence of platform strength, but it also invites competition and customer efforts to lower their compute costs.

## Invalidation conditions

The base case would weaken materially if Data Center growth falls sharply for multiple quarters while customer capital spending remains healthy, suggesting share loss rather than a cyclical pause. It would also weaken if gross margin compresses persistently without a clear product-transition explanation, or if major cloud customers shift a meaningful share of production workloads to internal or competing accelerators.

## What to watch

- Fiscal second-quarter results scheduled for August 26, 2026.
- Blackwell and next-generation system delivery timing, including networking and power availability.
- Data Center growth relative to reported hyperscaler capital spending.
- Gross-margin direction through product transitions.
- Evidence that inference demand is broadening beyond a small group of frontier-model customers.

## Loombus view

The evidence supports a durable infrastructure franchise, but the research standard is demanding: growth must remain broad enough, margins must remain resilient, and product execution must keep pace with customer budgets. This is a monitored operating thesis, not a rating or personalized investment advice.
      $report$,
      array['NVDA'],
      '[
        {"label":"NVIDIA Q1 FY2027 financial results","url":"https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-First-Quarter-Fiscal-2027/default.aspx"},
        {"label":"NVIDIA FY2026 Form 10-K","url":"https://investor.nvidia.com/files/doc_financials/2026/q4/10K-NVDA.pdf"},
        {"label":"NVIDIA Q2 FY2027 earnings event","url":"https://investor.nvidia.com/events-and-presentations/events-and-presentations/event-details/2026/NVIDIA-2nd-Quarter-FY27-Financial-Results/default.aspx"}
      ]'::jsonb,
      null,
      null,
      'Loombus Research Desk',
      'Loombus',
      'review',
      null
    ),
    (
      'microsoft-cloud-backlog-and-ai-capital-intensity-fy2026',
      'earnings_review',
      'Microsoft: Cloud backlog meets the AI capital-intensity test',
      'Azure growth and a record commercial backlog strengthen visibility, but infrastructure spending must translate into durable margins and cash returns.',
      $report$
## Research question

Can Microsoft turn its expanding cloud backlog and AI adoption into durable earnings growth while absorbing the capital intensity required to build the infrastructure?

## Base case

Microsoft closed fiscal 2026 with broad operating momentum. Fourth-quarter revenue was $90.0 billion, up 18%, and Microsoft Cloud revenue reached $59.3 billion, up 27%. Azure and other cloud services grew 43%, while commercial remaining performance obligation reached $678 billion, up 84%. That backlog does not guarantee an even revenue path, but it provides unusually strong visibility into contracted demand.

The platform has several routes to monetize AI: Azure infrastructure, Microsoft 365 Copilot, developer tools, security, and industry applications. Microsoft reported more than 30 million paid Microsoft 365 Copilot seats. Distribution across existing enterprise relationships may be as important as model quality because it reduces the cost of introducing AI features into established workflows.

## Contrary evidence and risks

The central tension is capital intensity. AI data centers require large, continuous investment before the related revenue and utilization are fully visible. If capacity is built faster than demand becomes economic, depreciation and operating costs can pressure margins and free cash flow. The reported backlog also includes large, long-dated commitments whose conversion may be uneven.

Not every segment is equally strong. More Personal Computing revenue declined 4%, and Xbox content and services revenue declined 10% in the quarter. Competition in cloud infrastructure and productivity AI remains intense, while customers may resist paying for copilots that do not demonstrate measurable productivity gains.

## Invalidation conditions

The base case would weaken if Azure growth decelerates materially while AI capital expenditures remain elevated, if commercial backlog growth stops converting into cloud revenue, or if cloud gross-margin pressure persists after capacity constraints ease. A sustained gap between AI adoption metrics and paid usage would also challenge the monetization thesis.

## What to watch

- Azure growth and capacity commentary over the next four quarters.
- Capital expenditures, depreciation, and Microsoft Cloud gross margin.
- Commercial backlog conversion and the mix of long-dated commitments.
- Paid Copilot seats, usage depth, and evidence of customer renewals.
- Whether weakness in gaming and personal computing remains contained.

## Loombus view

Microsoft has demand visibility, distribution, and a broad monetization surface. The unresolved question is whether returns on the new infrastructure remain as attractive as the software economics investors have historically expected. This is a monitored operating thesis, not a rating or personalized investment advice.
      $report$,
      array['MSFT'],
      '[
        {"label":"Microsoft FY2026 Q4 financial results","url":"https://www.microsoft.com/en-us/investor/earnings/fy-2026-q4/press-release-webcast"},
        {"label":"Microsoft investor relations annual reports","url":"https://www.microsoft.com/en-us/investor/annual-reports"}
      ]'::jsonb,
      null,
      null,
      'Loombus Research Desk',
      'Loombus',
      'review',
      null
    ),
    (
      'amazon-aws-acceleration-versus-ai-capex-q2-2026',
      'earnings_review',
      'Amazon: AWS acceleration versus the AI capital bill',
      'AWS growth and advertising momentum are strong, while free cash flow and reported earnings require careful normalization.',
      $report$
## Research question

Does accelerating AWS demand justify Amazon's rapidly expanding AI infrastructure investment, or is capital spending outrunning the economic return?

## Base case

Amazon's second-quarter 2026 results show simultaneous strength in cloud, commerce, and advertising. Net sales rose 20% to $200.6 billion and operating income rose 43% to $27.5 billion. AWS sales increased 37% to $42.2 billion, while AWS operating income reached $16.6 billion compared with $10.2 billion a year earlier. Advertising services grew 26%.

AWS is the clearest driver of incremental earnings. The company stated that both its AI business and custom silicon business exceeded a $25 billion annual revenue run rate. If utilization remains high, Amazon can spread infrastructure costs across external cloud customers and its own retail, advertising, and logistics workloads.

## Contrary evidence and risks

Reported net income of $62.6 billion overstates the quarter's recurring operating economics because it included $53.4 billion of non-operating pretax income, primarily related to Amazon's investment in Anthropic. That gain should not be treated as normal operating profit.

The cash-flow picture also demands caution. Trailing-twelve-month operating cash flow increased 33% to $161.4 billion, but free cash flow was an outflow of $7.6 billion as purchases of property and equipment increased by $66.1 billion, primarily for AI. Cloud demand can remain strong while returns disappoint if capacity utilization, pricing, or useful asset lives prove weaker than expected.

## Invalidation conditions

The base case would weaken if AWS growth slows materially before capital intensity moderates, if AWS operating margin compresses without a temporary capacity explanation, or if consolidated free cash flow remains structurally negative after the current build cycle. It would also weaken if retail efficiency reverses and North American operating leverage deteriorates.

## What to watch

- AWS revenue growth and operating margin.
- Capital expenditures relative to operating cash flow and incremental AWS revenue.
- Free cash flow excluding investment valuation effects.
- Adoption of Trainium, Inferentia, and higher-level AI services.
- Advertising growth and North American retail operating leverage.

## Loombus view

The operating evidence is strong, especially in AWS, but the investment case cannot be evaluated from reported net income alone. The next test is whether the AI build produces sustained utilization and restores free cash flow after the investment peak. This is a monitored operating thesis, not a rating or personalized investment advice.
      $report$,
      array['AMZN'],
      '[
        {"label":"Amazon Q2 2026 financial results","url":"https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Second-Quarter-Results/"},
        {"label":"Amazon SEC filings","url":"https://ir.aboutamazon.com/sec-filings/default.aspx"}
      ]'::jsonb,
      null,
      null,
      'Loombus Research Desk',
      'Loombus',
      'review',
      null
    ),
    (
      'jpmorgan-scale-revenue-and-credit-discipline-q2-2026',
      'earnings_review',
      'JPMorgan Chase: Scale is working, but credit discipline remains the test',
      'Broad revenue growth and balance-sheet expansion support the franchise case, while credit costs, expenses, and nonrecurring items require monitoring.',
      $report$
## Research question

Can JPMorgan Chase continue turning scale, technology investment, and franchise breadth into durable returns without allowing credit costs or expense growth to erode the advantage?

## Base case

Second-quarter 2026 managed revenue reached $58.0 billion, up 27% from a year earlier, and reported net income reached $21.2 billion. Managed net interest income was $25.6 billion, up 10%. Revenue was broad: Consumer and Community Banking grew 8%, Commercial and Investment Bank grew 27%, and Asset and Wealth Management grew 19%.

The balance sheet also expanded. Total loans reached $1.54 trillion, up 9% from a year earlier, and deposits reached $2.71 trillion, up 6%. The franchise benefits from multiple earnings engines and a funding base that can support customers through different market environments.

## Contrary evidence and risks

Quarterly strength should not be extrapolated without adjustment. Corporate revenue rose sharply and can contain items that do not repeat. Noninterest expense increased 15% from a year earlier to $27.3 billion, including continued growth in technology, professional services, and marketing. Those investments can reinforce the moat, but only if revenue and productivity gains persist.

Provision for credit losses was $2.5 billion. Credit costs remain manageable relative to earnings, yet card balances were up 7% and wholesale loans were up 15%. Faster balance-sheet growth raises the importance of underwriting quality, reserve discipline, and loss formation. Regulatory capital changes and market normalization can also affect returns independently of customer activity.

## Invalidation conditions

The base case would weaken if net charge-offs and provisions rise faster than loan growth for several quarters, if expense growth persistently exceeds core revenue growth, or if deposit pricing causes sustained pressure on net interest income. It would also weaken if strong market-related revenue masks deterioration in consumer or commercial credit.

## What to watch

- Net charge-offs, reserve changes, and delinquency formation, especially in cards.
- Managed net interest income and deposit costs.
- Expense growth relative to core, recurring revenue.
- Commercial and Investment Bank revenue after market activity normalizes.
- Capital requirements and management's return-on-equity response.

## Loombus view

JPMorgan's diversified franchise and earnings capacity remain evident. The accountability test is whether credit and expense discipline stay intact as the balance sheet grows and unusually strong revenue items normalize. This is a monitored operating thesis, not a rating or personalized investment advice.
      $report$,
      array['JPM'],
      '[
        {"label":"JPMorgan Chase 2Q26 earnings supplement","url":"https://www.jpmorganchase.com/content/dam/jpmc/jpmorgan-chase-and-co/investor-relations/documents/quarterly-earnings/2026/2nd-quarter/c9c097af-34e9-4aae-92d2-909a2ab7c083.pdf"},
        {"label":"JPMorgan Chase quarterly earnings","url":"https://www.jpmorganchase.com/ir/quarterly-earnings"}
      ]'::jsonb,
      null,
      null,
      'Loombus Research Desk',
      'Loombus',
      'review',
      null
    ),
    (
      'exxonmobil-cash-flow-through-commodity-volatility-q2-2026',
      'earnings_review',
      'ExxonMobil: Testing cash-flow durability through commodity volatility',
      'Advantaged production and structural savings strengthened second-quarter cash generation, but commodity exposure and geopolitical disruption remain decisive variables.',
      $report$
## Research question

Can ExxonMobil's advantaged assets and structural cost reductions produce durable cash flow across the commodity cycle, rather than only during supportive price and margin environments?

## Base case

ExxonMobil reported second-quarter 2026 earnings of $14.5 billion and adjusted earnings of $14.7 billion. Cash flow from operations was $23.6 billion and free cash flow was $17.2 billion. The company distributed $9.4 billion to shareholders through $4.3 billion of dividends and $5.1 billion of repurchases.

The operating case rests on portfolio quality and unit-cost improvement. Production reached its highest level in more than two decades when Middle East disruptions are excluded, Permian production set a record, and cumulative structural cost savings reached $16.3 billion. A fifth Guyana production vessel remained scheduled to start in the fourth quarter of 2026, adding planned capacity of 250 thousand barrels per day.

## Contrary evidence and risks

The quarter benefited from supportive commodity markets and refining conditions, so current earnings are not a clean estimate of mid-cycle power. Energy prices, crack spreads, chemical margins, and derivative timing can move results faster than operational improvements. Middle East disruptions also reduced production and demonstrate that geopolitical exposure can affect both volumes and prices.

Shareholder distributions are supported by strong current cash flow, but durability depends on project execution and capital discipline if commodity prices fall. Large projects carry schedule, cost, reservoir, regulatory, and country risks. Cost savings also become harder to extend as the program matures.

## Invalidation conditions

The base case would weaken if new Guyana and Permian volumes fail to offset mature-field decline, if structural savings stop improving unit economics, or if free cash flow becomes insufficient to cover the dividend and planned capital program during a moderate commodity downturn. Repeated project delays or material cost overruns would also challenge the portfolio-quality claim.

## What to watch

- Fourth-quarter 2026 startup and ramp of the fifth Guyana production vessel.
- Permian production growth and unit costs.
- Free cash flow after capital expenditures at less supportive oil and refining prices.
- Progress toward the company's 2030 structural-savings target.
- Net debt, dividends, and repurchases across the cycle.

## Loombus view

The quarter supports the view that advantaged assets and cost reductions have improved the business. The real test is not peak earnings, but whether free cash flow and project returns remain resilient when commodity support fades. This is a monitored operating thesis, not a rating or personalized investment advice.
      $report$,
      array['XOM'],
      '[
        {"label":"ExxonMobil Q2 2026 financial results","url":"https://investor.exxonmobil.com/company-information/press-releases/detail/1208/exxonmobil-announces-second-quarter-2026-results"},
        {"label":"ExxonMobil 2025 results and long-term operating context","url":"https://corporate.exxonmobil.com/news/news-releases/2026/0130-exxonmobil-announces-2025-results"}
      ]'::jsonb,
      null,
      null,
      'Loombus Research Desk',
      'Loombus',
      'review',
      null
    )
  on conflict (slug) do nothing;

  insert into public.floor_research_publication_provenance (
    publication_id,
    generation_method,
    model_provider,
    model_name,
    prompt_version,
    generated_at,
    created_by,
    internal_review_notes
  )
  select
    publication.id,
    'ai_generated',
    'OpenAI',
    'GPT-5.6',
    'floor-launch-research-v1',
    now(),
    seed_admin_id,
    'Drafted from primary company investor-relations materials. Verify every numerical claim, source link, risk statement, and date before publishing. Public attribution must remain Loombus Research Desk with approval by Loombus.'
  from public.floor_research_publications publication
  where publication.slug in (
    'nvidia-ai-demand-meets-execution-test-q1-fy2027',
    'microsoft-cloud-backlog-and-ai-capital-intensity-fy2026',
    'amazon-aws-acceleration-versus-ai-capex-q2-2026',
    'jpmorgan-scale-revenue-and-credit-discipline-q2-2026',
    'exxonmobil-cash-flow-through-commodity-volatility-q2-2026'
  )
  on conflict (publication_id) do nothing;
end;
$$;

notify pgrst, 'reload schema';

commit;
