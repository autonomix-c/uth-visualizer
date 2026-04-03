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
    'r-b1': null, 'r-b2': null, 'r-b3': null, 'r-b4': null, 'r-b5': null, 'r-m1': null, 'r-m2': null, 'r-o1': null, 'r-o2': null, 'r-o3': null, 'r-o4': null, 'r-o5': null, 'r-o6': null
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

function clearActiveCard() {
    if (!activeTargetId) return;
    gameState[activeTargetId] = null;
    let slot = document.getElementById(activeTargetId);
    if (slot) {
        slot.innerHTML = 'Select';
        slot.className = 'card-slot empty';
    }
    closeDeck();
    
    const boardKeys = ['r-b1', 'r-b2', 'r-b3', 'r-b4', 'r-b5'];
    if (boardKeys.some(k => !gameState[k])) {
        let matrix = document.getElementById('river-matrix');
        if (matrix) matrix.style.display = 'none';
        let legend = document.getElementById('river-legend');
        if (legend) legend.style.display = 'none';
        let calc = document.getElementById('river-calculating');
        if (calc) calc.style.display = 'none';
        let heroSpec = document.getElementById('hero-specific-output');
        if (heroSpec) heroSpec.style.display = 'none';
    }
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
    // We strictly removed the automatic tryEvaluateRiver() call here so the user has to press the Run button.
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
        let matrix = document.getElementById('river-matrix');
        if (matrix) matrix.style.display = 'none';
        let legend = document.getElementById('river-legend');
        if (legend) legend.style.display = 'none';
        let heroSpec = document.getElementById('hero-specific-output');
        if (heroSpec) heroSpec.style.display = 'none';
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

function getHoleCards(cat, deadCards, boardCards) {
    let r1 = cat[0], r2 = cat[1];
    let isSuited = cat.endsWith('s'), isOffsuit = cat.endsWith('o'), isPair = (r1 === r2);
    
    let suitCounts = {'♠':0, '♥':0, '♦':0, '♣':0};
    if (boardCards) {
        boardCards.forEach(c => {
            let s = c.slice(-1);
            if (suitCounts[s] !== undefined) suitCounts[s]++;
        });
    }

    let bestPair = null;
    let bestScore = 999;
    
    for (let i = 0; i < SUITS.length; i++) {
        for (let j = 0; j < SUITS.length; j++) {
            if (isSuited && i !== j) continue;
            if ((!isSuited) && i === j) continue;
            if (isPair && i === j) continue;
            let c1 = r1 + SUITS[i];
            let c2 = r2 + SUITS[j];
            if (c1 === c2) continue;
            if (!deadCards.includes(c1) && !deadCards.includes(c2)) {
                let score = 0;
                if (boardCards) {
                    score += suitCounts[SUITS[i]] + suitCounts[SUITS[j]];
                }
                if (score < bestScore) {
                    bestScore = score;
                    bestPair = [c1, c2];
                }
            }
        }
    }
    return bestPair;
}

function toAsciiSuit(s) {
    if (s === '♠') return 's'; if (s === '♥') return 'h'; if (s === '♦') return 'd'; if (s === '♣') return 'c'; return s;
}

const FULL_DECK_ASCII = [];
RANKS.forEach(r => ['s','h','d','c'].forEach(s => FULL_DECK_ASCII.push(r+s)));

function tryEvaluateRiver() {
    const boardKeys = ['r-b1', 'r-b2', 'r-b3', 'r-b4', 'r-b5'];
    if (boardKeys.some(k => !gameState[k])) return; 
    
    let board = boardKeys.map(k => gameState[k]);
    let buddy = [];
    ['r-o1', 'r-o2', 'r-o3', 'r-o4', 'r-o5', 'r-o6'].forEach(k => {
        if (gameState[k]) buddy.push(gameState[k]);
    });
    
    document.getElementById('river-calculating').style.display = 'block';
    document.getElementById('river-matrix').style.display = 'none';
    document.getElementById('river-legend').style.display = 'none';
    document.getElementById('hero-specific-output').style.display = 'none';
    
    setTimeout(() => {
        try {
            let boardAscii = board.map(c => c.rank + toAsciiSuit(c.suit));
            let buddyAscii = buddy.map(c => c.rank + toAsciiSuit(c.suit));
            
            let deadCardsAscii = [...boardAscii, ...buddyAscii];
            let deck = FULL_DECK_ASCII.filter(c => !deadCardsAscii.includes(c));
            
            let dealerCombos = [];
            for (let i = 0; i < deck.length; i++) {
                for (let j = i+1; j < deck.length; j++) {
                    dealerCombos.push([deck[i], deck[j]]);
                }
            }
            
            if (!window.Hand) throw new Error("PokerSolver failed to load. Check internet connection.");
            let HandObj = window.Hand;
            
            let dealerCache = [];
            for (let d of dealerCombos) {
                let dHandStr = [...boardAscii, d[0], d[1]];
                let solved = HandObj.solve(dHandStr);
                let isQual = solved.name !== "High Card";
                dealerCache.push({ hand: solved, isQual: isQual, c1: d[0], c2: d[1] });
            }
            
            const results = {}; 
            const blindWins = ["Straight", "Flush", "Full House", "Four of a Kind", "Straight Flush", "Royal Flush"];
            
            // Map dead cards internally
            let deadCardsVisual = [];
            let boardVisual = [];
            board.forEach(c => { 
                let str = c.rank + c.suit;
                deadCardsVisual.push(str); 
                boardVisual.push(str);
            });
            buddy.forEach(c => deadCardsVisual.push(c.rank + c.suit));
            
            // Specific Hero Hand Evaluation
            if (gameState['r-m1'] && gameState['r-m2']) {
                let h1 = gameState['r-m1'];
                let h2 = gameState['r-m2'];
                
                let combinedDead = [...deadCardsVisual, h1.rank+h1.suit, h2.rank+h2.suit];
                // Warning if the user tries to assign a card playing on the board to hero (impossible state)
                let c1Ascii = h1.rank + toAsciiSuit(h1.suit);
                let c2Ascii = h2.rank + toAsciiSuit(h2.suit);
                
                let pHandStrH = [...boardAscii, c1Ascii, c2Ascii];
                let pSolvedH = HandObj.solve(pHandStrH);
                let isBlindWinH = blindWins.includes(pSolvedH.name) ? 1 : 0;
                
                let tEV = 0;
                let vCombos = 0;
                for (let i = 0; i < dealerCache.length; i++) {
                    let d = dealerCache[i];
                    if (d.c1 === c1Ascii || d.c1 === c2Ascii || d.c2 === c1Ascii || d.c2 === c2Ascii) continue;
                    
                    vCombos++;
                    let winnersH = HandObj.winners([pSolvedH, d.hand]);
                    let p_winsH = winnersH.length === 1 && winnersH[0] === pSolvedH;
                    let d_winsH = winnersH.length === 1 && winnersH[0] === d.hand;
                    
                    if (d.isQual) {
                        if (p_winsH) tEV += (1 + 1 + isBlindWinH);
                        else if (d_winsH) tEV += -3;
                    } else {
                        if (p_winsH) tEV += (1 + 0 + isBlindWinH);
                        else if (d_winsH) tEV += -2;
                    }
                }
                
                let heroEV = tEV / vCombos;
                document.getElementById('hero-specific-ev').textContent = heroEV.toFixed(4) + (heroEV > -2.0 ? ' (CALL)' : ' (FOLD)');
                document.getElementById('hero-specific-ev').style.color = heroEV > -2.0 ? 'var(--color-green-always)' : 'var(--color-check)';
                document.getElementById('hero-specific-detail').textContent = `Evaluated across ${vCombos} explicit combinations (Blocker physics enforced)`;
                document.getElementById('hero-specific-output').style.display = 'block';
            }
            
            for (let cat of hands) {
                let holeCards = getHoleCards(cat, deadCardsVisual, boardVisual);
                if (!holeCards) { results[cat] = -2.0; continue; }
                
                let h1Ascii = holeCards[0][0] + toAsciiSuit(holeCards[0][1]);
                let h2Ascii = holeCards[1][0] + toAsciiSuit(holeCards[1][1]);
                
                let pHandStr = [...boardAscii, h1Ascii, h2Ascii];
                let pSolved = HandObj.solve(pHandStr);
                let isBlindWin = blindWins.includes(pSolved.name) ? 1 : 0;
                
                let totalEV = 0;
                let validCombos = 0;
                for (let i = 0; i < dealerCache.length; i++) {
                    let d = dealerCache[i];
                    
                    // Crucial Card Collision Math: Skip if Dealer holds the exact cards we just assigned to Player!
                    if (d.c1 === h1Ascii || d.c1 === h2Ascii || d.c2 === h1Ascii || d.c2 === h2Ascii) {
                        continue;
                    }
                    
                    validCombos++;
                    
                    let winners = HandObj.winners([pSolved, d.hand]);
                    let p_wins = winners.length === 1 && winners[0] === pSolved;
                    let d_wins = winners.length === 1 && winners[0] === d.hand;
                    
                    if (d.isQual) {
                        if (p_wins) totalEV += (1 + 1 + isBlindWin);
                        else if (d_wins) totalEV += -3;
                    } else {
                        if (p_wins) totalEV += (1 + 0 + isBlindWin);
                        else if (d_wins) totalEV += -2;
                    }
                }
                results[cat] = totalEV / validCombos;
            }
            
            let matrix = document.getElementById('river-matrix');
            matrix.innerHTML = '';
            
            hands.forEach(cat => {
                let cell = document.createElement('div');
                cell.className = 'grid-cell';
                let ev = results[cat];
                
                if (ev > -2.0) {
                    cell.classList.add('cell-jam-always'); 
                    cell.textContent = cat;
                } else {
                    cell.classList.add('cell-check-always'); 
                    cell.textContent = cat;
                }
                
                // Estimate valid combos based on average removal
                let validDraws = dealerCache.length - 88; // Default estimation for tooltips
                cell.title = `EV: ${ev.toFixed(4)} units\n(Evaluated across exact dynamic blocker cache)`;
                matrix.appendChild(cell);
            });
            
            document.getElementById('river-calculating').style.display = 'none';
            matrix.style.display = 'grid';
            document.getElementById('river-legend').style.display = 'flex';
            document.getElementById('river-legend').style.justifyContent = 'center';
            
        } catch(err) {
            document.getElementById('river-calculating').style.display = 'none';
            alert("Engine Error: " + err.message);
        }
    }, 50);
}
