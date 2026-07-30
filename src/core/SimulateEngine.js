import { BulletsData, getMergedBulletsData } from "../data/BulletsData.js";
import { DOMControl, ArmorData } from "../data/DomControl.js";
import { ConstConfig } from "../data/ConstConfig.js"
import { Log } from "../utils/Log.js";
import { Prng } from "../utils/Rng.js";
import { TTKChart } from "../ui/TTKChart.js";
import { DistanceChart } from "../ui/DistanceChart.js";
import SimulateShot from "../utils/SimulateShot.js";
import { WeaponData, getSupportedAmmoTypes } from "../data/WeaponData.js";

export class SimulateEngine {
    constructor(weaponDatas) {
        this.weaponDatas = weaponDatas;
        this.bulletsData = getMergedBulletsData();
        this.hitChanceByPart = this.calHitChanceByPartHitWeights(DOMControl.getPartHitWeightsFromUI());
        this.setDefault();
        this.rng = new Prng();
        this.resetStatus();
    }

    setDefault() {
        this.default_hp = DOMControl.getHealthPointFromUI();
        this.default_armorData = DOMControl.getArmorDataFromUI();
    }

    resetStatus() {
        this.hp = this.default_hp;
        this.armorData = { ... this.default_armorData };
        Log.log_detail(`重置状态，血量${this.hp},${this.armorData.helmetLv}级头 ${this.armorData.helmetPoint}, ${this.armorData.armorLv}级甲 ${this.armorData.armorPoint}`)
    }

    //根据权重值，计算各部位的命中率
    calHitChanceByPartHitWeights(hitPartWeights) {
        const totalWeight = Object.values(hitPartWeights).reduce((sum, weight) => sum + weight, 0);
        const hitChanceByPart = {};
        for (const part in hitPartWeights) {
            hitChanceByPart[part] = hitPartWeights[part] / totalWeight;
        }
        return hitChanceByPart;
    }

    runMultipleSimulations(distance, hitChance) {
        Log.startDetailLogSession();
        TTKChart.clear();
        const startTime = Date.now();
        Log.log_detail(`开始模拟时间:${startTime}`);
        this.weaponDatas.forEach(weaponData => {
            this.rng.resetSeed();
            this.resetStatus();
            Log.log(`各部位命中概率: ${JSON.stringify(this.hitChanceByPart)}`);
            let bulletData = this.getBulletData(weaponData);
            if (bulletData !== null) {
                for (let sim_count = 0; sim_count < DOMControl.getSimaulteCountFromUI(); sim_count++) {
                    const shotStats = this.runSingleWeaponSimulate(weaponData, bulletData, distance, hitChance);
                    Log.log_detail(`武器${weaponData.name}, 第${sim_count + 1}次模拟，射击${shotStats.shotCount}枪,命中${shotStats.hitShot}枪`);
                    SimulateShot.addSimulateShotCount(TTKChart, weaponData, shotStats, distance);
                }
            }
        });
        Log.log("模拟射击完成");
        const endTime = Date.now();
        Log.log(`完成用间:${endTime - startTime}`);
        Log.saveDetailLogToTempFile();
        TTKChart.showResultsInChart();
    }

    runSimulationsAccordingDistance(hitChance) {
        Log.startDetailLogSession();
        DistanceChart.clear();

        const startTime = Date.now();
        Log.log_detail(`开始距离模拟，时间:${startTime}`);
        this.weaponDatas.forEach(weaponData => {
            this.rng.resetSeed();
            this.resetStatus();
            Log.log(weaponData.range)

            let bulletData = this.getBulletData(weaponData);

            if (bulletData !== null) {
                //获取武器衰减距离点
                weaponData.range.forEach(distance => {
                    if (distance > 100) {
                        distance = 100;
                    }

                    Log.log(`正在模拟武器 ${weaponData.name} 在距离 ${distance} 米的表现`);
                    for (let sim_count = 0; sim_count < DOMControl.getSimaulteCountFromUI(); sim_count++) {
                        const shotStats = this.runSingleWeaponSimulate(weaponData, bulletData, distance, hitChance);
                        Log.log_detail(`武器${weaponData.name}, 距离${distance}米, 第${sim_count + 1}次模拟，射击${shotStats.shotCount}枪,命中${shotStats.hitShot}枪`);
                        SimulateShot.addSimulateShotCount(DistanceChart, weaponData, shotStats, distance);
                    }
                });
            }
        });
        Log.log("模拟射击完成");
        const endTime = Date.now();
        Log.log(`完成用间:${endTime - startTime}`);
        Log.saveDetailLogToTempFile();
        DistanceChart.showResultsInDistanceChart();
    }

    runSingleWeaponSimulate(weaponData, bulletData, distance = 20, hitChance) {
        this.resetStatus();
        Log.log_detail(`=============================================`)
        Log.log_detail(`距离${distance}， ${weaponData.name}的衰减为${this.getWeaponDecay(weaponData, distance)}`);
        if (bulletData.multipliers) {
            Log.log_detail(`使用子弹部位数据`, bulletData.multipliers);
        } else {
            Log.log_detail(`未找到子弹部位数据, 使用武器部位系数`, weaponData.multiplier);
        }

        //循环模拟射击，直到目标死亡
        let shotCount = 0;
        let hitShot = 0;
        while (this.hp > 0 && shotCount < 1000) {
            Log.log_detail(`第 ${shotCount + 1} 发射击:`);
            if (this.simulateOneShot(weaponData, bulletData, distance, hitChance))
                hitShot++;
            shotCount++;
        }

        return { shotCount, hitShot };
    };

    isHitInArmor(hitPart) {
        if (hitPart == 'chest' || (hitPart == 'abdomen' && this.armorData.isProtectAbdomen) ||
            (hitPart == 'arm' && this.armorData.isProtectArms))
            return true;
        else
            return false;
    };

    getBulletData(weaponData) {
        let bulletInfo = this.bulletsData[weaponData.caliber];
        let ammoType = String(weaponData.currentAmmoType);
        if (ammoType === "global") {
            ammoType = String(DOMControl.getBulletTypeFromUI());
        }
        Log.log_detail(`获取武器 ${weaponData.name} 的子弹数据，caliber: ${weaponData.caliber}, ammoType: ${ammoType}`);
        if (!bulletInfo) {
            Log.log_detail(`未找到子弹数据: ${ammoType}，使用默认数据`);
            return null;
        }
        Log.log_detail(`子弹信息: ${JSON.stringify(bulletInfo.available_bullets)} ${JSON.stringify(bulletInfo.special_bullets)}`);
        Log.log_detail(`武器 ${weaponData.name} 当前子弹类型: ${ammoType}`);
        const inAvailableBullets = Array.isArray(bulletInfo.available_bullets) && bulletInfo.available_bullets.includes(ammoType);
        Log.log_detail(`子弹 ${ammoType} 是否适用于武器 ${weaponData.name}: ${inAvailableBullets}`);


        if (inAvailableBullets) {
            const ammo = this.bulletsData["default_bullets"][ammoType];
            Log.log_detail(`使用默认子弹数据${ammo}`);
            return ammo;
        } else {
            if (typeof bulletInfo.special_bullets === 'object' && bulletInfo.special_bullets[ammoType]) {
                const ammo = this.bulletsData[weaponData.caliber].special_bullets[ammoType];
                Log.log_detail(`使用特殊子弹数据${ammo}`);
                return ammo;
            }
        }
        return null;
    }

    getWeaponDecay(weaponData, distance) {
        //计算衰减系数：距离命中衰减点边界时，仍按当前档处理。
        //例如 range 为 [30, 50, 200] 时，30m 仍使用 decay[0]，50m 使用 decay[1]。
        let decay = 1.0
        const index = weaponData.range.findIndex(r => distance <= r);
        if (index !== -1) {
            decay = weaponData.decay[index];
        }
        else {
            decay = weaponData.decay[weaponData.decay.length - 1];
        }
        return decay;
    }

    //模拟一次射击，传入武器数据，生命值,距离，防具数据，击中部位权重参数以及命中率参数
    simulateOneShot(weaponData, bulletData, distance = 0, hitChance = 1.0) {
        //根据随机数判断是否命中
        const randomValue = this.rng.getRandomNumber();
        const isHit = randomValue <= hitChance;

        //根据随机数判断击中部位
        const hitPartRandomValue = this.rng.getRandomNumber();
        let cumulativeWeight = 0;
        let hitPart = null;
        for (const part in this.hitChanceByPart) {
            cumulativeWeight += this.hitChanceByPart[part];
            if (hitPartRandomValue <= cumulativeWeight) {
                hitPart = part;
                break;
            }
        }

        if (!isHit) {
            Log.log_detail(`未命中目标，伤害为 0`);
            return false;
        }

        const decay = this.getWeaponDecay(weaponData, distance);
        //计算伤害
        // 修复：bulletData 可能为 undefined
        let partMultiplier = 1.0;
        partMultiplier = (bulletData.multipliers && bulletData.multipliers[hitPart]) ? bulletData.multipliers[hitPart] * weaponData.multiplier[hitPart] : weaponData.multiplier[hitPart];
        
        const partDamage = (weaponData.baseDamage * (bulletData?.globalDamage ?? 1.0) * partMultiplier) * decay;
        const effectiveArmorDamage = weaponData.armorDamage * (bulletData?.globalArmorDamage ?? 1);
        const headArmorDamage = (effectiveArmorDamage * (bulletData?.entityArmor?.[this.armorData.helmetLv]?.armorDamageFactor ?? 1)) * decay;
        const headPenetrate = bulletData?.entityArmor?.[this.armorData.helmetLv]?.penetrate ?? 0;
        const bodyArmorDamage = (effectiveArmorDamage * (bulletData?.entityArmor?.[this.armorData.armorLv]?.armorDamageFactor ?? 1)) * decay;
        const bodyPenetrate = bulletData?.entityArmor?.[this.armorData.armorLv]?.penetrate ?? 0;

        let shotDamage = 0;
        let shotArmorDamage = 0;
        //命中部位如果有护甲，则先扣除护甲，如果穿甲值大于护甲值，则按百分比扣除生命值，如50%剩余穿甲值，则扣除50%的basedamage的血量以及按穿透值扣除生命
        if (hitPart == 'head') {
            //命中头部
            //如果头盔耐久不足以吸收甲伤
            if (this.armorData.helmetPoint <= 0) {
                shotDamage = partDamage;
            } else if (this.armorData.helmetPoint < headArmorDamage) {
                const overflowArmorDamagePercent = (headArmorDamage - this.armorData.helmetPoint) / headArmorDamage;
                const overflowHealthDamage = partDamage * overflowArmorDamagePercent;
                shotDamage = overflowHealthDamage * (1 - headPenetrate);
                shotArmorDamage = this.armorData.helmetPoint;
                this.armorData.helmetPoint = 0;
                shotDamage += partDamage * headPenetrate;
            } else {
                this.armorData.helmetPoint -= headArmorDamage;
                shotArmorDamage = headArmorDamage;
                shotDamage = partDamage * headPenetrate;
            }
            this.hp -= shotDamage
            Log.log_detail(`武器 ${weaponData.name} 命中 ${hitPart}，造成${shotDamage.toFixed(2)}点伤害，剩余血量为 ${this.hp.toFixed(2)} , 造成${shotArmorDamage.toFixed(2)}点护甲伤害，剩余头甲 ${this.armorData.helmetPoint.toFixed(2)}`);
        } else {
            if (this.isHitInArmor(hitPart)) {
                if (this.armorData.armorPoint <= 0) {
                    shotDamage = partDamage;
                } else if (this.armorData.armorPoint < bodyArmorDamage) {
                    const overflowArmorDamagePercent = (bodyArmorDamage - this.armorData.armorPoint) / bodyArmorDamage;
                    const overflowHealthDamage = partDamage * overflowArmorDamagePercent;
                    shotDamage = overflowHealthDamage * (1 - bodyPenetrate);
                    shotDamage += partDamage * bodyPenetrate;
                    shotArmorDamage = this.armorData.armorPoint;
                    this.armorData.armorPoint = 0;
                }
                else {
                    this.armorData.armorPoint -= bodyArmorDamage;
                    shotDamage = partDamage * bodyPenetrate;
                    shotArmorDamage = bodyArmorDamage;
                }
                this.hp -= shotDamage;

                Log.log_detail(`武器 ${weaponData.name} 命中 ${hitPart}，造成${shotDamage.toFixed(2)}点伤害，剩余血量为 ${this.hp.toFixed(2)} , 造成${shotArmorDamage.toFixed(2)}点护甲伤害，剩余护甲 ${this.armorData.armorPoint.toFixed(2)}`);
            } else {
                this.hp -= partDamage;
                Log.log_detail(`武器 ${weaponData.name} 命中 ${hitPart}，造成${partDamage.toFixed(2)}点伤害，剩余血量为 ${this.hp.toFixed(2)}`);
            }
        }
        Log.log_detail(``);
        return true;
    }
};