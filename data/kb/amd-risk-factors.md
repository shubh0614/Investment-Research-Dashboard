# Advanced Micro Devices — Key Risk Factors & Competitive Analysis 2024

**Source:** AMD 2024 Annual Report (10-K) + Q3 2024 Earnings Call
**Document Type:** Risk Factor Excerpt
**Ticker:** AMD

## Company Overview

AMD designs and sells CPUs, GPUs, FPGAs, and adaptive SoCs. Two primary segments:
- **Data Center:** EPYC server CPUs + Instinct MI-series AI accelerators
- **Client & Gaming:** Ryzen consumer CPUs + Radeon consumer GPUs

FY2024 revenue guidance: ~$25.6B (+12% YoY), with Data Center growing >50%.

## AI Accelerator Business (Instinct MI-Series)

### MI300X Performance Claims
- Peak theoretical FP16: 1,307 TFLOPS (vs. H100's 989 TFLOPS)
- HBM3 capacity: 192GB (3× H100 80GB variant)
- Positioned for inference-heavy workloads where memory bandwidth is the bottleneck

### Customer Traction
- Microsoft Azure: MI300X deployed for Azure OpenAI inference at scale
- Meta: Evaluating for inference alongside H100
- Oracle Cloud: ~20,000 MI300X cluster announced

### ROCm Software Ecosystem (Primary Risk)
- CUDA has 4M+ developers; ROCm ecosystem is materially smaller
- Framework compatibility improving (PyTorch, JAX) but gaps in custom CUDA kernels remain
- AMD's "CUDA compatibility" layer (HIP) requires porting effort
- Training workloads still predominantly on NVIDIA hardware

## Key Risk Factors

### 1. Software Ecosystem Gap (High Impact)
CUDA's dominance creates deep switching costs. Models trained on NVIDIA infrastructure often require re-tuning for MI300X. AMD's ROCm stack has improved significantly but trails CUDA on developer tooling, profiling, and community support.

### 2. Supply Chain (Medium Impact)
AMD fabless model relies exclusively on TSMC for leading-edge production (3nm / 4nm). CoWoS packaging for HBM remains constrained across the industry. Any TSMC disruption affects AMD and NVIDIA equally.

### 3. Competition from Custom Silicon (High Impact)
- Google TPU v5: Captures internal training workloads (30%+ of Google's AI compute)
- AWS Trainium2/Inferentia: Growing Amazon internal workload capture
- Microsoft Maia 100: Early deployment for internal workloads
- Apple M-series: Dominant for on-device inference

Custom silicon reduces the TAM available to both AMD and NVIDIA.

### 4. PC Market Cyclicality (Medium Impact)
Client segment (Ryzen CPUs) remains exposed to consumer PC demand cycles. AI-PC upgrade cycle is a tailwind for FY2025 but depends on application software catching up.

### 5. Gaming GPU Weakness (Low-Medium Impact)
AMD's Radeon market share has been eroding vs. NVIDIA RTX series. DLSS 3.5 / Frame Generation create a software moat that AMD's FSR3 has partially matched but not closed.

## Financial Summary

| Metric | FY2023 | FY2024E |
|---|---|---|
| Revenue | $22.7B | $25.6B |
| Data Center Revenue | $6.5B | ~$12.0B |
| Gross Margin | 50.4% | ~53% |
| Operating Margin | 2.7% | ~8% |
| Net Income | $854M | ~$2.5B |

## Competitive Positioning vs. NVIDIA

| Dimension | AMD | NVIDIA |
|---|---|---|
| AI Training | Strong hardware, weak software | Dominant (CUDA ecosystem) |
| AI Inference | Competitive (MI300X HBM advantage) | Very strong (TensorRT) |
| Data Center CPU | Strong (EPYC market share ~30%) | N/A |
| Gaming GPU | Competitive, losing share | Dominant (RTX/DLSS moat) |
| Software / Developer | Improving (ROCm) | Dominant (CUDA) |
