// 1. 定义一个纯数据类（只存储数据，不关心来源）
export class ArmorData {
  constructor({ helmetLv, armorLv, helmetPoint, armorPoint, protectArms, protectAbdomen }) {
    this.helmetLv = helmetLv;
    this.armorLv = armorLv;
    this.helmetPoint = helmetPoint;
    this.armorPoint = armorPoint;
    this.isProtectArms = protectArms;
    this.isProtectAbdomen = protectAbdomen;
  }
}

export class DOMControl {
    constructor() {
    }
    static getArmorDataFromUI() {
    return new ArmorData({
        helmetLv: document.getElementById('helmet_lv').value,
        armorLv: document.getElementById('armor_lv').value,
        helmetPoint: document.getElementById('helmet_point').value,
        armorPoint: document.getElementById('armor_point').value,
        protectArms: document.getElementById('is_protect_arms').checked,
        protectAbdomen: document.getElementById('is_protect_abdomen').checked,
    });
    }

    static getPartHitWeightsFromUI() {
        return {
            head: parseFloat(document.getElementById('head').value) || 0,
            chest: parseFloat(document.getElementById('chest').value) || 0,
            abdomen: parseFloat(document.getElementById('abdomen').value) || 0,
            arm: parseFloat(document.getElementById('arm').value) || 0,
            hand: parseFloat(document.getElementById('hand').value) || 0,
            leg: parseFloat(document.getElementById('leg').value) || 0,
            foot: parseFloat(document.getElementById('foot').value) || 0,
        };

    }

    static getHitChanceFromUI() {
        return parseFloat(document.getElementById('hit_chance').value)/100;
    }

    static getDistanceFromUI() {
        return parseFloat(document.getElementById('distance').value);
    }

    static getHealthPointFromUI() {
        return parseFloat(document.getElementById('health_point').value);
    }
    static getBulletTypeFromUI() {
        return parseInt(document.getElementById('bullet_type').value);
    }
}