export const calculateMatchScore = (
    outcome: 'WIN' | 'LOSS' | 'DRAW',
    myCount: number,
    enemyCount: number,
    duration: number,
    totalParticles: number // Total starting units (e.g. 300)
): { score: number, breakdown: any } => {
    
    let baseScore = 0;
    let breakdown = {
        base: 0,
        survivalBonus: 0,
        dominanceBonus: 0,
        speedBonus: 0
    };

    // 1. Base Score
    if (outcome === 'WIN') baseScore = 1000;
    if (outcome === 'DRAW') baseScore = 250;
    if (outcome === 'LOSS') baseScore = 50;

    breakdown.base = baseScore;

    // 2. Survival Bonus (10 pts per unit)
    const survivalBonus = myCount * 10;
    breakdown.survivalBonus = survivalBonus;

    // 3. Dominance Bonus (Difference between counts)
    const diff = Math.max(0, myCount - enemyCount);
    const dominanceBonus = diff * 5;
    breakdown.dominanceBonus = dominanceBonus;

    // 4. Speed Bonus (Only for winner)
    let speedBonus = 0;
    if (outcome === 'WIN') {
        // Faster wins = higher score. Max 90s match.
        // If win in 10s: (90 - 10) * 10 = 800 pts
        speedBonus = Math.floor(Math.max(0, 90 - duration) * 10);
    }
    breakdown.speedBonus = speedBonus;

    const totalScore = baseScore + survivalBonus + dominanceBonus + speedBonus;
    
    return { score: totalScore, breakdown };
};