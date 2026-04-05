# Video Validation: Detonation Radius

**The Vibe Engine doesn't just score text. It scores video — and the same emotional physics that govern a Super Bowl ad govern a movie trailer, a political speech, a CEO apology, and a product launch.**

This validation extends the engine from text-based emotion detection to **multimodal video scoring** with audience alignment analysis. We scored **110 pieces of content** across **14 categories** spanning 60 years of media.

---

## The Detonation Radius Metric

**Detonation Radius (DET)** measures the total brand/communication risk of any content put in front of humans:

```
DET = Friendly Fire Risk (FF) x Attention Economy Multiplier (AE)
```

| Component | Range | What It Measures |
|---|---|---|
| **Friendly Fire (FF)** | 0-10 | Will core audience feel betrayed? |
| **Attention Economy Multiplier (AE)** | 0.5-5.0 | How much does delivery context amplify impact? |
| **Fatigue Velocity (FV)** | 0.0-1.0 | How fast does repeated viewing turn it toxic? |

### DET Severity Scale

| DET | Zone | What Happens |
|---|---|---|
| 0-5 | QUIET WIN | Safe. Functional. Forgettable. |
| 5-15 | PRECISION STRIKE | High impact, core audience intact. |
| 15-30 | DETONATION | Backlash. Identity crisis. Get legal involved. |
| 30+ | NUCLEAR | Career-ending. Brand erasure. See: Pepsi Jenner. |

---

## Scoring Methodology

### Dual-Channel Video Analysis

Each video is scored through **4 parallel Gemini 2.0 Flash calls**:

1. **Audio Channel** — Dialogue, music, sound effects, vocal tone, pacing. Plutchik 8-emotion scoring per ~5-second segment.
2. **Video Channel** — Visual composition, facial expressions, body language, editing rhythm, color grading. Scored independently from audio.
3. **Object-Association Analysis** — Every significant object gets a baseline emotional loading and a contextual loading. Inversions (Euclidean distance > 0.2) indicate symbolic manipulation.
4. **Audience Alignment** — Core audience identification, content target analysis, Friendly Fire risk, core reaction classification.

### Phase Coherence

Audio and video emotion vectors are compared per-segment via cosine similarity:

```
PC(t) = (A(t) . V(t)) / (|A(t)| * |V(t)|)
```

| PC Range | Assessment | Meaning |
|---|---|---|
| > 0.7 | SYNCHRONIZED | Audio and video telling the same story |
| 0.3-0.7 | COMPLEMENTARY | Working together but different emphasis |
| -0.3-0.3 | INDEPENDENT | Audio and video decoupled |
| < -0.3 | CONTRADICTORY | Emotional phase cancellation ("feels like lying") |

### Emotional Compound Chemistry

When two Plutchik emotions co-occur above 0.25, they form compounds (per Plutchik's dyad theory):

| Compound | Components | Toxicity |
|---|---|---|
| Love | Joy + Trust | Low |
| Optimism | Joy + Anticipation | Low |
| Awe | Fear + Surprise | Low |
| Contempt | Disgust + Anger | **High** |
| Remorse | Sadness + Disgust | **High** |
| Outrage | Surprise + Anger | **High** |

### Core Audience Reaction Classification

| Reaction | Definition |
|---|---|
| EMBRACED | Core audience loves it. Identity reinforced. |
| VALIDATED | Core audience approves. Expectations met. |
| NEUTRAL | Core audience doesn't care. Neither helped nor hurt. |
| CONFUSED | Core audience is uncertain. Mixed signals. |
| ALIENATED | Core audience feels excluded. Brand distance growing. |
| BETRAYED | Core audience feels attacked by their own brand. |

---

## The Four Targeting Quadrants

Every piece of scored content falls into one of four quadrants:

```
           HIGH AE (Loud)
                |
    DETONATION  |  PRECISION STRIKE
    (high risk) |  (high impact)
  ──────────────┼──────────────
    SLOW BURN   |  QUIET WIN
    (quiet rot) |  (safe bet)
                |
           LOW AE (Quiet)

  HIGH FF ←──────────→ LOW FF
  (core betrayed)    (core intact)
```

**PRECISION STRIKE** (High AE, Low FF): The sweet spot. Massive cultural impact, core audience intact. Examples: Apple 1984, Nike Kaepernick, Barbie 2023, Top Gun: Maverick.

**DETONATION** (High AE, High FF): Viral catastrophe. Examples: Pepsi Jenner (DET 34.2), Cats 2019 (DET 27.0), Gillette "We Believe" (DET 28.0).

**SLOW BURN** (Low AE, High FF): The brand slowly dies. Nobody notices until revenue drops. Examples: Tropicana rebrand ($50M loss), Gap logo (reversed in 6 days).

**QUIET WIN** (Low AE, Low FF): Safe. Stable. Forgettable but functional. Most B2B marketing lives here.

---

## Key Findings

### 1. Detonation Radius Is Universal

The same metric predicts failure across:
- Super Bowl ads (Pepsi Jenner DET 34.2)
- Movie trailers (Cats DET 27.0, Ghostbusters 2016 DET 19.0)
- Product launches (Cybertruck DET 7.6)
- Political ads (LBJ Daisy, Reagan Morning in America)
- Corporate crises (BP Sorry, United Airlines)
- Brand pivots (Jaguar Copy Nothing, New Coke)
- PSAs (CDC Tips, NZ Mistakes)
- Music videos (This Is America)

### 2. Award Winners Live in the Safe Zone

| Category | Avg DET | Avg FF | Interpretation |
|---|---|---|---|
| Cannes Grand Prix | 4.2 | 1.1 | Awards go to Precision Strikes |
| Effie Grand | 3.0 | 1.0 | Effectiveness = low friendly fire |
| Controversial | 18.4 | 6.3 | Controversy = high friendly fire |
| Brand Pivots | 16.8+ | 7.0+ | Rebrands are inherently dangerous |

### 3. The Nike vs. Pepsi Paradox

Both Nike Kaepernick and Pepsi Jenner scored high Detonation Radius. But Nike's core reaction was **VALIDATED** while Pepsi's was **ALIENATED**.

The difference: Nike's core audience (athletes, young progressives) agreed with the message. Pepsi's core audience (everyone who drinks soda) had no relationship to protest imagery.

**DET alone doesn't predict failure. DET + Core Reaction does.**

- DET 27 + VALIDATED = Calculated risk that paid off ($6B brand value increase)
- DET 34 + ALIENATED = Accidental detonation (CMO fired, ad pulled)

### 4. Trailers vs. Products

Star Wars: The Last Jedi trailer scored **VALIDATED** (DET 4.2), but the movie split the fanbase. This proves the engine correctly measures the **content as presented**, not the product it represents. Trailers are marketing — and TLJ's marketing was competent even if the movie was divisive.

---

## Categories Scored

| Category | Count | Content Type | Span |
|---|---|---|---|
| iconic | 27 | Classic ads | 1971-2019 |
| superbowl-2025 | 20 | TV commercials | 2025 |
| cannes | 10 | Cannes GP winners | 2003-2021 |
| apple | 10 | Apple ecosystem | 2024-2025 |
| april-fools-2025 | 7 | Seasonal campaigns | 2025 |
| movie-trailers | 7 | Film trailers | 2016-2023 |
| controversial | 6 | Divisive campaigns | 2013-2023 |
| political | 5 | Political ads | 1964-2020 |
| product-launches | 4 | Product reveals | 2007-2024 |
| brand-pivots | 4 | Rebranding efforts | 1985-2024 |
| crisis-responses | 4 | Corporate crises | 2010-2022 |
| psa | 3 | Public safety | 2010-2014 |
| effie | 2 | Effie Grand winners | 2014-2020 |
| music-culture | 1 | Cultural content | 2018 |
| **TOTAL** | **110** | | **1964-2025** |

---

## How to Read a Score

Each scored piece produces a full emotional profile:

```json
{
  "vibeScore": 698,
  "dominantEmotion": "anticipation",
  "consensus": {
    "joy": 0.45, "trust": 0.30, "fear": 0.15, "surprise": 0.55,
    "sadness": 0.10, "disgust": 0.05, "anger": 0.20, "anticipation": 0.70
  },
  "phaseCoherence": { "average": 0.82, "assessment": "SYNCHRONIZED" },
  "audienceAlignment": {
    "friendlyFireRisk": 9,
    "coreReaction": "ALIENATED",
    "audienceDistance": 8
  },
  "attentionEconomy": {
    "attentionEconomyMultiplier": 3.8,
    "fatigueVelocity": 0.7,
    "detonationRadius": 34.2
  }
}
```

---

## Reproduce

The video scoring pipeline requires:
- Python 3.10+
- Gemini API key (gemini-2.0-flash)
- yt-dlp for video download

```bash
cd hermes-env
source bin/activate
python batch-score-expansion.py wave2  # Score Wave 2 expansion
python batch-score-expansion.py rebuild  # Rebuild universal leaderboard
```

Results are saved per-category in `~/.hermes/video-scores/[category]/`.

---

Built by [Ad+Verb Labs](https://adverblabs.com) | Engine: [VibeScore](https://vibe-score.ai)
