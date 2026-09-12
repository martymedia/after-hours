// Plain-words descriptions and a sector for every stock we track. Written by
// hand: the app should tell a beginner what they are actually buying.

export type Sector =
  | "Index & ETFs"
  | "Semiconductors"
  | "Big tech"
  | "Crypto & fintech"
  | "Consumer"
  | "Games & media"
  | "Space, AI & mobility"
  | "Health & pharma"
  | "Energy"
  | "Banks & payments";

export type Company = { description: string; sector: Sector };

export const COMPANIES: Record<string, Company> = {
  SPY: { sector: "Index & ETFs", description: "SPDR S&P 500 ETF. One share tracks the 500 largest US companies, the broadest single bet on the US market." },
  QQQ: { sector: "Index & ETFs", description: "Invesco QQQ. Tracks the Nasdaq-100, the hundred largest non-financial companies on the Nasdaq, heavy on tech." },
  GLD: { sector: "Index & ETFs", description: "SPDR Gold Shares. Each share represents a slice of physical gold held in a vault." },
  DRAM: { sector: "Index & ETFs", description: "Roundhill Memory ETF. A basket of memory-chip makers such as Micron, SK Hynix and Sandisk." },
  NVDA: { sector: "Semiconductors", description: "NVIDIA designs the GPUs that run most AI training and inference, plus gaming graphics and data-center networking." },
  MU: { sector: "Semiconductors", description: "Micron Technology makes DRAM and NAND memory chips used in phones, PCs and AI servers." },
  SKHY: { sector: "Semiconductors", description: "SK Hynix, the Korean memory-chip maker behind much of the high-bandwidth memory in AI accelerators. Listed on Nasdaq in 2026." },
  SNDK: { sector: "Semiconductors", description: "Sandisk makes flash memory and storage, spun out of Western Digital in 2025." },
  AVGO: { sector: "Semiconductors", description: "Broadcom designs networking and custom AI chips and owns VMware's enterprise software." },
  AAPL: { sector: "Big tech", description: "Apple: iPhone, Mac, iPad, wearables and a growing services business." },
  MSFT: { sector: "Big tech", description: "Microsoft: Windows, Office, Azure cloud and a large stake in AI through OpenAI." },
  GOOGL: { sector: "Big tech", description: "Alphabet, Google's parent: search, YouTube, Android, Google Cloud and the Gemini AI models." },
  AMZN: { sector: "Big tech", description: "Amazon: the online store, AWS cloud, advertising and logistics." },
  META: { sector: "Big tech", description: "Meta Platforms: Facebook, Instagram, WhatsApp, and heavy spending on AI and headsets." },
  CRCL: { sector: "Crypto & fintech", description: "Circle Internet Group issues USDC, the dollar stablecoin most Solana trades settle in." },
  COIN: { sector: "Crypto & fintech", description: "Coinbase, the largest US crypto exchange, also runs the Base network and custody for institutions." },
  MSTR: { sector: "Crypto & fintech", description: "Strategy (formerly MicroStrategy) holds one of the largest corporate bitcoin treasuries alongside its software business." },
  STRC: { sector: "Crypto & fintech", description: "Strategy's variable-rate preferred stock (STRC). A yield instrument backed by the company, not the common shares." },
  HOOD: { sector: "Crypto & fintech", description: "Robinhood, the commission-free brokerage app, also runs crypto trading and its own tokenized stocks." },
  DFDV: { sector: "Crypto & fintech", description: "DeFi Development Corp, a public company that holds and stakes SOL as its main treasury asset." },
  MCD: { sector: "Consumer", description: "McDonald's, the world's largest restaurant chain, mostly run through franchisees." },
  KO: { sector: "Consumer", description: "Coca-Cola, the beverage company behind Coke, Sprite, Fanta and hundreds of other brands." },
  WEN: { sector: "Consumer", description: "The Wendy's Company, the burger chain." },
  DNUT: { sector: "Consumer", description: "Krispy Kreme, the doughnut chain." },
  NKE: { sector: "Consumer", description: "Nike, the sportswear company." },
  "BRK.B": { sector: "Consumer", description: "Berkshire Hathaway class B shares, Warren Buffett's holding company: insurance, railroads, energy and a large stock portfolio." },
  TTWO: { sector: "Games & media", description: "Take-Two Interactive publishes Grand Theft Auto, NBA 2K and Red Dead Redemption." },
  RBLX: { sector: "Games & media", description: "Roblox, the platform where users build and play games, with a young audience and its own currency." },
  GME: { sector: "Games & media", description: "GameStop, the video-game retailer that became a meme stock and now holds bitcoin on its balance sheet." },
  DKNG: { sector: "Games & media", description: "DraftKings, the US sports-betting and fantasy-sports app." },
  RDDT: { sector: "Games & media", description: "Reddit, the discussion platform, earning from ads and data-licensing deals with AI companies." },
  GRND: { sector: "Games & media", description: "Grindr, the dating app." },
  DJT: { sector: "Games & media", description: "Trump Media & Technology Group, the company behind Truth Social." },
  SPCX: { sector: "Space, AI & mobility", description: "SpaceX: rockets, Starship and the Starlink satellite internet business. Listed on Nasdaq in June 2026." },
  TSLA: { sector: "Space, AI & mobility", description: "Tesla: electric cars, energy storage, and bets on robotaxis and humanoid robots." },
  PLTR: { sector: "Space, AI & mobility", description: "Palantir sells data and AI software to governments and large companies." },
  BOT: { sector: "Space, AI & mobility", description: "RoboStrategy (BOT), a Nasdaq-listed robotics company. Check the issuer's page for the full profile." },
  SLV: { sector: "Index & ETFs", description: "iShares Silver Trust. Each share represents a slice of physical silver held in a vault." },
  TQQQ: { sector: "Index & ETFs", description: "ProShares UltraPro QQQ. A leveraged ETF that aims for three times the daily move of the Nasdaq-100, in both directions." },
  AMD: { sector: "Semiconductors", description: "AMD designs CPUs and GPUs for PCs, servers and AI data centers, NVIDIA's closest rival in accelerators." },
  INTC: { sector: "Semiconductors", description: "Intel makes PC and server processors and is rebuilding itself as a contract chip manufacturer." },
  MRVL: { sector: "Semiconductors", description: "Marvell Technology designs networking, storage and custom AI chips for data centers." },
  TSM: { sector: "Semiconductors", description: "TSMC, the Taiwanese foundry that manufactures most of the world's advanced chips, including Apple's and NVIDIA's." },
  ORCL: { sector: "Big tech", description: "Oracle sells databases, enterprise software and a cloud that hosts large AI training clusters." },
  IBM: { sector: "Big tech", description: "IBM: enterprise consulting, hybrid cloud software from Red Hat, mainframes and quantum research." },
  BMNR: { sector: "Crypto & fintech", description: "Bitmine Immersion Technologies runs bitcoin mining and holds a large Ether treasury; the stock moves with crypto prices." },
  V: { sector: "Banks & payments", description: "Visa runs the card network that routes payments between banks, earning a fee on every swipe." },
  JPM: { sector: "Banks & payments", description: "JPMorgan Chase, the largest US bank: consumer banking, investment banking, trading and asset management." },
  LLY: { sector: "Health & pharma", description: "Eli Lilly makes the GLP-1 diabetes and weight-loss drugs Mounjaro and Zepbound, plus insulin and cancer drugs." },
  NVO: { sector: "Health & pharma", description: "Novo Nordisk, the Danish maker of Ozempic and Wegovy, the other big name in GLP-1 weight-loss drugs." },
  UNH: { sector: "Health & pharma", description: "UnitedHealth Group, the largest US health insurer, plus the Optum care and pharmacy services arm." },
  HIMS: { sector: "Health & pharma", description: "Hims & Hers Health sells prescriptions online, from hair loss and skin care to compounded weight-loss drugs." },
  AZN: { sector: "Health & pharma", description: "AstraZeneca, the British-Swedish pharma group known for cancer, heart and respiratory drugs." },
  XOM: { sector: "Energy", description: "Exxon Mobil, the largest US oil and gas producer, from drilling to refining and chemicals." },
  CVX: { sector: "Energy", description: "Chevron, the second-largest US oil major, with big positions in the Permian Basin and Kazakhstan." },
  COST: { sector: "Consumer", description: "Costco runs membership warehouses selling groceries and goods in bulk at thin margins." },
  WMT: { sector: "Consumer", description: "Walmart, the largest retailer in the world by revenue, and a growing online and advertising business." },
  LULU: { sector: "Consumer", description: "Lululemon sells premium yoga and athletic apparel through its own stores and website." },
  PEP: { sector: "Consumer", description: "PepsiCo: Pepsi, Gatorade, Lay's, Doritos and Quaker, half drinks and half snacks." },
  PG: { sector: "Consumer", description: "Procter & Gamble makes everyday brands such as Tide, Pampers, Gillette and Oral-B." },
  FLWS: { sector: "Consumer", description: "1-800-Flowers.com sells flowers, gift baskets and gourmet food online." },
  AMC: { sector: "Games & media", description: "AMC Entertainment runs the largest cinema chain in the US and Europe, and is a favorite of retail traders." },
  NFLX: { sector: "Games & media", description: "Netflix, the streaming service with over 300 million subscribers, now also selling ads and live events." },
  VIDA: { sector: "Space, AI & mobility", description: "Vida Global builds an operating system for enterprise AI agents that handle calls, chat and email. A small NYSE listing from 2026." },
};

export const SECTOR_ORDER: Sector[] = [
  "Index & ETFs",
  "Semiconductors",
  "Big tech",
  "Crypto & fintech",
  "Consumer",
  "Games & media",
  "Space, AI & mobility",
  "Health & pharma",
  "Energy",
  "Banks & payments",
];

export function companyFor(underlying: string): Company {
  return (
    COMPANIES[underlying] ?? {
      sector: "Consumer",
      description: "A US-listed company. Check the issuer's page for the full profile.",
    }
  );
}
