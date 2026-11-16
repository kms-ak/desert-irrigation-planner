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
      contains: () => false
    },
    setAttribute: () => {},
    style: {},
    appendChild: () => {}
  };
}

const mockIds = [
  'moistureA', 'moistureB', 'moistureC', 'waterBudget',
  'errMoistureA', 'errMoistureB', 'errMoistureC', 'errBudget',
  'withholdBanner', 'resultsSection', 'redirectionMessage', 'redirectionSubMessage',
  'wateringSequence', 'comparisonTableBody', 'usualTotalAlloc', 'recTotalAlloc',
  'usualWaterLeft', 'recWaterLeft', 'reserveSummary', 'allocComparisonSummary',
  'btnGlare'
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
      setAttribute: () => {}
    };
  }
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

// TEST 1: Default values (A=32%, B=22%, C=15%, Budget=30L)
console.log("--- Test 1: Default Values ---");
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
assert(rec.alloc.A === 0, "Recommended Zone A = 0 L");
assert(rec.alloc.B === 10, "Recommended Zone B = 10 L");
assert(rec.alloc.C === 20, "Recommended Zone C = 20 L");
assert(rec.totalAllocated === 30 && rec.waterLeft === 0, "Rec total is 30 L, 0 L left");
assert(rec.waterOrder[0].zone === 'C' && rec.waterOrder[1].zone === 'B', "Water order has Zone C first, then Zone B");

let redir = deriveRedirectionMessage(validation.parsed.moisture, 30, usual, rec);
assert(redir.headline === "10 L redirected from an already-moist zone to the driest zone.", `Redirection headline matches exact requirement: "${redir.headline}"`);

// TEST 2: Clear C's reading (A=32%, B=22%, C="", Budget=30L)
console.log("\n--- Test 2: Missing Reading for Zone C ---");
document.getElementById('moistureA').value = '32';
document.getElementById('moistureB').value = '22';
document.getElementById('moistureC').value = '';
document.getElementById('waterBudget').value = '30';

validation = validateInputs();
assert(validation.isValid === true, "Blank C is valid as missing sensor");
assert(validation.parsed.moisture.C.isBlank === true, "Zone C marked isBlank");

rec = computeRecommendedPlan(validation.parsed.moisture, 30);
assert(rec.alloc.A === 0, "Recommended Zone A = 0 L");
assert(rec.alloc.B === 10, "Recommended Zone B = 10 L");
assert(rec.alloc.C === 0, "Recommended Zone C = 0 L");
assert(rec.waterLeft === 20, "Recommended has 20 L unallocated");
assert(rec.details.C.finalReason.includes("Check this zone before watering"), "Zone C shows 'Check this zone before watering'");

// TEST 3: Water Budget = 0 L
console.log("\n--- Test 3: Zero Water Budget ---");
document.getElementById('moistureA').value = '32';
document.getElementById('moistureB').value = '22';
document.getElementById('moistureC').value = '15';
document.getElementById('waterBudget').value = '0';

validation = validateInputs();
assert(validation.isValid === true, "0 L budget is valid");
usual = computeUsualPlan(0);
rec = computeRecommendedPlan(validation.parsed.moisture, 0);
assert(usual.alloc.A === 0 && usual.alloc.B === 0 && usual.alloc.C === 0, "Usual plan allocates 0 / 0 / 0 L");
assert(rec.alloc.A === 0 && rec.alloc.B === 0 && rec.alloc.C === 0, "Rec plan allocates 0 / 0 / 0 L");
assert(usual.totalAllocated === 0 && rec.totalAllocated === 0, "Total allocated is 0 L for both");

// TEST 4: Budget = 15 L with default readings
console.log("\n--- Test 4: 15 L Water Budget (Constrained) ---");
document.getElementById('moistureA').value = '32';
document.getElementById('moistureB').value = '22';
document.getElementById('moistureC').value = '15';
document.getElementById('waterBudget').value = '15';

validation = validateInputs();
usual = computeUsualPlan(15);
rec = computeRecommendedPlan(validation.parsed.moisture, 15);
assert(usual.alloc.A === 5 && usual.alloc.B === 5 && usual.alloc.C === 5, "Usual plan is 5 / 5 / 5 L");
assert(rec.alloc.C === 15, "Zone C receives 15 L (partial dose)");
assert(rec.alloc.B === 0, "Zone B receives 0 L (budget exhausted)");
assert(rec.alloc.A === 0, "Zone A receives 0 L (above target)");
assert(rec.details.B.finalReason.includes("Budget exhausted") || rec.details.B.finalReason.includes("ran out"), "Zone B reason states budget exhausted");

// TEST 5: All Above Target (e.g. 28%, 35%, 42%, 30 L)
console.log("\n--- Test 5: All Above Target ---");
document.getElementById('moistureA').value = '28';
document.getElementById('moistureB').value = '35';
document.getElementById('moistureC').value = '42';
document.getElementById('waterBudget').value = '30';

validation = validateInputs();
rec = computeRecommendedPlan(validation.parsed.moisture, 30);
assert(rec.alloc.A === 0 && rec.alloc.B === 0 && rec.alloc.C === 0, "Rec plan allocates 0 / 0 / 0 L when all above target");
assert(rec.waterLeft === 30, "All 30 L left unallocated in reserve");
assert(rec.waterOrder.length === 0, "No zones in watering order");

// TEST 6: Equal Deficit Readings (18%, 18%, 18%, 30 L)
console.log("\n--- Test 6: Equal Deficit Readings (Tie-Breaker) ---");
document.getElementById('moistureA').value = '18';
document.getElementById('moistureB').value = '18';
document.getElementById('moistureC').value = '18';
document.getElementById('waterBudget').value = '30';

validation = validateInputs();
rec = computeRecommendedPlan(validation.parsed.moisture, 30);
assert(rec.alloc.A === 20, "Zone A gets 20 L first by A-B-C tie break");
assert(rec.alloc.B === 10, "Zone B gets remaining 10 L");
assert(rec.alloc.C === 0, "Zone C gets 0 L because budget is exhausted");

// TEST 7: 0% Moisture Reading
console.log("\n--- Test 7: 0% Moisture Reading ---");
document.getElementById('moistureA').value = '26';
document.getElementById('moistureB').value = '21';
document.getElementById('moistureC').value = '0';
document.getElementById('waterBudget').value = '30';

validation = validateInputs();
assert(validation.isValid === true, "0% reading is valid");
rec = computeRecommendedPlan(validation.parsed.moisture, 30);
assert(rec.alloc.C === 20, "Zone C with 0% is prioritized and gets 20 L");
assert(rec.alloc.B === 10, "Zone B gets 10 L");
assert(rec.alloc.A === 0, "Zone A gets 0 L (above target)");

// TEST 8: Invalid Inputs
console.log("\n--- Test 8: Invalid Inputs ---");
document.getElementById('moistureA').value = '-5';
document.getElementById('moistureB').value = '105';
document.getElementById('moistureC').value = 'abc';
document.getElementById('waterBudget').value = '12.5'; // decimal not whole number

validation = validateInputs();
assert(validation.isValid === false, "Negative moisture, >100, non-numeric, decimal budget are invalid");
assert(Object.keys(validation.errors).length === 4, "All 4 invalid fields identified in errors");

// TEST 9: Usual Schedule Remainder Distribution
console.log("\n--- Test 9: Remainder Distribution in Usual Plan ---");
let usual10 = computeUsualPlan(10);
assert(usual10.alloc.A === 4 && usual10.alloc.B === 3 && usual10.alloc.C === 3, "10 L budget splits 4 / 3 / 3 L");

let usual1 = computeUsualPlan(1);
assert(usual1.alloc.A === 1 && usual1.alloc.B === 0 && usual1.alloc.C === 0, "1 L budget splits 1 / 0 / 0 L");

let usual2 = computeUsualPlan(2);
assert(usual2.alloc.A === 1 && usual2.alloc.B === 1 && usual2.alloc.C === 0, "2 L budget splits 1 / 1 / 0 L");

console.log(`\n========================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
}
