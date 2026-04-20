import { BulletsData, getMergedBulletsData } from "../data/BulletsData.js";
import { DOMControl,ArmorData } from "../data/DomControl.js";
import { ConstConfig } from "../data/ConstConfig.js"
import { Log } from "../utils/Log.js";
import { Prng } from "../utils/Rng.js";
import { TTKChart } from "../ui/TTKChart.js";
import { DistanceChart } from "../ui/DistanceChart.js";
import SimulateShot from "../utils/SimulateShot.js";

export class SimulateEngine {
    constructor(weaponDatas) {
        this.weaponDatas = weaponDatas;
        this.bulletsData = getMergedBulletsData();
        this.hitChanceByPart = this.calHitChanceByPartHitWeights(DOMControl.getPartHitWeightsFromUI());
        this.setDefault();
        this.resetStatus();
        this.rng = new Prng();
    }

    setDefault(){
        this.default_hp = DOMControl.getHealthPointFromUI();
        this.default_armorData = DOMControl.getArmorDataFromUI();
    }

    resolvePartMultipliers(weaponData) {
        const mult = weaponData.mult || {};
        return {
            head: Number(mult.head ?? weaponData.headMultiplier ?? 1.9),
            chest: Number(mult.chest ?? weaponData.chestMultiplier ?? 1.0),
            abdomen: Number(mult.abdomen ?? mult.stomach ?? weaponData.abdomenMultiplier ?? 0.9),
            arm: Number(mult.arm ?? mult.limbs ?? weaponData.armMultiplier ?? 0.4),
            hand: Number(mult.hand ?? mult.limbs ?? weaponData.handMultiplier ?? 0.4),
            leg: Number(mult.leg ?? mult.limbs ?? weaponData.legMultiplier ?? 0.4),
            foot: Number(mult.foot ?? mult.limbs ?? weaponData.footMultiplier ?? 0.4),
        };
    }

    getActiveWeaponConfig(weaponData) {
        const config = { ...weaponData };
        config.range = Array.isArray(weaponData.ranges) ? weaponData.ranges : (Array.isArray(weaponData.range) ? weaponData.range : []);
        config.decay = Array.isArray(weaponData.decays) ? weaponData.decays : (Array.isArray(weaponData.decay) ? weaponData.decay : []);
        config.barrels = Array.isArray(weaponData.barrels) ? weaponData.barrels : (Array.isArray(weaponData.barrelOptions) ? weaponData.barrelOptions : []);
        config.currentBarrelIndex = Number.isFinite(weaponData.currentBarrelIndex) ? weaponData.currentBarrelIndex : 0;
        config.currentAmmoType = weaponData.currentAmmoType ?? 'global';
        config.allowedBullets = Array.isArray(weaponData.allowedBullets) ? weaponData.allowedBullets : (Array.isArray(weaponData.supportedAmmoTypes) ? weaponData.supportedAmmoTypes : []);
        config.partMultipliers = this.resolvePartMultipliers(weaponData);

        const barrel = config.barrels[config.currentBarrelIndex];
        if (barrel) {
            if (Array.isArray(barrel.ranges) && barrel.ranges.length) {
                config.range = barrel.ranges;
            } else if (typeof barrel.rangeMult === 'number' && config.range.length) {
                config.range = config.range.map(r => r * barrel.rangeMult);
            }
            if (Array.isArray(barrel.decays) && barrel.decays.length) {
                config.decay = barrel.decays;
            }
            if (typeof barrel.velocityAdd === 'number') {
                config.velocity = (Number(weaponData.velocity) || 0) + barrel.velocityAdd;
            }
            if (typeof barrel.damageBonus === 'number') {
                config.baseDamage = (Number(weaponData.baseDamage) || 0) + barrel.damageBonus;
            }
            if (typeof barrel.armorDamageBonus === 'number') {
                config.armorDamage = (Number(weaponData.armorDamage) || 0) + barrel.armorDamageBonus;
            }
            if (typeof barrel.rofMult === 'number') {
                config.rof = (Number(weaponData.rof) || 0) * barrel.rofMult;
            }
            if (barrel.partMultAdd && typeof barrel.partMultAdd === 'object') {
                Object.entries(barrel.partMultAdd).forEach(([part, value]) => {
                    const numericValue = Number(value) || 0;
                    if (part === 'stomach') {
                        config.partMultipliers.abdomen += numericValue;
                    } else if (part === 'limbs') {
                        config.partMultipliers.arm += numericValue;
                        config.partMultipliers.hand += numericValue;
                        config.partMultipliers.leg += numericValue;
                        config.partMultipliers.foot += numericValue;
                    } else if (config.partMultipliers[part] !== undefined) {
                        config.partMultipliers[part] += numericValue;
                    }
                });
            }
            if (typeof barrel.burstCount === 'number') {
                config.burstCount = barrel.burstCount;
            }
            if (typeof barrel.burstInternalROF === 'number') {
                config.burstRateOfFire = barrel.burstInternalROF;
            }
            if (typeof barrel.burstInterval === 'number') {
                config.burstInterval = barrel.burstInterval;
            }
            if (typeof barrel.fireMode === 'string') {
                config.fireMode = barrel.fireMode;
            }
        }

        return config;
    }

    resetStatus(){
        this.hp = this.default_hp;
        this.armorData = {... this.default_armorData};
        Log.log_detail(`重置状态，血量${this.hp},头 ${this.armorData.helmetPoint}, 甲 ${this.armorData.armorPoint}`)
       
    }

    //根据权重值，计算各部位的命中率
    calHitChanceByPartHitWeights(hitPartWeights) {
        const totalWeight = Object.values(hitPartWeights).reduce((sum, weight) => sum + weight, 0);
        const hitChanceByPart = [];
        for (const part in hitPartWeights) {
            hitChanceByPart[part] = hitPartWeights[part] / totalWeight;
        }
        Log.log_detail(hitChanceByPart)
        return hitChanceByPart;
    }

    runMultipleSimulations(distance,hitChance){
        Log.startDetailLogSession();
        TTKChart.clear();
        const startTime = Date.now();
        Log.log_detail(`开始模拟时间:${startTime}`);
        this.weaponDatas.forEach(weaponData =>{
            this.resetStatus();
            const activeWeapon = this.getActiveWeaponConfig(weaponData);
            this.checkBulletType(activeWeapon);
            for(let sim_count= 0; sim_count< ConstConfig.SIMULATE_COUNT;sim_count++){
                const shotStats = this.runSingleWeaponSimulate(activeWeapon,distance,hitChance);
                Log.log_detail(`武器${weaponData.name}, 第${sim_count + 1}次模拟，射击${shotStats.shotCount}枪,命中${shotStats.hitShot}枪`);
                SimulateShot.addSimulateShotCount(TTKChart,weaponData,shotStats,distance);
            }
        })
        Log.log("模拟射击完成");
        const endTime = Date.now();
        Log.log(`完成用间:${endTime-startTime}`);
        Log.saveDetailLogToTempFile();
        TTKChart.showResultsInChart();
    }    

    runSimulationsAccordingDistance(hitChance)
    {
        Log.startDetailLogSession();
        DistanceChart.clear();

        const startTime = Date.now();
        Log.log_detail(`开始距离模拟，时间:${startTime}`);
        this.weaponDatas.forEach(weaponData =>{
            this.resetStatus();
            const activeWeapon = this.getActiveWeaponConfig(weaponData);
            this.checkBulletType(activeWeapon);
            Log.log(activeWeapon.range)
            //获取武器衰减距离点
            activeWeapon.range.forEach(distance =>{
                if(distance > 100){
                    distance = 100;
                }
                Log.log(`正在模拟武器 ${weaponData.name} 在距离 ${distance} 米的表现`);
                for(let sim_count= 0; sim_count< ConstConfig.SIMULATE_ACCORDING_DISTANCE_COUNT;sim_count++){
                    const shotStats = this.runSingleWeaponSimulate(weaponData,distance,hitChance);
                    Log.log_detail(`武器${weaponData.name}, 距离${distance}米, 第${sim_count + 1}次模拟，射击${shotStats.shotCount}枪,命中${shotStats.hitShot}枪`);
                    SimulateShot.addSimulateShotCount(DistanceChart,weaponData,shotStats,distance);
                }
            });
        });
        Log.log("模拟射击完成");
        const endTime = Date.now();
        Log.log(`完成用间:${endTime-startTime}`);
        Log.saveDetailLogToTempFile();
        DistanceChart.showResultsInDistanceChart();
    }

    runSingleWeaponSimulate(weaponData,distance = 20,hitChance) {
        this.resetStatus();
        Log.log_detail(`正在计算武器: ${weaponData.name},初始生命 ${this.hp}`);
        Log.log_detail(`护甲信息：${JSON.stringify(this.armorData)}`);
        this.checkBulletType(weaponData);
        Log.log_detail(`使用子弹类型: ${weaponData.currentAmmoType}, 子弹数据:`, this.bulletsData[weaponData.currentAmmoType]);
        Log.log_detail(`命中率为${hitChance}`)
        //循环模拟射击，直到目标死亡
        let shotCount = 0;
        let hitShot = 0;
        while(this.hp > 0 && shotCount < 1000) {
            Log.log_detail(`第 ${shotCount + 1} 发射击:`);
            if(this.simulateOneShot(weaponData,distance,hitChance))
                hitShot++;
            shotCount++;
        }

        return {shotCount,hitShot};
    };
    
    isHitInArmor(hitPart){
        if(hitPart == 'chest' || (hitPart == 'abdomen' && this.armorData.isProtectAbdomen) || 
            (hitPart == 'arm' && this.armorData.isProtectArms))
            return true;
        else
            return false;
    };
    
    checkBulletType(weaponData){
        //如果武器子弹类型为global，则使用默认子弹数据，否则使用对应子弹数据
        if(weaponData.currentAmmoType ==='global'){
            //如果全局子弹不支持，则选择比它低一级的子弹，再没有则低两级
            if(weaponData.supportedAmmoTypes.includes(DOMControl.getBulletTypeFromUI().toString())){
                weaponData.currentAmmoType = DOMControl.getBulletTypeFromUI();
            } else if(weaponData.supportedAmmoTypes.includes((DOMControl.getBulletTypeFromUI() - 1).toString())){
                weaponData.currentAmmoType = DOMControl.getBulletTypeFromUI() - 1;
            } else if(weaponData.supportedAmmoTypes.includes((DOMControl.getBulletTypeFromUI() - 2).toString())){
                weaponData.currentAmmoType = DOMControl.getBulletTypeFromUI() - 2;
            } else {
                console.warn(`武器 ${weaponData.name} 不支持当前选择的子弹类型 ${DOMControl.getBulletTypeFromUI()}，也不支持比它低一级的子弹，无法计算伤害`);
                return;
            }
        }
    }

    //模拟一次射击，传入武器数据，生命值,距离，防具数据，击中部位权重参数以及命中率参数
    simulateOneShot(weaponData,distance = 0, hitChance = 1.0) {
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
        
        //计算衰减系数：距离命中衰减点边界时，仍按当前档处理。
        //例如 range 为 [30, 50, 200] 时，30m 仍使用 decay[0]，50m 使用 decay[1]。
        let decay=1.0
        const index = weaponData.range.findIndex(r => distance <= r); 
        if(index !== -1){
            decay = weaponData.decay[index];
        }
        else{
            decay = weaponData.decay[weaponData.decay.length - 1];
        }
        Log.log_detail(`距离${distance}， ${weaponData.name}的衰减为${decay}`);
        //计算伤害
        const bulletData = this.bulletsData[weaponData.currentAmmoType];
        //根据命中部位系数计算伤害
        const partMultiplier = (bulletData.multipliers && bulletData.multipliers[hitPart]) ? bulletData.multipliers[hitPart] : weaponData.partMultipliers?.[hitPart] ?? weaponData[`${hitPart}Multiplier`];
        const partDamage = (weaponData.baseDamage * bulletData.damage * partMultiplier) * decay;
        Log.log_detail(`${hitPart},${partMultiplier},${partDamage}`)
        const effectiveArmorDamage = weaponData.armorDamage * (bulletData.armorDamageMultiplier || 1);
        const headArmorDamage = (effectiveArmorDamage * bulletData.armor[this.armorData.helmetLv].armorDamage) * decay; 
        const headPenetrate = bulletData.armor[this.armorData.helmetLv].penetrate;
        const bodyArmorDamage = (effectiveArmorDamage * bulletData.armor[this.armorData.armorLv].armorDamage) * decay;
        const bodyPenetrate = bulletData.armor[this.armorData.armorLv].penetrate;

        //命中部位如果有护甲，则先扣除护甲，如果穿甲值大于护甲值，则按百分比扣除生命值，如50%剩余穿甲值，则扣除50%的basedamage的血量以及按穿透值扣除生命
        if(hitPart == 'head'){
            //命中头部
                //如果头盔耐久不足以吸收甲伤
                if(this.armorData.helmetPoint <= 0){
                    this.hp -= partDamage;
                } else if(this.armorData.helmetPoint < headArmorDamage)
                {
                    const overflowArmorDamagePercent = (headArmorDamage - this.armorData.helmetPoint)/headArmorDamage;
                    const overflowHealthDamage = partDamage * overflowArmorDamagePercent;
                    this.hp -= overflowHealthDamage * (1-headPenetrate);
                    this.armorData.helmetPoint = 0;
                    this.hp -= partDamage *  headPenetrate;
                } else {
                    this.armorData.helmetPoint -= headArmorDamage;
                    this.hp -= partDamage * headPenetrate;
                }
            Log.log_detail(`武器 ${weaponData.name} 命中 ${hitPart}，剩余血量为 ${this.hp.toFixed(2)} , 剩余头甲 ${this.armorData.helmetPoint.toFixed(2)}`);
        } else  {
            if( this.isHitInArmor(hitPart)){
                if(this.armorData.armorPoint <= 0){
                    this.hp -= partDamage;
                } else if(this.armorData.armorPoint < bodyArmorDamage){
                    const overflowArmorDamagePercent = (bodyArmorDamage - this.armorData.armorPoint)/bodyArmorDamage;
                    const overflowHealthDamage = partDamage * overflowArmorDamagePercent;
                    this.hp -= overflowHealthDamage * (1-bodyPenetrate);
                    this.hp -= partDamage * bodyPenetrate;
                    this.armorData.armorPoint = 0;
                }
                else{
                    this.armorData.armorPoint -= bodyArmorDamage;
                    this.hp -= partDamage * bodyPenetrate;
                }

                Log.log_detail(`武器 ${weaponData.name} 命中 ${hitPart}，剩余血量为 ${this.hp.toFixed(2)} , 剩余护甲 ${this.armorData.armorPoint.toFixed(2)}`);
            } else {
                this.hp -= partDamage;
                Log.log_detail(`武器 ${weaponData.name} 命中 ${hitPart}，剩余血量为 ${this.hp.toFixed(2)}`);
            }
        }
        return true;
    }
};