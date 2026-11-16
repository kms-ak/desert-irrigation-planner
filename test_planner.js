// Test script to extract and test the logic in index.html
const fs = require('fs');
const path = require('path');

const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');

// Extract the script tag content
const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.error("No script tag found!");
  process.exit(1);
}

const scriptCode = scriptMatch[1];

// Mock minimal DOM to run the script functions
const domMock = {
  elements: {},
  body: {
    classList: {
      toggle: () => false
    }
  }
};

function createElement(id, value = '') {
  return {
    id,
    value,
    textContent: '',
    innerHTML: '',
    classList: {
      add: () => {},
      remove: () => {},
      contains: () => false,
      toggle: () => {}
    },
    setAttribute: () => {},
    getAttribute: () => null,
    style: {},
    appendChild: () => {},
    querySelectorAll: () => [],
    querySelector: () => null,
    children: [],
    dataset: {}
  };
}

// All IDs referenced by the new index.html
const mockIds = [
  // Input fields
  'moistureA', 'moistureB', 'moistureC', 'waterBudget',
  // Error fields
  'errMoistureA', 'errMoistureB', 'errMoistureC', 'errBudget',
  // Status badges / gauges
  'badgeA', 'badgeB', 'badgeC',
  'gaugeA', 'gaugeB', 'gaugeC',
  // Plan overview
  'statAvailable', 'recTotalAlloc', 'recWaterLeft',
  'usualTotalAlloc', 'usualWaterLeft',
  // Comparison section
  'redirectionMessage', 'redirectionSubMessage',
  'comparisonTableBody',
  'withholdBanner',
  'resultsSection',
  // Action list
  'actionListItems',
  'wateringSequence',
  'comparisonCardsContainer',
  // Preset buttons
  'presetShortage', 'presetMissing', 'presetStandard',
  // Tank (comparison page)
  'tankLabelBudget', 'tankLabelReserve', 'tankFluidPage3',
  // Misc
  'reserveSummary', 'allocComparisonSummary', 'btnGlare'
];

mockIds.forEach(id => {
  domMock.elements[id] = createElement(id);
});

global.document = {
  body: domMock.body,
  getElementById: (id) => {
    if (!domMock.elements[id]) {
      domMock.elements[id] = createElement(id);
    }
    return domMock.elements[id];
  },
  createElement: (tag) => {
    return {
      tagName: tag,
      className: '',
      textContent: '',
      innerHTML: '',
      appendChild: () => {},
      setAttribute: () => {},
      getAttribute: () => null,
      style: {},
      querySelectorAll: () => [],
      querySelector: () => null,
      children: [],
      dataset: {}
    };
  },
  querySelectorAll: () => [],
  querySelector: () => null
};

global.window = {
  addEventListener: () => {}
};

// Evaluate script
eval(scriptCode);

console.log("=== RUNNING AUTOMATED VERIFICATION SUITE ===\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

// ============================================================
// TEST 1: Default Values — 30 L, A=32%, B=22%, C=15%
// ============================================================
console.log("--- Test 1: Default Values (30 L, A=32, B=22, C=15) ---");
document.getElementById('moistureA').value = '32';
document.getElementById('moistureB').value = '22';
document.getElementById('moistureC').value = '15';
document.getElementById('waterBudget').value = '30';

let validation = validateInputs();
assert(validation.isValid === true, "Default inputs are valid");

let usual = computeUsualPlan(30);
assert(usual.alloc.A === 10 && usual.alloc.B === 10 && usual.alloc.C === 10, "Usual plan allocates 10 / 10 / 10 L");
assert(usual.totalAllocated === 30 && usual.waterLeft === 0, "Usual total is 30 L, 0 L left");

let rec = computeRecommendedPlan(validation.parsed.moisture, 30);
assert(rec.alloc.A === 0, "Rec Zone A = 0 L (above target)");
assert(rec.alloc.B === 10, "Rec Zone B = 10 L");
assert(rec.alloc.C === 20, "Rec Zone C = 20 L");
assert(rec.totalAllocated === 30 && rec.waterLeft === 0, "Rec total is 30 L, 0 L left");
assert(rec.waterOrder[0].zone === 'C' && rec.waterOrder[1].zone === 'B', "Water order: Zone C first, Zone B second");

let comp = deriveComparisonText(validation.parsed.moisture, 30, usual, rec);
assert(comp.headline === "Zone C gets 10 L more than under the usual schedule.",
  `30 L standard headline: "${comp.headline}"`);
assert(comp.subline.includes("10 L redirected") || comp.subline.includes("withholds") || comp.subline.length > 0,
  "30 L standard subline is non-empty and meaningful");

// ============================================================
// TEST 2: 15 L Shortage — A=32%, B=22%, C=15%  (KEY SPEC TEST)
// ============================================================
console.log("\n--- Test 2: 15 L Water Shortage (A=32, B=22, C=15) ---");
document.getElementById('moistureA').value = '32';
document.getElementById('moistureB').value = '22';
document.getElementById('moistureC').value = '15';
document.getElementById('waterBudget').value = '15';

validation = validateInputs();
assert(validation.isValid === true, "15 L shortage inputs are valid");

usual = computeUsualPlan(15);
assert(usual.alloc.A === 5 && usual.alloc.B === 5 && usual.alloc.C === 5, "Usual plan is 5 / 5 / 5 L");
assert(usual.totalAllocated === 15 && usual.waterLeft === 0, "Usual total is 15 L, 0 L left");

rec = computeRecommendedPlan(validation.parsed.moisture, 15);
assert(rec.alloc.A === 0, "Rec Zone A = 0 L (above target)");
assert(rec.alloc.B === 0, "Rec Zone B = 0 L (budget exhausted after C)");
assert(rec.alloc.C === 15, "Rec Zone C = 15 L (partial of 20 L request)");
assert(rec.totalAllocated === 15 && rec.waterLeft === 0, "Rec total is 15 L, 0 L left");

// Zone C should be in waterOrder as a partial allocation
const cEntry = rec.waterOrder.find(e => e.zone === 'C');
assert(cEntry && cEntry.partial === true, "Zone C is marked as partial allocation");
assert(cEntry && cEntry.allocated === 15 && cEntry.requested === 20, "Zone C: 15 allocated out of 20 requested");
assert(cEntry && cEntry.rankWord === 'first', "Zone C rankWord is 'first'");

// Zone B should appear in waterOrder with 0 allocated (exhausted)
const bEntry = rec.waterOrder.find(e => e.zone === 'B');
assert(bEntry && bEntry.exhausted === true, "Zone B is marked exhausted in waterOrder");

// Zone A should NOT be in waterOrder (above target, ineligible)
const aInOrder = rec.waterOrder.find(e => e.zone === 'A');
assert(!aInOrder, "Zone A is NOT in waterOrder (above target)");

// finalReason checks
assert(rec.details.B.finalReason.includes("Budget exhausted") || rec.details.B.finalReason.includes("exhausted"),
  `Zone B finalReason includes 'exhausted': "${rec.details.B.finalReason}"`);
assert(rec.details.A.finalReason.includes("above") || rec.details.A.finalReason.includes("Above"),
  `Zone A finalReason reflects above-target status: "${rec.details.A.finalReason}"`);

// Comparison text for 15 L scenario
comp = deriveComparisonText(validation.parsed.moisture, 15, usual, rec);
assert(comp.headline === "Zone C gets 10 L more than under the usual schedule.",
  `15 L headline: "${comp.headline}"`);
assert(comp.subline === "The planner withholds 5 L from Zone A and defers 5 L from Zone B. Both plans allocate 15 L.",
  `15 L subline: "${comp.subline}"`);

// ============================================================
// TEST 3: Missing Zone C — A=32%, B=22%, C=blank, 30 L  (KEY SPEC TEST)
// ============================================================
console.log("\n--- Test 3: Missing Reading for Zone C (30 L) ---");
document.getElementById('moistureA').value = '32';
document.getElementById('moistureB').value = '22';
document.getElementById('moistureC').value = '';
document.getElementById('waterBudget').value = '30';

validation = validateInputs();
assert(validation.isValid === true, "Blank C is valid as missing sensor");
assert(validation.parsed.moisture.C.isBlank === true, "Zone C marked isBlank");

usual = computeUsualPlan(30);
rec = computeRecommendedPlan(validation.parsed.moisture, 30);
assert(rec.alloc.A === 0, "Rec Zone A = 0 L (above target)");
assert(rec.alloc.B === 10, "Rec Zone B = 10 L");
assert(rec.alloc.C === 0, "Rec Zone C = 0 L (reading missing)");
assert(rec.waterLeft === 20, "20 L left unallocated (budget not exhausted)");
assert(rec.details.C.finalReason.includes("Check this zone before watering"),
  `Zone C shows check-reading message: "${rec.details.C.finalReason}"`);

comp = deriveComparisonText(validation.parsed.moisture, 30, usual, rec);
assert(comp.headline === "Check Zone C before watering · 20 L still available.",
  `Missing C headline: "${comp.headline}"`);
assert(comp.subline.length > 0, "Missing C subline is non-empty");

// ============================================================
// TEST 4: Zero Water Budget
// ============================================================
console.log("\n--- Test 4: Zero Water Budget ---");
document.getElementById('moistureA').value = '32';
document.getElementById('moistureB').value = '22';
document.getElementById('moistureC').value = '15';
document.getElementById('waterBudget').value = '0';

validation = validateInputs();
assert(validation.isValid === true, "0 L budget is valid");
usual = computeUsualPlan(0);
rec = computeRecommendedPlan(validation.parsed.moisture, 0);
assert(usual.alloc.A === 0 && usual.alloc.B === 0 && usual.alloc.C === 0, "Usual plan 0 / 0 / 0 L");
assert(rec.alloc.A === 0 && rec.alloc.B === 0 && rec.alloc.C === 0, "Rec plan 0 / 0 / 0 L");
assert(usual.totalAllocated === 0 && rec.totalAllocated === 0, "Total allocated = 0 L");

comp = deriveComparisonText(validation.parsed.moisture, 0, usual, rec);
assert(comp.headline.includes("0 L"), `Zero budget headline includes '0 L': "${comp.headline}"`);

// ============================================================
// TEST 5: All Above Target (28%, 35%, 42%, 30 L)
// ============================================================
console.log("\n--- Test 5: All Above Target ---");
document.getElementById('moistureA').value = '28';
document.getElementById('moistureB').value = '35';
document.getElementById('moistureC').value = '42';
document.getElementById('waterBudget').value = '30';

validation = validateInputs();
rec = computeRecommendedPlan(validation.parsed.moisture, 30);
assert(rec.alloc.A === 0 && rec.alloc.B === 0 && rec.alloc.C === 0, "Rec plan 0 / 0 / 0 L when all above target");
assert(rec.waterLeft === 30, "All 30 L unallocated (all zones above target)");
assert(rec.waterOrder.length === 0, "No zones in waterOrder when all above target");

comp = deriveComparisonText(validation.parsed.moisture, 30, computeUsualPlan(30), rec);
assert(comp.headline.includes("30 L") || comp.headline.toLowerCase().includes("above"),
  `All-above-target headline is descriptive: "${comp.headline}"`);

// ============================================================
// TEST 6: Equal Deficit Readings — tie-breaker (18%, 18%, 18%, 30 L)
// ============================================================
console.log("\n--- Test 6: Equal Deficit Readings (Tie-Breaker A→B→C) ---");
document.getElementById('moistureA').value = '18';
document.getElementById('moistureB').value = '18';
document.getElementById('moistureC').value = '18';
document.getElementById('waterBudget').value = '30';

validation = validateInputs();
rec = computeRecommendedPlan(validation.parsed.moisture, 30);
assert(rec.alloc.A === 20, "Zone A gets 20 L first by A-B-C tie-break");
assert(rec.alloc.B === 10, "Zone B gets remaining 10 L");
assert(rec.alloc.C === 0, "Zone C gets 0 L (budget exhausted)");

// ============================================================
// TEST 7: 0% Moisture Reading (Zone C most critical)
// ============================================================
console.log("\n--- Test 7: 0% Moisture Reading ---");
document.getElementById('moistureA').value = '26';
document.getElementById('moistureB').value = '21';
document.getElementById('moistureC').value = '0';
document.getElementById('waterBudget').value = '30';

validation = validateInputs();
assert(validation.isValid === true, "0% reading is valid (not blank)");
rec = computeRecommendedPlan(validation.parsed.moisture, 30);
assert(rec.alloc.C === 20, "Zone C with 0% is prioritized and gets 20 L");
assert(rec.alloc.B === 10, "Zone B gets 10 L");
assert(rec.alloc.A === 0, "Zone A gets 0 L (above target at 26%)");

// ============================================================
// TEST 8: Invalid Inputs
// ============================================================
console.log("\n--- Test 8: Invalid Inputs ---");
document.getElementById('moistureA').value = '-5';
document.getElementById('moistureB').value = '105';
document.getElementById('moistureC').value = 'abc';
document.getElementById('waterBudget').value = '12.5';

validation = validateInputs();
assert(validation.isValid === false, "Negative moisture, >100, non-numeric, decimal budget are all invalid");
assert(Object.keys(validation.errors).length === 4, `All 4 invalid fields detected (got ${Object.keys(validation.errors).length})`);

// ============================================================
// TEST 9: Usual Schedule Remainder Distribution
// ============================================================
console.log("\n--- Test 9: Remainder Distribution in Usual Plan ---");
let usual10 = computeUsualPlan(10);
assert(usual10.alloc.A === 4 && usual10.alloc.B === 3 && usual10.alloc.C === 3, "10 L splits 4 / 3 / 3 L");

let usual1 = computeUsualPlan(1);
assert(usual1.alloc.A === 1 && usual1.alloc.B === 0 && usual1.alloc.C === 0, "1 L splits 1 / 0 / 0 L");

let usual2 = computeUsualPlan(2);
assert(usual2.alloc.A === 1 && usual2.alloc.B === 1 && usual2.alloc.C === 0, "2 L splits 1 / 1 / 0 L");

// ============================================================
// TEST 10: Action list structure for 15 L scenario
// ============================================================
console.log("\n--- Test 10: Water Order Structure for 15 L Shortage ---");
document.getElementById('moistureA').value = '32';
document.getElementById('moistureB').value = '22';
document.getElementById('moistureC').value = '15';
document.getElementById('waterBudget').value = '15';

validation = validateInputs();
rec = computeRecommendedPlan(validation.parsed.moisture, 15);

// C is first in eligible, allocated 15 of 20 → partial
const c15 = rec.waterOrder.find(e => e.zone === 'C');
assert(c15 !== undefined, "Zone C appears in waterOrder for 15 L shortage");
assert(c15.rankWord === 'first', "Zone C rankWord is 'first'");
assert(c15.allocated === 15, "Zone C allocated = 15 L");
assert(c15.requested === 20, "Zone C requested = 20 L");
assert(c15.partial === true, "Zone C is flagged as partial");

// B is eligible but gets 0 → exhausted entry
const b15 = rec.waterOrder.find(e => e.zone === 'B');
assert(b15 !== undefined, "Zone B appears in waterOrder (exhausted) for 15 L shortage");
assert(b15.exhausted === true, "Zone B is flagged exhausted");
assert(b15.allocated === 0, "Zone B allocated = 0 L");

// A is above target → NOT in waterOrder
assert(!rec.waterOrder.find(e => e.zone === 'A'), "Zone A is NOT in waterOrder for 15 L shortage");

// ============================================================
// TEST 11: 30 L Standard — verify exact spec numbers
// ============================================================
console.log("\n--- Test 11: 30 L Standard Budget (A=32, B=22, C=15) ---");
document.getElementById('moistureA').value = '32';
document.getElementById('moistureB').value = '22';
document.getElementById('moistureC').value = '15';
document.getElementById('waterBudget').value = '30';

validation = validateInputs();
usual = computeUsualPlan(30);
rec = computeRecommendedPlan(validation.parsed.moisture, 30);
assert(usual.alloc.A === 10 && usual.alloc.B === 10 && usual.alloc.C === 10, "30 L usual: 10 / 10 / 10 L");
assert(rec.alloc.A === 0 && rec.alloc.B === 10 && rec.alloc.C === 20, "30 L rec: 0 / 10 / 20 L");
assert(rec.totalAllocated === 30 && rec.waterLeft === 0, "30 L: total = 30, left = 0");

// ============================================================
// SUMMARY
// ============================================================
console.log(`\n========================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
}
