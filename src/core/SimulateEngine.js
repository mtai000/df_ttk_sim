import { BulletsData } from "../data/BulletsData.js";
import { DOMControl,ArmorData } from "../data/DomControl.js";

export class SimulateEngine {
    constructor(weaponDatas) {
        this.weaponDatas = weaponDatas;
        this.hp = DOMControl.getHealthPointFromUI();
        this.armorData = DOMControl.getArmorDataFromUI();
    }

    calculateTTK() {
        this.weaponDatas.forEach(weaponData => {
            console.log(`正在计算武器: ${weaponData.name}`);
            this.simulateOneShot(weaponData,this.hp,
                                DOMControl.getDistanceFromUI(),
                                this.armorData,
                                DOMControl.getPartHitWeightsFromUI(),
                                DOMControl.getHitChanceFromUI());
        })

    };

    //模拟一次射击，传入武器数据，生命值,距离，防具数据，击中部位权重参数以及命中率参数
    simulateOneShot(weaponData,hp, distance = 0, armorData = null, hitPartWeights = null, hitChance = 1.0) {
        //如果武器子弹类型为global，则使用默认子弹数据，否则使用对应子弹数据
        console.log(weaponData.currentAmmoType);
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
        console.log(`使用子弹类型: ${weaponData.currentAmmoType}, 子弹数据:`, BulletsData[weaponData.currentAmmoType]);
        
        //根据随机数判断是否命中
        const randomValue = Math.random();
        const isHit = randomValue <= hitChance;

        //根据随机数判断击中部位
        const hitPartRandomValue = Math.random();
        let cumulativeWeight = 0;
        let hitPart = null;
        for (const part in hitPartWeights) {
            cumulativeWeight += hitPartWeights[part];
            if (hitPartRandomValue <= cumulativeWeight) {
                hitPart = part;
                break;
            }
        }

        console.log(`命中结果: ${isHit ? '命中' : '未命中'}, 击中部位: ${hitPart}`);

        if (!isHit) {
            console.log(`武器 ${weaponData.name} 未命中目标，伤害为 0`);
            return;
        }
        
        //计算伤害
        const bulletData = BulletsData[weaponData.currentAmmoType];
        const baseDamage = weaponData.baseDamage * bulletData.damage;
        const armorDamage = weaponData.armorDamage * bulletData.armor[armorData.armorLv].armorDamage;
        const penetrate = bulletData.armor[armorData.armorLv].penetrate;

    }
};