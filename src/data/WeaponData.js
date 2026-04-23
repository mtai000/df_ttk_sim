import { getBulletsJsonStructure } from "./BulletsData.js";
export class WeaponData {
  constructor({ name, velocity, baseDamage, armorDamage, rof, caliber }) {
    this.name = name;
    this.velocity = velocity;
    this.baseDamage = baseDamage;
    this.armorDamage = armorDamage;
    this.rof = rof;
    this.caliber = caliber;
    this.armorDamagePerSecond = this.armorDamage * (this.rof / 60);
    this.baseDamagePerSecond = this.baseDamage * (this.rof / 60);
    this.isBurst = false;
    this.burstCount = 0;
    this.burstRateOfFire = 0;
    this.burstInterval = 0;
    this.isSelected = false;
    this.currentAmmoType = "global";
    this.triggerDelay = 0.0
    this.multiplier = { "head": 1.9, "chest": 1.0, "hand": 0.4, "abdomen": 0.9, "arm": 0.4, "leg": 0.4, "foot": 0.4 };
  }

  setBurstSettings({ isBurst, burstCount, burstRateOfFire, burstInterval }) {
    this.isBurst = isBurst;
    this.burstCount = burstCount;
    this.burstRateOfFire = burstRateOfFire;
    this.burstInterval = burstInterval;
  }

  setRangeDecay({ range, decay }) {
    this.range = range;
    this.decay = decay;
  }

  setPartMultiplier(part, multiplier) {
    switch (part) {
      case 'head':
        this.multiplier.head = multiplier;
        break;
      case 'chest':
        this.multiplier.chest = multiplier;
        break;
      case 'hand':
        this.multiplier.hand = multiplier;
        break;
      case 'abdomen':
        this.multiplier.abdomen = multiplier;
        break;
      case 'arm':
        this.multiplier.arm = multiplier;
        break;
      case 'leg':
        this.multiplier.leg = multiplier;
        break;
      case 'foot':
        this.multiplier.foot = multiplier;
        break;
    }
  }
}

export function getSupportedAmmoTypes(weaponData) {
    let bulletList = [];
    if (weaponData.caliber) {
      const structure = getBulletsJsonStructure();
      const caliberData = structure[weaponData.caliber];
      if (caliberData) {
        // available_bullets: 默认模板ID
        if (Array.isArray(caliberData.available_bullets)) {
          bulletList = bulletList.concat(caliberData.available_bullets.map(String));
        }
        // special_bullets: 特定子弹名
        if (caliberData.special_bullets && typeof caliberData.special_bullets === 'object') {
          bulletList = bulletList.concat(Object.keys(caliberData.special_bullets));
        }
      }

    }
    return bulletList;
  }