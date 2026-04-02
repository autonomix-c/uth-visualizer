importScripts('https://unpkg.com/pokersolver@2.1.4/pokersolver.js');

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS = ['s', 'h', 'd', 'c'];

const FULL_DECK = [];
RANKS.forEach(r => SUITS.forEach(s => FULL_DECK.push(r+s)));

const HAND_CATS = [];
for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
        let cat = r < c ? RANKS[r]+RANKS[c]+'s' : (r === c ? RANKS[r]+RANKS[c] : RANKS[c]+RANKS[r]+'o');
        HAND_CATS.push(cat);
    }
}

function getHoleCards(cat, deadCards) {
    let r1 = cat[0], r2 = cat[1];
    let isSuited = cat.endsWith('s'), isOffsuit = cat.endsWith('o'), isPair = (r1 === r2);
    
    for (let i = 0; i < SUITS.length; i++) {
        for (let j = 0; j < SUITS.length; j++) {
            if (isSuited && i !== j) continue;
            if ((!isSuited) && i === j) continue;
            if (isPair && i === j) continue;
            
            let c1 = r1 + SUITS[i];
            let c2 = r2 + SUITS[j];
            
            if (c1 === c2) continue;
            if (!deadCards.includes(c1) && !deadCards.includes(c2)) {
                return [c1, c2];
            }
        }
    }
    return null;
}

function toAsciiSuit(s) {
    if (s === '♠') return 's';
    if (s === '♥') return 'h';
    if (s === '♦') return 'd';
    if (s === '♣') return 'c';
    return s;
}

self.onmessage = function(e) {
    try {
        const { board_input, buddy_input } = e.data;
        
        let board = board_input.map(c => c.rank + toAsciiSuit(c.suit));
        let buddy = buddy_input ? buddy_input.map(c => c.rank + toAsciiSuit(c.suit)) : [];
        
        let deadCards = [...board, ...buddy];
        let deck = FULL_DECK.filter(c => !deadCards.includes(c));
        
        let dealerCombos = [];
        for (let i = 0; i < deck.length; i++) {
            for (let j = i+1; j < deck.length; j++) {
                dealerCombos.push([deck[i], deck[j]]);
            }
        }
        
        let HandObj = self.Hand;
        if (!HandObj && typeof window !== 'undefined' && window.Hand) { HandObj = window.Hand; }
        if (!HandObj && self.exports && self.exports.Hand) { HandObj = self.exports.Hand; }
        if (!HandObj && typeof module !== 'undefined' && module.exports && module.exports.Hand) { HandObj = module.exports.Hand; }
        
        if (!HandObj) {
            throw new Error("PokerSolver (Hand object) failed to load via importScripts. Check your internet connection or CDN availability.");
        }
        
        let dealerCache = [];
        
        for (let d of dealerCombos) {
            let dHandStr = [...board, d[0], d[1]];
            let solved = HandObj.solve(dHandStr);
            let isQual = solved.name !== "High Card";
            dealerCache.push({ hand: solved, isQual: isQual });
        }
        
        const results = {}; 
        const blindWins = ["Straight", "Flush", "Full House", "Four of a Kind", "Straight Flush", "Royal Flush"];
        
        for (let cat of HAND_CATS) {
            let holeCards = getHoleCards(cat, deadCards);
            if (!holeCards) {
                results[cat] = -2.0; 
                continue;
            }
            
            let pHandStr = [...board, holeCards[0], holeCards[1]];
            let pSolved = HandObj.solve(pHandStr);
            let isBlindWin = blindWins.includes(pSolved.name) ? 1 : 0;
            
            let totalEV = 0;
            
            for (let i = 0; i < dealerCache.length; i++) {
                let d = dealerCache[i];
                
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
            
            results[cat] = totalEV / dealerCache.length;
        }
        
        self.postMessage({ results: results, numCombos: dealerCache.length });
    } catch(err) {
        self.postMessage({ error: err.message || err.toString() });
    }
};
