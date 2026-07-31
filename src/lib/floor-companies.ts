export type FloorCompany = {
  ticker: string;
  name: string;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  description: string | null;
  website: string | null;
  country: string | null;
};

const KNOWN_COMPANIES: Record<string, Omit<FloorCompany, "ticker">> = {
  NVDA: {
    name: "NVIDIA Corporation",
    exchange: "NASDAQ",
    sector: "Technology",
    industry: "Semiconductors",
    description: "A computing platform company whose products span accelerated computing, graphics, networking, and artificial intelligence infrastructure.",
    website: "https://www.nvidia.com",
    country: "United States",
  },
  AMD: {
    name: "Advanced Micro Devices, Inc.",
    exchange: "NASDAQ",
    sector: "Technology",
    industry: "Semiconductors",
    description: "A semiconductor company focused on high-performance computing, graphics, embedded products, and data-center processors.",
    website: "https://www.amd.com",
    country: "United States",
  },
  AAPL: {
    name: "Apple Inc.",
    exchange: "NASDAQ",
    sector: "Technology",
    industry: "Consumer Electronics",
    description: "A consumer technology company that designs devices, software, and services across a tightly integrated ecosystem.",
    website: "https://www.apple.com",
    country: "United States",
  },
  MSFT: {
    name: "Microsoft Corporation",
    exchange: "NASDAQ",
    sector: "Technology",
    industry: "Software and Cloud Computing",
    description: "A software and cloud-computing company serving consumers, enterprises, developers, and public-sector organizations.",
    website: "https://www.microsoft.com",
    country: "United States",
  },
  AMZN: {
    name: "Amazon.com, Inc.",
    exchange: "NASDAQ",
    sector: "Consumer Discretionary",
    industry: "Internet Retail and Cloud Computing",
    description: "A commerce, logistics, advertising, and cloud-computing company operating a broad global technology platform.",
    website: "https://www.amazon.com",
    country: "United States",
  },
  TSLA: {
    name: "Tesla, Inc.",
    exchange: "NASDAQ",
    sector: "Consumer Discretionary",
    industry: "Automotive and Energy",
    description: "An electric-vehicle and energy company developing vehicles, storage systems, charging infrastructure, and related software.",
    website: "https://www.tesla.com",
    country: "United States",
  },
  META: {
    name: "Meta Platforms, Inc.",
    exchange: "NASDAQ",
    sector: "Communication Services",
    industry: "Interactive Media",
    description: "A technology company operating social, messaging, advertising, and virtual-reality products.",
    website: "https://about.meta.com",
    country: "United States",
  },
  GOOGL: {
    name: "Alphabet Inc.",
    exchange: "NASDAQ",
    sector: "Communication Services",
    industry: "Internet Content and Information",
    description: "A technology holding company whose businesses include search, advertising, cloud computing, video, and emerging technology initiatives.",
    website: "https://abc.xyz",
    country: "United States",
  },
};

export function normalizeFloorTicker(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 12);
}

export function getFloorCompany(value: string): FloorCompany {
  const ticker = normalizeFloorTicker(value);
  const known = KNOWN_COMPANIES[ticker];
  return known
    ? { ticker, ...known }
    : {
        ticker,
        name: ticker,
        exchange: null,
        sector: null,
        industry: null,
        description: null,
        website: null,
        country: null,
      };
}

export function companyPath(value: string) {
  return `/the-floor/company/${encodeURIComponent(normalizeFloorTicker(value))}`;
}
