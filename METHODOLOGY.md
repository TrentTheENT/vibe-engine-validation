# Methodology

## Theoretical Framework

The Vibe Engine is built on Robert Plutchik's psychoevolutionary theory of emotion (1980), which posits 8 basic emotions arranged in opposing pairs:

- **Joy** <-> Sadness
- **Trust** <-> Disgust
- **Fear** <-> Anger
- **Surprise** <-> Anticipation

These 8 emotions are biologically fundamental and universally recognized across cultures (Ekman 1992, Barrett 2017). Every complex emotion can be decomposed into combinations of these primaries — the way every color can be decomposed into RGB.

## Scoring Architecture

### Multi-Model Consensus

The engine sends each text to N AI models simultaneously:

1. **Claude** (Anthropic) — nuanced contextual understanding
2. **GPT-4o** (OpenAI) — broad general intelligence
3. **Gemini** (Google) — multimodal reasoning
4. **Grok** (xAI) — social media and cultural context

Each model receives the same structured prompt asking it to score the text on all 8 emotions on a continuous 0.0 to 1.0 scale. Models respond independently — no model sees another model's scores.

### Consensus Computation

For each emotion E:
- `consensus[E] = mean(model_scores[E])` across all responding models
- `divergence[E] = variance(model_scores[E])` across all responding models

### Signal Quality Classification

- **Clear**: Low divergence across all emotions. Models agree on the emotional content.
- **Mixed**: Moderate divergence. The text contains genuinely mixed emotions.
- **Divergent**: High divergence. The text is emotionally ambiguous — different reasonable readings exist.

The key insight: **divergence is signal, not noise.** When models disagree about whether a text is angry or sad, the text is genuinely emotionally complex. A system that forces a single label loses this information.

## Validation Design

### Why These Tests

We designed 5 complementary test suites, each proving a different property:

1. **Historical Events** — ecological validity. Does the engine agree with shared human experience?
2. **Sarcasm Detection** — pragmatic understanding. Can it read intent, not just words?
3. **Richness vs. Sentiment** — dimensionality. Does 8D scoring capture what 1D cannot?
4. **Domain Transfer** — generalization. Does it work outside Reddit/social media training data?
5. **GoEmotions Benchmark** — academic rigor. How does it compare to published baselines?

### Historical Events Selection Criteria

Events were selected based on:
- **Universality**: The emotional response is widely shared and well-documented
- **Temporal diversity**: Events span 1969-2023
- **Emotional diversity**: All 8 Plutchik emotions represented as expected dominants
- **Verifiability**: Headlines are publicly accessible from news archives

Headlines were curated to be representative (not cherry-picked for emotional intensity). 5 headlines per event were selected from different sources to capture framing variation.

### GoEmotions Preprocessing

1. Downloaded full GoEmotions dataset (58K texts) from Google Research GitHub
2. Mapped 27 emotion labels to Plutchik's 8 using published groupings
3. Excluded "neutral" labels (no Plutchik mapping)
4. Stratified-sampled 500 texts with seed=42 for reproducibility
5. Minimum 20 texts per Plutchik category to ensure fair evaluation

### Mapping Limitations

The 27-to-8 mapping introduces known labeling noise:

**Clean mappings (core 4):**
- joy, anger, fear, sadness map directly with minor expansion (e.g., grief -> sadness)
- These emotions have high agreement between annotators and models

**Lossy mappings (remaining 4):**
- trust <- admiration, approval, caring, gratitude (reasonable but debatable)
- surprise <- surprise, realization, confusion (confusion is a stretch)
- disgust <- disgust, disapproval (disapproval is more anger-adjacent)
- anticipation <- curiosity, desire, optimism (optimism is more joy-adjacent)

This is why we report core 4 and all 8 separately. The core 4 F1 (0.569) reflects the engine's true capability. The all-8 F1 (0.437) includes mapping penalty.

## Statistical Notes

### Sample Sizes

- Historical events: 20 events x 5 headlines = 100 texts
- Competitive tests: 20 texts (6 sarcasm/irony, 5 richness, 5 domain transfer, 4 consistency)
- GoEmotions: 500 texts (stratified sample from 58K)

### Metrics

- **Macro F1**: Unweighted average of per-class F1 scores. Treats rare emotions equally with common ones.
- **Precision**: Of texts we labeled as emotion E, what fraction actually was E?
- **Recall**: Of texts that were actually E, what fraction did we detect?
- **Dominant match rate**: Does the highest-scoring emotion match the expected dominant?
- **Secondary presence**: Do expected secondary emotions appear in the top 3?

### Model Status During Validation

All validation was run on 2026-03-13 with:
- Claude: ACTIVE (returning full emotion vectors)
- Gemini: ACTIVE (returning full emotion vectors)
- GPT-4o: OFFLINE (returning empty/zero vectors)
- Grok: OFFLINE (returning empty/zero vectors)

The engine handles model failures gracefully via `Promise.allSettled` with a 2-model minimum. All results reflect 2-model consensus.

## Known Limitations

1. **2-model scoring**: Less divergence data than the designed 4-model system
2. **GoEmotions domain**: Reddit comments are informal/social — doesn't test formal text
3. **English only**: All validation is English-language text
4. **Annotation subjectivity**: GoEmotions annotations have ~60% inter-annotator agreement
5. **No temporal stability test**: We haven't tested whether scores are stable across multiple runs (planned)
6. **Historical events corpus is small**: 100 headlines, manually curated (not randomized)
7. **Potential prompt sensitivity**: Changing the scoring prompt could change results
