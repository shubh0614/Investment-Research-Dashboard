# Semiconductor Industry — AI Competitive Landscape 2024-2025

**Source:** Industry Research Synthesis
**Document Type:** Competitive Landscape Overview

## Market Structure

The AI accelerator market has three distinct tiers:

### Tier 1 — Dominant Platform
**NVIDIA** (market share: ~80% of AI training, ~70% of inference)
- CUDA ecosystem lock-in: 4M+ developers, 20+ years of library investment
- Blackwell (B100/B200/GB200) represents largest architecture leap since Hopper
- Revenue: ~$120B run-rate annualized (Q3 FY2025)

### Tier 2 — Credible Challengers
**AMD** (market share: ~10-15% AI accelerators)
- MI300X competitive on memory bandwidth for inference
- ROCm software ecosystem closing the gap with CUDA
- Key win: Microsoft Azure for inference workloads

**Google TPU** (captive, not commercial)
- TPU v5: Deployed exclusively for internal Google workloads
- Reduces Google's NVIDIA purchases but not available to third parties
- Enables Google Cloud to offer differentiated AI services at lower cost

### Tier 3 — Emerging / Niche
**Intel Gaudi 3** — Price-competitive but limited software ecosystem
**AWS Trainium/Inferentia** — Captive for Amazon internal workloads
**Groq LPU** — Ultra-low latency inference; niche workloads
**Cerebras WSE-3** — Giant wafer-scale chips for sparse models
**SambaNova** — ReconfigurableDataflow Architecture for specific workloads

## Key Market Dynamics

### Training vs. Inference Split
- 2022: Training ~70%, Inference ~30% of AI compute spend
- 2024: Training ~50%, Inference ~50% (inference growing faster)
- 2026E: Training ~35%, Inference ~65% (as deployed models scale)

Inference favors: high memory bandwidth, low latency, energy efficiency
Training favors: high FLOP throughput, NVLink-scale cluster communication

### Scaling Laws and CapEx Supercycle
- Hyperscaler AI CapEx 2024: ~$200B (Microsoft, Google, Amazon, Meta combined)
- Estimated 2025: $250-300B
- Primary beneficiaries: NVIDIA (GPUs), TSMC (wafers), SK Hynix (HBM), Broadcom (custom ASICs)

### Custom Silicon Threat to Merchant Chips
| Company | Custom Chip | Use Case | NVIDIA Impact |
|---|---|---|---|
| Google | TPU v5 | Training + Inference | -15-20% Google TAM |
| Amazon | Trainium2, Inferentia2 | Training + Inference | -20-25% Amazon TAM |
| Microsoft | Maia 100 | OpenAI inference | Early stage, limited |
| Meta | MTIA (Meta Training and Inference) | Internal AI | -10-15% Meta TAM |
| Apple | M-series Neural Engine | On-device | Not in data center |

Custom silicon reduces the total addressable market for merchant GPUs, but hyperscaler AI CapEx growth offsets this trend through 2026.

## Valuation Comparison

| Company | Market Cap | P/E (fwd) | EV/Revenue | AI Revenue % |
|---|---|---|---|---|
| NVIDIA | ~$3.3T | 35x | 28x | ~88% |
| AMD | ~$260B | 40x | 8x | ~45% |
| Intel | ~$85B | N/M | 1.6x | ~3% |
| Broadcom | ~$900B | 32x | 16x | ~40% |
| TSMC | ~$900B | 28x | 10x | Indirect |

## Investment Themes

### High Conviction
1. **AI infrastructure build-out continues through 2026** — Hyperscaler CapEx guidance calls support this; all four major hyperscalers raised 2025 targets
2. **NVIDIA moat is real but not permanent** — CUDA switching costs are high; AMD ROCm improving; custom silicon structural headwind is real but slow

### Medium Conviction
3. **Inference economics improve profit margins** — Lower cost per token as inference chips improve; supports LLM commoditization but benefits infrastructure providers
4. **AMD takes 15-25% AI accelerator share by 2026** — Memory bandwidth advantage for inference + improving ROCm + price pressure on NVIDIA

### Low Conviction / Speculative
5. **Intel 18A foundry success** — Binary outcome; success transforms IFS into a TSMC competitor; failure risks liquidity
6. **Custom silicon displacement accelerates** — Depends on hyperscaler in-house talent retention and scaling of custom chip programs

## Key Metrics to Watch

- NVIDIA Data Center revenue quarterly (leading indicator of AI CapEx cycle)
- AMD MI300X quarterly units shipped
- Hyperscaler CapEx guidance changes (Microsoft, Google, Amazon, Meta earnings)
- TSMC CoWoS packaging capacity expansion
- ROCm developer adoption metrics (GitHub stars, PyPI downloads)
