import { BulletsData } from "../data/BulletsData.js";
import { DOMControl,ArmorData } from "../data/DomControl.js";
import { ConstConfig } from "../data/ConstConfig.js"
import { Log } from "../utils/Log.js";
import { Prng } from "../utils/Rng.js";
import { TTKChart } from "../ui/TTKChart.js";

export class SimulateEngine {
    constructor(weaponDatas) {
        this.weaponDatas = weaponDatas;
        this.hitChanceByPart = this.calHitChanceByPartHitWeights(DOMControl.getPartHitWeightsFromUI());
        this.setDefault();
        this.resetStatus();
        this.rng = new Prng();
    }

    setDefault(){
        this.default_hp = DOMControl.getHealthPointFromUI();
        this.default_armorData = DOMControl.getArmorDataFromUI();
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
            this.checkBulletType(weaponData);
            for(let sim_count= 0; sim_count< ConstConfig.SIMULATE_COUNT;sim_count++){
                const shots = this.runSingleWeaponSimulate(weaponData,distance,hitChance);
                Log.log_detail(`武器${weaponData.name}, 第${sim_count + 1}次模拟，射击${shots.shotCount}枪,命中${shots.hitShot}枪`);
                TTKChart.addSimulateShotCount(weaponData,shots.shotCount,shots.hitShot,distance);
            }
        })
        console.log("模拟射击完成");
        const endTime = Date.now();
        Log.log(`完成用间:${endTime-startTime}`);
        Log.saveDetailLogToTempFile();
        TTKChart.showResultsInChart();
    }    

    runSingleWeaponSimulate(weaponData,distance = 20,hitChance) {
        this.resetStatus();
        Log.log_detail(`正在计算武器: ${weaponData.name},初始生命 ${this.hp}`);
        Log.log_detail(`护甲信息：${this.armorData}`);
        this.checkBulletType(weaponData);
        Log.log_detail(`使用子弹类型: ${weaponData.currentAmmoType}, 子弹数据:`, BulletsData[weaponData.currentAmmoType]);
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
        
        //计算衰减系数
        let decay=1.0
        const index = weaponData.range.findIndex(r => distance < r);
        if(index !== -1){
            decay = weaponData.decay[index];
        }
        else{
            console.error(`衰减数值不正确`);
        }
        Log.log_detail(`距离${distance}， ${weaponData.name}的衰减为${decay}`);
        //计算伤害
        const bulletData = BulletsData[weaponData.currentAmmoType];
        //根据命中部位系数计算伤害
        const partMultiplier = weaponData[`${hitPart}Multiplier`];
        const partDamage = (weaponData.baseDamage * bulletData.damage * partMultiplier) * decay;
        Log.log_detail(`${hitPart},${partMultiplier},${partDamage}`)
        const headArmorDamage = (weaponData.armorDamage * bulletData.armor[this.armorData.helmetLv].armorDamage) * decay; 
        const headPenetrate = bulletData.armor[this.armorData.helmetLv].penetrate;
        const bodyArmorDamage = (weaponData.armorDamage * bulletData.armor[this.armorData.armorLv].armorDamage) * decay;
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