import SimulateShot from "../utils/SimulateShot.js";

class Prng{
    constructor(seed = 123456){ this.seed = seed; }
    resetSeed(seed = 123456){ this.seed = seed; }
    getRandomNumber(){
        this.seed |= 0;
        this.seed = (this.seed + 0x6D2B79F5) | 0;
        let t = Math.imul(this.seed ^ this.seed >>> 15, 1 | this.seed);
        t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function getWeaponDecay(weaponData, distance){
    let decay = 1.0;
    const index = (weaponData.range || []).findIndex(r => distance <= r);
    if (index !== -1) decay = (weaponData.decay || [1])[index];
    else decay = (weaponData.decay || [1])[ (weaponData.decay || [1]).length - 1];
    return decay;
}

function simulateOneShotLocal(state){
    // state contains: rng, weaponData, bulletData, distance, hitChance, armorData
    const { rng, weaponData, bulletData, distance, hitChance } = state;
    let armorData = state.armorData;

    const randomValue = rng.getRandomNumber();
    const isHit = randomValue <= hitChance;
    // hit part
    const hitChanceByPart = state.hitChanceByPart || { head:0.2, chest:0.5, abdomen:0.15, arm:0.05, hand:0.05, leg:0.03, foot:0.02 };
    const hitPartRandomValue = rng.getRandomNumber();
    let cumulativeWeight = 0;
    let hitPart = 'chest';
    for (const part in hitChanceByPart){ cumulativeWeight += hitChanceByPart[part]; if (hitPartRandomValue <= cumulativeWeight){ hitPart = part; break; } }

    if (!isHit) return { hit:false, damage:0, armorDamage:0 };

    const decay = getWeaponDecay(weaponData, distance);

    const partMultiplier = (bulletData.multipliers && bulletData.multipliers[hitPart]) ? bulletData.multipliers[hitPart] * weaponData.multiplier[hitPart] : weaponData.multiplier[hitPart] || 1;
    const partDamage = (weaponData.baseDamage * (bulletData?.globalDamage ?? 1.0) * partMultiplier) * decay;
    const effectiveArmorDamage = weaponData.armorDamage * (bulletData?.globalArmorDamage ?? 1);
    const headArmorDamage = (effectiveArmorDamage * (bulletData?.entityArmor?.[armorData.helmetLv]?.armorDamageFactor ?? 1)) * decay;
    const headPenetrate = bulletData?.entityArmor?.[armorData.helmetLv]?.penetrate ?? 0;
    const bodyArmorDamage = (effectiveArmorDamage * (bulletData?.entityArmor?.[armorData.armorLv]?.armorDamageFactor ?? 1)) * decay;
    const bodyPenetrate = bulletData?.entityArmor?.[armorData.armorLv]?.penetrate ?? 0;

    let shotDamage = 0;
    let shotArmorDamage = 0;

    if (hitPart === 'head'){
        if (armorData.helmetPoint <= 0){ shotDamage = partDamage; }
        else if (armorData.helmetPoint < headArmorDamage){
            const overflowArmorDamagePercent = (headArmorDamage - armorData.helmetPoint) / headArmorDamage;
            const overflowHealthDamage = partDamage * overflowArmorDamagePercent;
            shotDamage = overflowHealthDamage * (1 - headPenetrate);
            shotArmorDamage = armorData.helmetPoint;
            armorData.helmetPoint = 0;
            shotDamage += partDamage * headPenetrate;
        } else {
            armorData.helmetPoint -= headArmorDamage;
            shotArmorDamage = headArmorDamage;
            shotDamage = partDamage * headPenetrate;
        }
    } else {
        const inArmor = (hitPart == 'chest' || (hitPart == 'abdomen' && armorData.isProtectAbdomen) || (hitPart == 'arm' && armorData.isProtectArms));
        if (inArmor){
            if (armorData.armorPoint <= 0){ shotDamage = partDamage; }
            else if (armorData.armorPoint < bodyArmorDamage){
                const overflowArmorDamagePercent = (bodyArmorDamage - armorData.armorPoint) / bodyArmorDamage;
                const overflowHealthDamage = partDamage * overflowArmorDamagePercent;
                shotDamage = overflowHealthDamage * (1 - bodyPenetrate);
                shotDamage += partDamage * bodyPenetrate;
                shotArmorDamage = armorData.armorPoint;
                armorData.armorPoint = 0;
            } else {
                armorData.armorPoint -= bodyArmorDamage;
                shotDamage = partDamage * bodyPenetrate;
                shotArmorDamage = bodyArmorDamage;
            }
        } else {
            shotDamage = partDamage;
        }
    }

    return { hit:true, damage: shotDamage, armorDamage: shotArmorDamage };
}

function getBulletForWeapon(bulletsData, weaponData){
    const ammoType = weaponData.currentAmmoType === 'global' ? (bulletsData.default_bullets ? Object.keys(bulletsData.default_bullets)[0] : null) : weaponData.currentAmmoType;
    const key = `${weaponData.caliber}_${ammoType}`;
    return bulletsData[key] || (bulletsData.default_bullets && bulletsData.default_bullets[ammoType]) || { multipliers: {}, globalDamage:1, globalArmorDamage:1, entityArmor: {} };
}

self.onmessage = function(ev){
    const data = ev.data || {};
    const { weaponData, bulletsData, armorPresets, samplePoints = [], simulateCount = 1000, hitChance = 1.0, enemyReactionAvg = 350, enemyReactionJitter = 40, partHitWeights = {}, defaultHp = 100 } = data;

    const rng = new Prng(123456);

    // prepare presets
    const presets = armorPresets || {};
    const presetNames = Object.keys(presets);
    const weights = presetNames.map(n => Number(presets[n].weight) || 1);
    const totalWeight = weights.reduce((s,w) => s+w, 0) || 1;

    const bulletData = getBulletForWeapon(bulletsData, weaponData);

    // normalize samplePoints: ensure 0 and 100 present, unique and sorted, and clamp to [0,100]
    let samplePointsNorm = Array.isArray(samplePoints) ? Array.from(new Set(samplePoints.map(Number))) : [];
    if (!samplePointsNorm.includes(0)) samplePointsNorm.push(0);
    if (!samplePointsNorm.includes(100)) samplePointsNorm.push(100);
    samplePointsNorm = samplePointsNorm
        .map(n => Number.isFinite(Number(n)) ? Number(n) : NaN)
        .filter(n => Number.isFinite(n))
        .map(n => Math.max(0, Math.min(100, n)))
        .sort((a,b)=>a-b);
    // dedupe after clamping
    samplePointsNorm = Array.from(new Set(samplePointsNorm));

    const successCountsMap = new Map();
    for (const d of samplePointsNorm){
        successCountsMap.set(Number(d), 0);
    }

    // Run simulations independently per distance to avoid cross-distance RNG correlation
    for (const d of samplePointsNorm) {
        for (let sim = 0; sim < simulateCount; sim++){
            // choose preset for this sim
            const r = rng.getRandomNumber() * totalWeight;
            let acc = 0; let chosenName = presetNames[0] || null;
            for (let i=0;i<presetNames.length;i++){ acc += weights[i]; if (r <= acc){ chosenName = presetNames[i]; break; } }
            const p = chosenName ? presets[chosenName] : null;

            // sample reaction time for this sim
            const reactionRandom = (rng.getRandomNumber() * 2 - 1) * enemyReactionJitter;
            const sampledReactionMs = Math.max(0, enemyReactionAvg + reactionRandom);

            // construct armor clone
            const tempArmor = p ? {
                helmetLv: Number(p.helmetLv) || 1,
                armorLv: Number(p.armorLv) || 1,
                helmetPoint: Number(p.helmetPoint) || 0,
                armorPoint: Number(p.armorPoint) || 0,
                isProtectArms: !!p.isProtectArms,
                isProtectAbdomen: !!p.isProtectAbdomen
            } : { helmetLv:1, armorLv:1, helmetPoint:0, armorPoint:0, isProtectArms:false, isProtectAbdomen:false };

            // create a per-sim shot RNG seeded from main rng to ensure independence across distances
            const shotSeed = Math.floor(rng.getRandomNumber() * 2147483647);
            const shotRng = new Prng(shotSeed);

            // simulate shots until dead or timeout
            let hp = Number(defaultHp || 100);
            const armorClone = { ...tempArmor };
            let shotCount = 0;
            while (hp > 0 && shotCount < 1000){
                const state = { rng: shotRng, weaponData, bulletData, distance: Number(d), hitChance, armorData: armorClone, hitChanceByPart: partHitWeights };
                const res = simulateOneShotLocal(state);
                shotCount++;
                hp -= res.damage || 0;
            }

            const btk = shotCount;
            const triggerDelay = Number(weaponData.triggerDelay || 0);
            const velocity = Number(weaponData.velocity || 0);
            const flyDelay = velocity > 0 ? (Number(d) / velocity) * 1000 : 0;
            const [firingTtk, fullTtk] = SimulateShot.calculateTtkByBtk(weaponData, btk, triggerDelay, flyDelay);

            if (fullTtk <= sampledReactionMs) {
                successCountsMap.set(Number(d), successCountsMap.get(Number(d)) + 1);
            }
        }
    }

    const results = Array.from(successCountsMap.entries()).map(([distance, count]) => ({ distance: Number(distance), count }));

    self.postMessage({ weaponName: weaponData.name, results, simCount: simulateCount, samples: samplePointsNorm });
    self.close && self.close();
}
