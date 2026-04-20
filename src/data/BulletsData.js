import { LocalStorageUtil } from "../utils/LocalStorageUtil.js";
import bulletsJson from "./bullets.json";

export class BulletData {
    constructor({ name = '', damage = 1.0, armorDamageMultiplier = 1.0, armor = {}, multipliers = {}, ...rest } = {}) {
        this.name = String(name || '').trim();
        this.damage = Number(damage) || 1.0;
        this.armorDamageMultiplier = Number(armorDamageMultiplier ?? rest.armor_damage ?? rest.armorDamage ?? 1.0) || 1.0;
        this.armor = typeof armor === 'object' && armor !== null ? armor : {};
        this.multipliers = typeof multipliers === 'object' && multipliers !== null ? multipliers : {};
        Object.assign(this, rest);
    }

    static normalize(rawBullet) {
        if (!rawBullet || typeof rawBullet !== 'object') {
            return new BulletData();
        }

        const normalized = {
            name: rawBullet.name || rawBullet.id || '',
            damage: rawBullet.damage ?? 1.0,
            armorDamageMultiplier: rawBullet.armorDamageMultiplier ?? rawBullet.armor_damage ?? rawBullet.armorDamage ?? 1.0,
            armor: rawBullet.armor ?? {},
            multipliers: rawBullet.multipliers ?? {},
            ...rawBullet,
        };

        return new BulletData(normalized);
    }
}

function createDefaultBulletMap(bulletsArray) {
    if (!Array.isArray(bulletsArray)) {
        return {};
    }

    return Object.fromEntries(
        bulletsArray.map((bullet) => {
            const normalized = BulletData.normalize(bullet);
            return [normalized.name, normalized];
        }).filter(([name]) => name)
    );
}

export const BulletsData = createDefaultBulletMap(bulletsJson);

export function getMergedBulletsData() {
    const persistedBullets = LocalStorageUtil.loadBullets();
    if (!persistedBullets || typeof persistedBullets !== 'object') {
        return BulletsData;
    }

    return {
        ...BulletsData,
        ...persistedBullets,
    };
}
