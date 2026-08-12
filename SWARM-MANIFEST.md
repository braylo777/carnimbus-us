# DOV & CNMB Swarm Execution Manifest
**Priority:** HIGH
**Execution Target:** Agent Swarm
**Date:** 2026-07-11

---

## 🟢 DOV Global & dovOS Tasks

### [DOV-001] Hardware Override Protocol Initialization (dovOS)
- **Objective:** Establish the foundation for a non-destructive hardware override protocol.
- **Integration Details:** 
  - Configure the 256GB SanDisk flash drive as the exclusive bootable physical admin key.
  - Implement the 4-stage hardware override roadmap involving kernel-level enforcement.
  - Interpose between users and system operations via physical port access.
- **Assignee Node:** Security / Infrastructure Swarm

### [DOV-002] DOV-C Translation Layer
- **Objective:** Finalize the programming language syntax and engine for `.dovc`.
- **Integration Details:** 
  - Construct the translation engine to convert machine-generated AI language into plain English.
  - Build human-in-the-loop governance UI for AI oversight.
- **Assignee Node:** Backend / Logic Swarm

### [DOV-003] Local Foundational Inference Setup
- **Objective:** Establish local execution environment for foundational agent models.
- **Integration Details:** 
  - Setup and configure Ollama for local model execution and gateway prototyping.
- **Assignee Node:** AI / Local Compute Swarm

### [DOV-004] Digital Twin Data Ingestion
- **Objective:** Structure personal media data into a reference core for a personal AI digital twin.
- **Integration Details:** 
  - Execute automated sorting of local photo and video directories.
  - Structure output tree strictly by `Year/Month/Location`.
  - Compress and push data to a dedicated external SSD.
- **Assignee Node:** Data Processing Swarm

---

## 🔵 CarNimbus (CNMB) Tasks

### [CNMB-001] Offline Compiler Engine (C-based)
- **Objective:** Build a self-contained compilation system requiring zero external server dependencies.
- **Integration Details:** 
  - Develop the compilation scaffold in C (assigned to Jonathan Blake).
  - Target overall program footprint reduction, strictly enforcing the < 2GB core size and 30GB-50GB maximum storage threshold.
- **Assignee Node:** Core / Compilation Swarm

### [CNMB-002] Static-Fallback & Physical Key Integration
- **Objective:** Deploy the "Beyond JS" redundancy mechanism for live deployment.
- **Integration Details:** 
  - Bind root backend modifications exclusively to the presence of the verified physical flash drive in the GM orchestrator PC.
  - Automate the rendering of the static HTML fallback state for continuous app availability when the physical key is removed.
- **Assignee Node:** Security / Routing Swarm

### [CNMB-003] Frontend Architecture Migration
- **Objective:** Shift repository weight from HTML toward modern JS/CSS architecture.
- **Integration Details:** 
  - Execute directives within `docs/HTML-TO-JS-MIGRATION.md`.
  - Push UI layouts, client onboarding features, and updated matching dashboards to the live Worker
    (script name `carnimbus-com` — a misnomer kept deliberately; renaming it orphans 13 secrets).
    **`carnimbus.us` is the product as of the 2026-08-01 cutover.** `carnimbus.com` is archived and
    serves nothing but a 301. This paragraph previously said the opposite — that "the `.us` era was
    archived… we build only on carnimbus-com" — which was true for three days in late July and has
    been wrong since. The dead Vercel target it referred to (`carnimbus-us.vercel.app`) is unrelated
    to the current `.us` zone.
- **Assignee Node:** Frontend / UI Swarm

### [CNMB-004] Phase 1 & 2 Infrastructure Orchestration
- **Objective:** Modernize container infrastructure and prep for Pilot.
- **Integration Details:** 
  - Execute Docker to Kubernetes migration.
  - Establish a Windmill-orchestrated private cloud setup with zero hardware CapEx.
  - Provision rented GPU pods tailored to isolate the digital twin setups for the top 2 target rooftops (Oct Pilot).
- **Assignee Node:** DevOps Swarm

### [CNMB-005] AI Swarm & LLM Deployment
- **Objective:** Activate the 5-node agent swarm on the `ai.carnimbus.us` gateway.
- **Integration Details:** 
  - Deploy GLM-5.2 in 'max mode' for self-hosted execution.
  - Connect the 5 distinct agents: `Recommend`, `Qualify`, `Schedule`, `Notify`, and `Attribute`.
  - Map RAG processes directly to the dual-bucket Hetzner databases (Profile DB & Inventory DB).
- **Assignee Node:** AI Swarm

### [CNMB-006] Database Seeding & Lacarguy Extraction
- **Objective:** Populate the MVP with active target data.
- **Integration Details:** 
  - Scrape and extract remaining inventory (approx. 2,800 target vehicles) from `lacarguy.com`.
  - Execute schema integrations for `seed/dealers-lacarguy.sql` and `seed/inventory-lacarguy-real.sql`.
  - Apply migrations: `0016_agent_es.sql`, `0019_vdp_enrichment.sql`, and `0021_buyer_signals.sql`.
- **Assignee Node:** Data Extraction / DB Swarm
