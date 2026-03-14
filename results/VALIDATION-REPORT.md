# Vibe Engine Validation Report

Generated: 2026-03-14T02:34:31.137Z

## Historical Events Analysis

| Metric | Result | Target |
|--------|--------|--------|
| Dominant emotion match | 16/20 (80%) | ≥80% |
| Secondary emotion match | 20/20 (100%) | ≥70% |
| Avg consensus | 0.995 | — |

### Per-Event Results

| Event | Expected | Actual | Match | Top 3 | Signal Quality | Consensus |
|-------|----------|--------|-------|-------|----------------|-----------|
| September 11 Attacks | fear | fear | ✓ | fear(0.82), sadness(0.68), surprise(0.61) | clear | 0.994 |
| Apollo 11 Moon Landing | joy | joy | ✓ | joy(0.66), trust(0.40), surprise(0.37) | clear | 0.996 |
| COVID-19 Global Lockdowns | fear | fear | ✓ | fear(0.74), anticipation(0.50), sadness(0.45) | clear | 0.997 |
| COVID-19 Vaccine Approval | joy | anticipation | ✗ | anticipation(0.64), joy(0.63), trust(0.59) | clear | 0.996 |
| 2008 Financial Crisis | fear | fear | ✓ | fear(0.80), sadness(0.50), anticipation(0.44) | clear | 0.992 |
| Osama bin Laden Killed | surprise | joy | ✗ | joy(0.44), surprise(0.43), trust(0.23) | clear | 0.994 |
| George Floyd Protests | anger | anger | ✓ | anger(0.75), sadness(0.60), fear(0.41) | clear | 0.995 |
| Trump Wins 2016 Election | surprise | surprise | ✓ | surprise(0.68), anticipation(0.30), fear(0.26) | clear | 0.995 |
| Hurricane Katrina | fear | sadness | ✗ | sadness(0.74), fear(0.67), surprise(0.29) | clear | 0.990 |
| SpaceX First Rocket Landing | joy | joy | ✓ | joy(0.68), trust(0.55), surprise(0.49) | clear | 0.996 |
| Fukushima Nuclear Disaster | fear | fear | ✓ | fear(0.80), sadness(0.63), anticipation(0.47) | clear | 0.993 |
| Brexit Vote | surprise | surprise | ✓ | surprise(0.54), fear(0.41), anticipation(0.32) | clear | 0.997 |
| Germany 7-1 Brazil (World Cup 2014) | surprise | surprise | ✓ | surprise(0.71), sadness(0.58), anger(0.17) | clear | 0.994 |
| Obama Elected President | joy | joy | ✓ | joy(0.73), anticipation(0.61), trust(0.51) | clear | 0.998 |
| Kobe Bryant Death | sadness | sadness | ✓ | sadness(0.83), surprise(0.39), fear(0.16) | clear | 0.998 |
| Boston Marathon Bombing | fear | fear | ✓ | fear(0.76), sadness(0.63), surprise(0.50) | clear | 0.996 |
| Supreme Court Legalizes Same-Sex Marriage | joy | joy | ✓ | joy(0.76), trust(0.43), anticipation(0.33) | clear | 0.993 |
| Russia Invades Ukraine | fear | fear | ✓ | fear(0.75), sadness(0.62), anger(0.51) | clear | 0.996 |
| Titan Submersible Implosion | fear | sadness | ✗ | sadness(0.73), fear(0.44), surprise(0.31) | clear | 0.997 |
| Japan Beats Germany and Spain at 2022 World Cup | surprise | surprise | ✓ | surprise(0.78), joy(0.65), anticipation(0.31) | clear | 0.998 |

### Divergence Thesis

- Clear events avg consensus: **0.995** (n=16)
- Polarizing events avg consensus: **0.995** (n=4)

**Result: Divergence thesis SUPPORTED** — polarizing events produce lower model consensus.
