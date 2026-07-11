# Sovereign Inference & Local Execution Configuration

## 1. Model Configuration
*   **Production Engine:** GLM-5.2 (744B MoE open-weights model).
*   **Execution Mode:** 'max mode' self-hosted execution.
*   **Database Mappings:** Dual-bucket Hetzner databases separating user profiles (Profile DB) and dealership cars (Inventory DB).

## 2. Local Foundational Compute (Ollama Gateway)
*   **Local Setup:** Run Ollama locally for foundational agent modeling and offline prototyping.
*   **Alternating Current Protocol:** Sync local inference results periodically to refine customer-matching metrics.

## 3. Physical Admin Key (Boot Override)
*   **Hardware Token:** 256GB SanDisk flash drive serving as bootable administrative key.
*   **State Enforcements:** Root modifications require active hardware token insertion. Codebase automatically deploys static-only HTML fallback when the physical admin key is detached.
*   **Local Compiler:** Self-contained C compiler compiles application logic with zero external web dependencies, targeting <2GB runtime size and 30GB-50GB storage limit.
