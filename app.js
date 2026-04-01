const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS = ['♠', '♥', '♦', '♣'];
const RANK_VALS = {'A':14, 'K':13, 'Q':12, 'J':11, 'T':10, '9':9, '8':8, '7':7, '6':6, '5':5, '4':4, '3':3, '2':2};

const engine = new PokerEngine();

/* ==========================================
 * PREFLOP ENGINE (Restored)
 * ========================================== */
const BOUNDARIES_OFFSUIT = { 14: 2, 13: 5, 12: 8, 11: 10 };
const BOUNDARIES_SUITED = { 14: 2, 13: 2, 12: 6, 11: 8 };

function getBaseAction(val1, val2, isSuited) {
    let t = isSuited ? BOUNDARIES_SUITED : BOUNDARIES_OFFSUIT;
    if (val1 === val2) return val1 >= 3 ? 4 : 0;
    if (val1 <= 10) return 0;
    if (val1 in t) { if (val2 >= t[val1]) return 4; }
    return 0;
}

function getOOPAction(myHandCat, buddyHandCat) {
    let r1 = myHandCat[0], r2 = myHandCat[1], isSuited = myHandCat.endsWith('s'), isPair = (r1 === r2);
    let val1 = RANK_VALS[r1], val2 = RANK_VALS[r2];
    if (val1 < val2) { let t = val1; val1 = val2; val2 = t; }
    
    let b_val1 = RANK_VALS[buddyHandCat[0]], b_val2 = RANK_VALS[buddyHandCat[1]];
    let b_vals = [b_val1, b_val2];
    let baseAction = getBaseAction(val1, val2, isSuited);
    
    if (isPair) { if (val1 === 3 && b_vals.includes(val1)) return 0; return baseAction; }
    if (val1 < 11) return baseAction;
    
    let bMap = isSuited ? BOUNDARIES_SUITED : BOUNDARIES_OFFSUIT;
    if (!(val1 in bMap)) return baseAction;
    
    let distance = bMap[val1] - val2;
    if (distance >= -2 && distance <= 0) {
        if (distance === -2) { if (b_vals.includes(val2)) return 0; }
        else {
            if (val1 === 14 && b_vals.includes(val2)) return 0;
            else if (val1 < 14 && (b_vals.includes(val1) || b_vals.includes(val2))) return 0;
        }
    } else if (distance > 0 && distance <= 2) {
        let buddyOvers = 0;
        if (b_val1 > val1) buddyOvers++;
        if (b_val2 > val1) buddyOvers++;
        if (val1 === 13 && buddyOvers >= 1) return 4;
        if (val1 === 12 && buddyOvers >= 2) return 4;
    }
    return baseAction;
}

const hands = [];
for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
        let cat = r < c ? RANKS[r]+RANKS[c]+'s' : (r === c ? RANKS[r]+RANKS[c] : RANKS[c]+RANKS[r]+'o');
        hands.push(cat);
    }
}

let table1Cells = {}, table2Cells = {}, currentSelected = null;
const table1 = document.getElementById('table1'), table2 = document.getElementById('table2');

function renderGrids() {
    hands.forEach(cat => {
        let cell1 = document.createElement('div'); 
        cell1.className = 'grid-cell'; 
        cell1.textContent = cat;
        
        // Calculate Variable Baseline
        let jams = 0, checks = 0;
        hands.forEach(bCat => {
            getOOPAction(cat, bCat) === 4 ? jams++ : checks++;
        });

        if (jams === 169) cell1.classList.add('cell-jam-always');
        else if (checks === 169) cell1.classList.add('cell-check-always');
        else if (jams > checks) cell1.classList.add('cell-jam-varies');
        else cell1.classList.add('cell-check-varies');

        cell1.addEventListener('mouseenter', () => handleHover(cat, cell1));
        table1.appendChild(cell1); table1Cells[cat] = cell1;
        
        let cell2 = document.createElement('div'); cell2.className = 'grid-cell'; cell2.textContent = cat;
        table2.appendChild(cell2); table2Cells[cat] = cell2;
    });
}

function handleHover(myHandCat, cellNode) {
    if (currentSelected) currentSelected.classList.remove('cell-selected');
    currentSelected = cellNode; currentSelected.classList.add('cell-selected');
    
    let jammedCount = 0, checkedCount = 0;
    hands.forEach(buddyHandCat => {
        let action = getOOPAction(myHandCat, buddyHandCat);
        let t2Cell = table2Cells[buddyHandCat];
        t2Cell.className = 'grid-cell';
        if (action === 4) { t2Cell.classList.add('cell-jam'); jammedCount++; }
        else if (action === 0) { t2Cell.classList.add('cell-check'); checkedCount++; }
    });
    document.getElementById('hover-status').textContent = `Analyzing ${myHandCat}: Resulting in ${jammedCount} Jams (4x) and ${checkedCount} Checks across Buddy's 169-hand range.`;
}
if (table1 && table2) renderGrids();

/* ==========================================
 * SCENARIO BUILDER (POSTFLOP ENGINES)
 * ========================================== */
const gameState = {
    'f-b1': null, 'f-b2': null, 'f-b3': null, 'f-m1': null, 'f-m2': null, 'f-o1': null, 'f-o2': null,
    'r-b1': null, 'r-b2': null, 'r-b3': null, 'r-b4': null, 'r-b5': null, 'r-m1': null, 'r-m2': null, 'r-o1': null, 'r-o2': null
};

let activeTargetId = null;

function renderDeck() {
    const grid = document.getElementById('deck-grid');
    grid.innerHTML = '';
    
    const prefix = activeTargetId ? activeTargetId.split('-')[0] + '-' : null;
    let exhaustedCards = [];
    if (prefix) {
        Object.keys(gameState).forEach(k => {
            if (k.startsWith(prefix) && gameState[k]) {
                exhaustedCards.push(gameState[k].rank + gameState[k].suit);
            }
        });
    }

    RANKS.forEach(r => {
        SUITS.forEach(s => {
            let colorClass = (s === '♥' || s === '♦') ? 'suit-red' : 'suit-black';
            let cardId = r + s;
            let cardDiv = document.createElement('div');
            cardDiv.className = `deck-card ${colorClass}`;
            cardDiv.textContent = cardId;
            
            if (exhaustedCards.includes(cardId)) {
                cardDiv.classList.add('disabled');
            } else {
                cardDiv.onclick = () => selectCard(r, s);
            }
            grid.appendChild(cardDiv);
        });
    });
}

function openDeck(targetId) {
    activeTargetId = targetId;
    renderDeck();
    document.getElementById('deck-modal').style.display = 'flex';
}

function closeDeck() {
    document.getElementById('deck-modal').style.display = 'none';
    activeTargetId = null;
}

function selectCard(rank, suit) {
    if (!activeTargetId) return;
    gameState[activeTargetId] = { rank, suit, val: RANK_VALS[rank] };
    let slot = document.getElementById(activeTargetId);
    let colorClass = (suit === '♥' || suit === '♦') ? 'suit-red' : 'suit-black';
    slot.innerHTML = `<span class="${colorClass}">${rank}${suit}</span>`;
    slot.classList.add('filled');
    
    let currentId = activeTargetId;
    closeDeck();
    
    if (currentId.startsWith('f-')) tryEvaluateFlop();
    if (currentId.startsWith('r-')) tryEvaluateRiver();
}

function resetStage(prefix) {
    Object.keys(gameState).forEach(k => {
        if (k.startsWith(prefix)) {
            gameState[k] = null;
            let slot = document.getElementById(k);
            if (slot) {
                slot.innerHTML = 'Select';
                slot.className = 'card-slot empty';
            }
        }
    });

    if (prefix === 'f-') {
        document.getElementById('flop-action').textContent = '--';
        document.getElementById('flop-action').className = 'action-result';
        document.getElementById('flop-reason').textContent = 'Awaiting inputs...';
    } else {
        document.getElementById('river-action').textContent = '--';
        document.getElementById('river-action').className = 'action-result';
        document.getElementById('river-reason').textContent = 'Awaiting inputs...';
    }
}

function tryEvaluateFlop() {
    const keys = ['f-b1', 'f-b2', 'f-b3', 'f-m1', 'f-m2', 'f-o1', 'f-o2'];
    if (keys.some(k => !gameState[k])) return; // Wait until all 7 cards selected
    
    let board = [gameState['f-b1'], gameState['f-b2'], gameState['f-b3']];
    let myHand = [gameState['f-m1'], gameState['f-m2']];
    let buddyHand = [gameState['f-o1'], gameState['f-o2']];
    
    let resAction = document.getElementById('flop-action');
    let resReason = document.getElementById('flop-reason');

    let baseAnalysis = engine.evaluateFlopBasic(board, myHand);
    let finalAction = baseAnalysis.action;
    let finalReason = `[BASE STRATEGY]: ${baseAnalysis.reason}`;

    if (baseAnalysis.isVulnerableFlush) {
        let suitCounts = {'♠':0, '♥':0, '♦':0, '♣':0};
        [...board, ...myHand].forEach(c => suitCounts[c.suit]++);
        let flushDrawSuit = Object.keys(suitCounts).find(s => suitCounts[s] >= 4);
        
        let stolenOuts = buddyHand.filter(c => c.suit === flushDrawSuit).length;
        if (stolenOuts >= 1 && baseAnalysis.maxFlushDrawLevel >= 5) {
            finalAction = "CHECK"; 
            finalReason += `\n\n[COLLUSION OVERRIDE]: 5th-Nut Flush Draw intercepted! Buddy physically maps ${stolenOuts} flush out(s). Structural Demotion to Check.`;
        } else if (stolenOuts > 0) {
            finalReason += `\n\n[COLLUSION NOTICE]: Buddy stole ${stolenOuts} flush outs, but Base Strategy overrides as Draw is too mathematically strong to fold (Rank ${baseAnalysis.maxFlushDrawLevel}).`;
        }
    }
    
    if (baseAnalysis.isVulnerableStraight) {
        let bVals = buddyHand.map(c => c.val);
        if (bVals.includes(12) || bVals.includes(7)) { 
            finalAction = "CHECK"; 
            finalReason += `\n\n[COLLUSION OVERRIDE]: Minimum Straight Draw Threshold (JT). Buddy physically blocks your Q or 7 completion out. Structural Demotion to Check.`;
        }
    }

    if (finalAction === 'Bet') {
        resAction.textContent = "2x BET"; resAction.className = "action-result action-jam";
    } else {
        resAction.textContent = "CHECK"; resAction.className = "action-result action-check";
    }
    resReason.innerText = finalReason;
}

function tryEvaluateRiver() {
    const keys = ['r-b1', 'r-b2', 'r-b3', 'r-b4', 'r-b5', 'r-m1', 'r-m2', 'r-o1', 'r-o2'];
    if (keys.some(k => !gameState[k])) return; 
    
    let board = [gameState['r-b1'], gameState['r-b2'], gameState['r-b3'], gameState['r-b4'], gameState['r-b5']];
    let myHand = [gameState['r-m1'], gameState['r-m2']];
    let buddyHand = [gameState['r-o1'], gameState['r-o2']];
    
    let resAction = document.getElementById('river-action');
    let resReason = document.getElementById('river-reason');
    
    let baseAnalysis = engine.evaluateRiverBasic(board, myHand);
    let finalAction = baseAnalysis.action;
    let finalReason = `[BASE STRATEGY]: ${baseAnalysis.reason}`;
    
    if (baseAnalysis.needsPromotion) {
        let overs = buddyHand.filter(c => c.val > Math.max(...board.map(bc => bc.val))).length;
        if (overs >= 2) {
            finalAction = "Call";
            finalReason += `\n\n[COLLUSION OVERRIDE]: Kicker limits mechanically promoted! Buddy physically holds ${overs} overcards neutralizing dealer qualifiers. Fold shifted to Call 1x!`;
        } else {
            finalAction = "Fold";
            finalReason += `\n\n[COLLUSION NOTICE]: Kicker threshold missed by 1 rank. Buddy only holds ${overs} key cards, insufficient to promote kicker. Formally Fold.`;
        }
    } else if (baseAnalysis.action === 'Fold') {
        finalReason += `\n\n[COLLUSION NOTICE]: Kicker falls too far below mathematical thresholds to be eligible for overcard promotion. Standard Fold.`;
    }
    
    if (finalAction === 'Call') {
        resAction.textContent = "1x CALL"; resAction.className = "action-result action-jam";
    } else {
        resAction.textContent = "FOLD"; resAction.className = "action-result action-check";
    }
    resReason.innerText = finalReason;
}
