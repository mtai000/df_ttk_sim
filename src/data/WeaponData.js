export class WeaponData {
  constructor({ name, velocity, baseDamage, armorDamage, rof,supportedAmmoTypes = [] }) {
    this.name = name;
    this.velocity = velocity;
    this.baseDamage = baseDamage;
    this.armorDamage = armorDamage;
    this.rof = rof;
    this.supportedAmmoTypes = supportedAmmoTypes;
    this.headMultiplier = 1.9;
    this.chestMultiplier = 1.0;
    this.handMultiplier = 0.4;
    this.abdomenMultiplier = 0.9;
    this.armMultiplier = 0.4;
    this.legMultiplier = 0.4;
    this.footMultiplier = 0.4;
    this.armorDamagePerSecond = this.armorDamage * (this.rof / 60);
    this.baseDamagePerSecond = this.baseDamage * (this.rof / 60);
    this.isBurst = false;
    this.burstCount = 0;
    this.burstRateOfFire = 0;
    this.burstInterval = 0;
    this.isSelected = false;
    this.currentAmmoType = supportedAmmoTypes.length > 0 ? supportedAmmoTypes[0] : null;
  }

  setBurstSettings({isBurst, burstCount, burstRateOfFire, burstInterval}) {
    this.isBurst = isBurst;
    this.burstCount = burstCount;
    this.burstRateOfFire = burstRateOfFire;
    this.burstInterval = burstInterval;
  }

  setRangeDecay({range,decay}) {
    this.range = range;
    this.decay = decay;
  }

  setPartMultiplier(part, multiplier) {
    switch(part) {
      case 'head':
        this.headMultiplier = multiplier;
        break;
      case 'chest':
        this.chestMultiplier = multiplier;
        break;
      case 'hand':
        this.handMultiplier = multiplier;
        break;
      case 'abdomen':
        this.abdomenMultiplier = multiplier;
        break;
      case 'arm':
        this.armMultiplier = multiplier;
        break;
      case 'leg':
        this.legMultiplier = multiplier;
        break;
      case 'foot':
        this.footMultiplier = multiplier;
        break;
    }
  }
}