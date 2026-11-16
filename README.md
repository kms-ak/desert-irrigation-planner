# Desert Irrigation Planner 🌵💧

> **Breaking Bytes Hackathon**  
> **Track:** Smart Farming for the Desert  
> **Prototype Name:** Desert Irrigation Planner  

A high-contrast, outdoor-first, zero-dependency decision-support prototype built to help small-scale desert greenhouse growers allocate limited daily water supplies effectively.

---

## 🎯 Problem & Purpose

In desert greenhouse agriculture, irrigation water is strictly rationed and scarce. Many smallholder growers still use fixed schedules or split water equally across all greenhouse zones regardless of actual soil moisture levels. This leads to two critical inefficiencies:
1. **Overwatering moist zones**, causing evaporation losses and root rot.
2. **Under-watering parched zones**, stunting crops and depressing yields.

The **Desert Irrigation Planner** addresses this challenge by providing a transparent, real-time comparison between the grower's traditional **Equal-Split Schedule** and a dynamic **Simulated Priority Recommendation**. It redirects water from zones that already have sufficient moisture directly to the driest, most vulnerable zones first.

---

## 🚀 Quick Start / Local Run Instructions

This prototype has **zero dependencies**, **no build step**, and **no server requirements**. It runs 100% locally and works completely offline (even with Wi-Fi turned off).

### Option 1: Double-Click (Easiest)
1. Locate the file `index.html` in your file explorer.
2. Double-click `index.html` to open it in any web browser (Chrome, Edge, Safari, Firefox, Brave).
3. Test with Wi-Fi disabled to confirm full offline functionality.

### Option 2: Local HTTP Server (Optional)
If you prefer running through a local web server:

**Using Python 3:**
```bash
cd /path/to/desert-irrigation-planner
python -m http.server 8000
```
Then navigate to `http://localhost:8000` in your browser.

**Using Node.js:**
```bash
cd /path/to/desert-irrigation-planner
npx serve .
```

---

## 🌐 Static Deployment Instructions (Vercel)

The prototype is a pure static web application (`index.html`) ready for instant deployment to Vercel or any static host.

### Deploying via Vercel CLI
1. Install Vercel CLI (if not already installed):
   ```bash
   npm install -g vercel
   ```
2. Navigate to the project directory:
   ```bash
   cd desert-irrigation-planner
   ```
3. Run the deploy command:
   ```bash
   vercel
   ```
4. Follow the interactive prompts:
   - **Set up and deploy?** [Y]
   - **Which scope?** [Select your account]
   - **Link to existing project?** [N]
   - **What's your project's name?** `desert-irrigation-planner`
   - **In which directory is your code located?** `./`
   - **Want to modify build settings?** [N] (Static HTML does not require a build command or output directory)

### Deploying via GitHub & Vercel Dashboard
1. Push this directory to a GitHub repository (e.g. `your-username/desert-irrigation-planner`).
2. Log in to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository.
4. Leave **Framework Preset** as **"Other"**, **Build Command** blank, and **Output Directory** blank.
5. Click **"Deploy"**. Your application will be live with a free SSL `.vercel.app` URL.

---

## 📐 Decision Rules & Heuristics (Clearly Labeled as Simulated)

> **Important Simulation Disclaimer:**  
> The 25% moisture target and dosage rules are simulated heuristics designed to demonstrate constrained resource redirection. They do not claim measured crop yield gains or proprietary biological models.

### 1. Zone Sensor Inputs
- **Zones:** Zone A, Zone B, and Zone C.
- **Moisture Range:** Valid readings are between `0%` and `100%`.
- **0% Reading:** A reading of `0%` is completely valid (severe desert drought).
- **Blank / Missing:** A blank field indicates an offline or missing sensor.

### 2. Daily Water Budget
- An editable, non-negative whole number of litres (`0`, `15`, `30`, etc.).

### 3. Target & Dose Rules (Simulated)
- **Target Moisture:** `25%`.
- **Dose Tier 1 (High Deficit):** Moisture `< 20%` &rarr; Requests up to **20 L**.
- **Dose Tier 2 (Moderate Deficit):** Moisture `20%` to `< 25%` &rarr; Requests up to **10 L**.
- **Dose Tier 3 (Optimal / Moist):** Moisture `≥ 25%` &rarr; Requests **0 L** (no water needed).
- **Blank Reading (Missing Sensor):** Allocates **0 L** and flags notice: **"Check this zone before watering."** (Does not blindly dump water without verified moisture).

### 4. Priority Allocation Engine
- **Ordering:** Eligible zones that request water are sorted from **lowest moisture to highest** (driest zone first).
- **Tie-Breaker:** Equal moisture readings break ties in alphabetical order (`Zone A` &rarr; `Zone B` &rarr; `Zone C`).
- **Water Allocation:** Each zone receives `min(requested_dose, remaining_budget)`.
- **Budget Depletion:** If the budget is exhausted, partial allocations are clearly shown, and subsequent zones receive 0 L with an explanation that the daily budget ran out.
- **Unneeded Water:** Any water not requested by deficit zones is left unallocated in the storage reserve.

### 5. Usual Schedule Benchmark (Traditional Equal-Split)
- Divides the budget equally across all 3 zones: `base = Math.floor(budget / 3)`.
- Whole litres: any remainder (`budget % 3`) is distributed 1 L each in `A, B, C` order (e.g. 10 L becomes 4 L to A, 3 L to B, 3 L to C).

### 6. Input Validation & Error Handling
- If any moisture reading is out-of-range (`< 0` or `> 100` or non-numeric) or the budget is invalid (negative or non-integer), clear field-level error messages are shown directly beneath the inputs, an alert banner is displayed, and the planning results are withheld until corrected.

---

## 🎬 Demo Walkthrough & Verification Scenarios

You can verify all scenarios directly in `index.html` using the one-click **Judge Quick Test Scenarios** buttons or by typing inputs manually:

### Scenario 1: Default Baseline (Redirection Showcase)
- **Inputs:** Zone A = `32%`, Zone B = `22%`, Zone C = `15%`, Budget = `30 L`
- **Usual Plan:** Zone A = `10 L`, Zone B = `10 L`, Zone C = `10 L` (Total: 30 L, Left: 0 L)
- **Recommended Plan:**
  - **Zone C (15%):** Priority 1 (Driest) &rarr; Allocated full simulated dose of **20 L**
  - **Zone B (22%):** Priority 2 (Moderate) &rarr; Allocated full simulated dose of **10 L**
  - **Zone A (32%):** Skip &rarr; **0 L** (already above 25% target)
- **Highlight Message:**  
  `"10 L redirected from an already-moist zone to the driest zone."`

### Scenario 2: Missing Sensor C (Safety Check)
- **Inputs:** Zone A = `32%`, Zone B = `22%`, Zone C = *[blank]*, Budget = `30 L`
- **Recommended Plan:**
  - Zone B = `10 L`, Zone A = `0 L`, Zone C = `0 L`
  - Zone C Status: Marked with high-contrast alert badge: **"Check this zone before watering."**
  - **20 L** left safely unallocated in the storage tank.

### Scenario 3: Constrained Budget (15 L - Partial Dose & Exhaustion)
- **Inputs:** Zone A = `32%`, Zone B = `22%`, Zone C = `15%`, Budget = `15 L`
- **Usual Plan:** 5 L / 5 L / 5 L
- **Recommended Plan:**
  - **Zone C:** Gets all **15 L** (partial dose of 20 L requested)
  - **Zone B:** Gets **0 L** (budget ran out before reaching Zone B)
  - **Zone A:** Gets **0 L** (above target)

### Scenario 4: Zero Water Budget (0 L)
- **Inputs:** Zone A = `32%`, Zone B = `22%`, Zone C = `15%`, Budget = `0 L`
- **Results:** Both plans allocate **0 L**. Headline notes: *"0 L Water Budget Available. Neither plan allocates water."*

### Scenario 5: All Above Target
- **Inputs:** Zone A = `28%`, Zone B = `35%`, Zone C = `42%`, Budget = `30 L`
- **Results:** Recommended allocates **0 L** across all zones; all **30 L** are preserved in storage reserve rather than overwatering saturated soil.

### Scenario 6: Equal Deficit Tie-Break
- **Inputs:** Zone A = `18%`, Zone B = `18%`, Zone C = `18%`, Budget = `30 L`
- **Results:** All request 20 L. Tie-break allocates 20 L to Zone A, remaining 10 L to Zone B, and 0 L to Zone C due to budget depletion.

### Scenario 7: 0% Extreme Drought Reading
- **Inputs:** Zone A = `28%`, Zone B = `21%`, Zone C = `0%`, Budget = `30 L`
- **Results:** Zone C at 0% is fully valid, recognized as critical deficit, prioritized 1st, and allocated 20 L.

---

## ☀️ Outdoor & Mobile UX Features

Greenhouse inspections happen on mobile phones in harsh, high-glare sunlight. This prototype features:
- **Outdoor-First High Contrast:** Deep slate (`#0f172a`) on pure white (`#ffffff`) with 2px thick borders and high contrast ratios (>10:1).
- **High-Sun Glare Mode:** A one-click toggle in the header that elevates borders to 3px solid black, removes all soft tints, and maximizes luminance contrast for direct sunlight readability.
- **Colorblind & Vision Accessible:** No status is communicated by color alone. Every badge features explicit text labels (e.g. `[CRITICAL DEFICIT]`, `[AT/ABOVE TARGET]`, `[MISSING SENSOR]`, `[CHECK SOIL FIRST]`).
- **Touch-Friendly Controls:** Extra-large touch targets (minimum 48px height), large 18px input typography, and responsive single-column layout on mobile viewports down to 320px.

---

## 🧪 Verification Script

An automated verification test suite is included in `test_planner.js`:
```bash
node test_planner.js
```
Output:
```
========================================
TEST RESULTS: 40 PASSED, 0 FAILED
========================================
```

---

## 📂 Project Structure

```
desert-irrigation-planner/
├── index.html        # Complete standalone application (HTML, CSS, JS inline)
├── README.md         # Documentation, run instructions & demo walkthrough
└── test_planner.js   # Automated Node.js verification test suite
```
