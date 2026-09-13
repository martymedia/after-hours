# Motion

Micro-interactions follow the recipes from [transitions.dev](https://transitions.dev)
(Jakub Antalik; free recipes published as an agent skill at
`Jakubantalik/transitions.dev`). We keep the same token scale and the same
`t-*` class hooks so the recipes stay recognisable.

Where it lives:

- `src/app/motion.css`: motion tokens and every `t-*` block, each with its
  `prefers-reduced-motion` guard.
- `src/components/motion.tsx`: React wrappers. `Seg` (sliding segmented
  control), `SwapText` (text states swap), `PopNumber` (digit pop-in on
  change), `SuccessCheck` (drawn check), `StaggerReveal` (texts reveal),
  `Tilt` (card hover tilt with glare), `useSlidingPill` (phone tab bar).

Where each one is used:

| Recipe | Used for |
| --- | --- |
| Texts reveal | Landing hero: tagline, headline, paragraph |
| Rise (ours, now with blur) | Cards and result panels entering |
| Text states swap + shimmer | Buy button label through route, wallet, onchain |
| Number pop-in | Prices in the stocks list when the 60 s refresh changes them |
| Success check | The check in the "You own X now" card |
| Error state shake | The error card under the buy button |
| Tabs sliding | Issuer and Show filters, 24h/7d range, phone tab bar |
| Tooltip | Every `Tip`: 80 ms delay, fade and scale in, instant out |
| Notification badge | Blue dot on the Wallet menu entry when connected |
| Icon swap | Rail collapse chevrons |
| Modal | Wallet picker open and close |
| Skeleton reveal | Wallet page content after loading |
| Card tilt | Trend tiles on the landing page (mouse only, 7 degrees) |

Rules: durations by usage, not by feel (150 close, 250 open, 500 emphasis);
blur stays at 2 to 3 px; replaying an animation needs a reflow between class
removal and re-add; the tabs pill takes its first position without a
transition; never strip the reduced-motion guards.
