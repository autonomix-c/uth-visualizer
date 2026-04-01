// poker_engine.js
// Natively encodes Stephen How / Wizard of Odds base rules for UTH

const RANK_MAP = {'A':14,'K':13,'Q':12,'J':11,'T':10,'9':9,'8':8,'7':7,'6':6,'5':5,'4':4,'3':3,'2':2};

class PokerEngine {
    constructor() { }

    // Evaluates Flop Base Action natively without Collusion
    // Returns: { action: 'Bet' | 'Check', reason: string, isVulnerableFlush: bool, isVulnerableStraight: bool }
    evaluateFlopBasic(board, hand) {
        const ranksB = board.map(c => c.val).sort((a,b)=>b-a);
        const ranksH = hand.map(c => c.val).sort((a,b)=>b-a);
        const allRanks = [...ranksB, ...ranksH].sort((a,b)=>b-a);
        
        const suitsB = board.map(c => c.suit);
        const suitsH = hand.map(c => c.suit);
        const allSuits = [...suitsB, ...suitsH];
        
        let suitCounts = {'♠':0, '♥':0, '♦':0, '♣':0};
        allSuits.forEach(s => suitCounts[s]++);
        let flushDrawSuit = null;
        for (let s in suitCounts) { if (suitCounts[s] >= 4) flushDrawSuit = s; }
        
        let isPairedBoard = new Set(ranksB).size < ranksB.length;
        let isSuitedBoard = new Set(suitsB).size === 1; // 3 of same suit
        
        let hasPocketPair = ranksH[0] === ranksH[1];
        let hasTwoPairPlus = this.checkTwoPairPlus(ranksH, ranksB); // Extremely simplified check
        
        let res = { action: 'Check', reason: 'Marginal Hand', isVulnerableFlush: false, isVulnerableStraight: false, maxFlushDrawLevel: 99 };
        
        // --- PAIRED BOARD ---
        if (isPairedBoard) {
            if (hasTwoPairPlus) { res.action = 'Bet'; res.reason = 'Paired Board: Two Pairs or better'; return res; }
            if (hasPocketPair && (ranksH[0] >= 5 || (ranksB[0] < ranksH[0] && ranksB[1] < ranksH[0]))) {
                res.action = 'Bet'; res.reason = 'Paired Board: Pocket 5s+ OR Pair w/ Undercards'; return res;
            }
            // Straight/Flush draws are heavily discounted on paired boards
        }
        
        // --- SUITED BOARD ---
        else if (isSuitedBoard) {
            if (hasTwoPairPlus) { res.action = 'Bet'; res.reason = 'Suited Board: Two Pairs or better'; return res; }
            if (flushDrawSuit) {
                // Determine Flush Draw Nut Level
                let myHighestFlushCard = Math.max(...hand.filter(c => c.suit === flushDrawSuit).map(c=>c.val), 0);
                if (myHighestFlushCard > 0) {
                    let unseenOvers = 14 - myHighestFlushCard; // Super rough nut-level approximation
                    if (unseenOvers <= 3) { res.action = 'Bet'; res.reason = 'Suited Board: Nut / 2nd / 3rd Nut Flush Draw'; return res; }
                    else { res.isVulnerableFlush = true; res.maxFlushDrawLevel = unseenOvers + 1; }
                }
            }
        }
        
        // --- OFFSUIT BOARD ---
        else {
            if (hasTwoPairPlus) { res.action = 'Bet'; res.reason = 'Offsuit Board: Two Pairs or better'; return res; }
            if (flushDrawSuit) {
                let myHighestFlushCard = Math.max(...hand.filter(c => c.suit === flushDrawSuit).map(c=>c.val), 0);
                let nutLevel = (14 - myHighestFlushCard) + 1;
                if (nutLevel <= 4) { res.action = 'Bet'; res.reason = 'Offsuit Board: Strong Flush Draw (4th Nut or better)'; return res; }
                else { res.isVulnerableFlush = true; res.maxFlushDrawLevel = nutLevel; } 
            }
            // Check JT98 minimum straight
            if (ranksH.includes(11) && ranksH.includes(10)) {
                if (ranksB.includes(9) && ranksB.includes(8)) {
                    res.isVulnerableStraight = true;
                }
            }
        }
        
        // Default catch
        if (res.action === 'Check') res.reason = 'Native Basic Strategy dictates CHECK (does not meet bet thresholds).';
        return res;
    }

    // Evaluates River Base Action natively without Collusion
    // Returns: { action: 'Call' | 'Fold', reason: string, needsPromotion: bool }
    evaluateRiverBasic(board, hand) {
        const ranksB = board.map(c => c.val).sort((a,b)=>b-a);
        const ranksH = hand.map(c => c.val).sort((a,b)=>b-a);
        
        let boardType = this.classifyBoard(ranksB, board.map(c=>c.suit));
        let res = { action: 'Fold', reason: 'Failed minimum kicker requirements.', needsPromotion: false };
        
        // Pure high card / pair solver placeholder (since JS solver is complex)
        let myKickerLevel = this.calculateKickerLevel(ranksH, ranksB);
        let boardKickerLevel = this.calculateBoardKickerLevel(ranksB);
        
        // "any hand that beats board (by more than kickers)"
        if (this.beatsBoardMechanically(ranksH, ranksB)) {
            res.action = 'Call'; res.reason = `Natively beats board structurally.`; return res;
        }

        switch(boardType) {
            case 'Scare Board':
                if (myKickerLevel <= 4) { res.action = 'Call'; res.reason = 'Scare Board: 4th nut kicker threshold met.'; }
                break;
            case 'Trips Board':
                if (myKickerLevel <= 4) { res.action = 'Call'; res.reason = 'Trips Board: 4th nut kicker threshold met.'; }
                else if (myKickerLevel === 5) { res.needsPromotion = true; res.reason = 'Trips Board: 5th nut kicker (Needs promotion).'; }
                break;
            case '2 Pair Board':
                if (myKickerLevel <= 5) { res.action = 'Call'; res.reason = '2 Pair Board: 5th nut kicker threshold met.'; }
                else if (myKickerLevel === 6) { res.needsPromotion = true; res.reason = '2 Pair Board: 6th nut kicker (Needs promotion).'; }
                break;
            case '1 Pair Board':
                if (myKickerLevel <= 3) { res.action = 'Call'; res.reason = '1 Pair Board: 3rd nut kicker threshold met.'; }
                else if (myKickerLevel === 4) { res.needsPromotion = true; res.reason = '1 Pair Board: 4th nut kicker (Needs promotion).'; }
                break;
            case 'No Pair Board':
                if (myKickerLevel <= 2) { res.action = 'Call'; res.reason = 'No Pair Board: 2nd nut kicker threshold met.'; }
                break;
            default:
                break;
        }
        
        return res;
    }

    // --- Helpers ---
    checkTwoPairPlus(rH, rB) {
        let all = [...rH, ...rB];
        let counts = {}; all.forEach(r => counts[r] = (counts[r]||0)+1);
        let pairs = Object.values(counts).filter(c => c >= 2).length;
        let trips = Object.values(counts).filter(c => c >= 3).length;
        return trips > 0 || pairs >= 2;
    }
    
    classifyBoard(rB, sB) {
        let suitCounts = {}; sB.forEach(s => suitCounts[s] = (suitCounts[s]||0)+1);
        let maxSuit = Math.max(...Object.values(suitCounts));
        if (maxSuit >= 4) return 'Scare Board'; // 4-flush
        
        let rankCounts = {}; rB.forEach(r => rankCounts[r] = (rankCounts[r]||0)+1);
        let maxRank = Math.max(...Object.values(rankCounts));
        let pairs = Object.values(rankCounts).filter(c => c === 2).length;
        
        if (maxRank === 4) return 'Quads Board';
        if (maxRank === 3) return 'Trips Board';
        if (pairs === 2) return '2 Pair Board';
        if (pairs === 1) return '1 Pair Board';
        return 'No Pair Board';
    }
    
    calculateKickerLevel(rH, rB) {
        // (# dealer kickers that win) + 1
        // Very crude approximation for visualizer demo
        let maxMyKicker = Math.max(...rH);
        return (14 - maxMyKicker) + 1;
    }
    
    calculateBoardKickerLevel(rB) {
        let sorted = [...new Set(rB)].sort((a,b)=>b-a);
        if (sorted.length === 0) return 1;
        return (14 - sorted[0]) + 1;
    }
    
    beatsBoardMechanically(rH, rB) {
        let boardCounts = {}; rB.forEach(r => boardCounts[r] = (boardCounts[r]||0)+1);
        let handCounts = {}; rH.forEach(r => handCounts[r] = (handCounts[r]||0)+1);
        
        // E.g. If you hold a pair in your hand, you beat a no-pair board structurally
        if (Object.values(handCounts).some(c => c >= 2) && Object.values(boardCounts).every(c => c < 2)) return true;
        return false;
    }
}

window.PokerEngine = PokerEngine;
