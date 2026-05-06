import { LocalStorageUtil } from "../utils/LocalStorageUtil.js";
import bulletsJson from "../../data/bullets.json";
import { Log } from "../utils/Log.js";

export class BulletData {
    constructor({ name = '', damage = 1.0, armorDamageMultiplier = 1.0, armor = {}, multipliers = {} , ...rest} = {}) {
        this.name = String(name || '').trim();
        this.damageMultiplier = Number(damage) || 1.0;
        this.armorDamageMultiplier = Number(armorDamageMultiplier ?? rest.armor_damage ?? rest.armorDamage ?? 1.0) || 1.0;
        this.armor = typeof armor === 'object' && armor !== null ? armor : {};
        this.partMultipliers = typeof multipliers === 'object' && multipliers !== null ? multipliers : {};
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

function createBulletMapFromCaliber(bulletsJson) {
    if (!bulletsJson || typeof bulletsJson !== 'object') {
        return {};
    }

    const bulletMap = {};
    const defaultBullets = bulletsJson.default_bullets || {};

    // 处理所有口径
    Object.entries(bulletsJson).forEach(([caliber, caliberData]) => {
        if (caliber === 'default_bullets') return;

        if (!caliberData || typeof caliberData !== 'object') return;

        // 1. 处理 available_bullets（使用默认模板）
        if (Array.isArray(caliberData.available_bullets)) {
            caliberData.available_bullets.forEach((bulletId) => {
                const defaultBullet = defaultBullets[bulletId];
                if (defaultBullet) {
                    const bulletName = `${caliber}_${bulletId}`;
                    const normalized = BulletData.normalize({
                        ...defaultBullet,
                        name: bulletName,
                        id: bulletId,
                        caliber: caliber,
                    });
                    bulletMap[bulletName] = normalized;
                }
            });
        }

        // 2. 处理 special_bullets（特定于该口径的子弹）
        if (caliberData.special_bullets && typeof caliberData.special_bullets === 'object') {
            Object.entries(caliberData.special_bullets).forEach(([bulletName, bulletData]) => {
                const fullBulletName = `${caliber}_${bulletName}`;
                const normalized = BulletData.normalize({
                    ...bulletData,
                    name: fullBulletName,
                    caliber: caliber,
                });
                bulletMap[fullBulletName] = normalized;
            });
        }
    });

    return bulletMap;
}

export const BulletsData = createBulletMapFromCaliber(bulletsJson);

export function getMergedBulletsData() {
    const persistedBullets = LocalStorageUtil.getBulletsJsonStructure();
    if (!persistedBullets || typeof persistedBullets !== 'object') {
        return BulletsData;
    }

    return {
        ...bulletsJson,
        ...persistedBullets,
    };
}

/**
 * 获取保持原始结构的子弹数据（合并本地存储的修改）
 */
export async function getBulletsJsonStructure() {
    // 获取本地存储的结构化数据（如果存在）
    const storedStructure = await LocalStorageUtil.getBulletsJsonStructure();
    
    if (storedStructure) {
        return storedStructure;
    }
    
    // 否则返回原始 bullets.json 的结构
    return JSON.parse(JSON.stringify(bulletsJson));
}

/**
 * 导出为 bullets.json 格式的 JSON 字符串
 */
export function exportBulletsJson() {
    const structure = getBulletsJsonStructure();
    return JSON.stringify(structure, null, 2);
}

/**
 * 按照原始结构添加或更新子弹
 * @param {string} caliber - 口径（如 '7.62x51mm'），或 'default_bullets' 用于默认子弹
 * @param {string} bulletType - 子弹类型：'available' 或 'special'
 * @param {string|number} bulletId - 子弹ID或名称
 * @param {object} bulletData - 子弹数据
 */
export function addBulletToStructure(caliber, bulletType, bulletId, bulletData) {
    const structure = getBulletsJsonStructure();
    
    if (caliber === 'default_bullets') {
        // 添加/更新默认子弹
        if (!structure.default_bullets) {
            structure.default_bullets = {};
        }
        structure.default_bullets[bulletId] = bulletData;
    } else {
        // 添加/更新到指定口径
        if (!structure[caliber]) {
            structure[caliber] = {
                available_bullets: [],
                special_bullets: {}
            };
        }
        
        if (bulletType === 'available') {
            // 添加到 available_bullets 数组
            if (!Array.isArray(structure[caliber].available_bullets)) {
                structure[caliber].available_bullets = [];
            }
            if (!structure[caliber].available_bullets.includes(bulletId)) {
                structure[caliber].available_bullets.push(bulletId);
            }
        } else if (bulletType === 'special') {
            // 添加到 special_bullets 对象
            if (!structure[caliber].special_bullets) {
                structure[caliber].special_bullets = {};
            }
            structure[caliber].special_bullets[bulletId] = bulletData;
        }
    }
    
    // 保存到 localStorage
    LocalStorageUtil.saveBulletsJsonStructure(structure);
    
    return structure;
}

/**
 * 从结构中删除子弹
 * @param {string} caliber - 口径
 * @param {string} bulletType - 子弹类型：'available' 或 'special'
 * @param {string|number} bulletId - 子弹ID或名称
 */
export function removeBulletFromStructure(caliber, bulletType, bulletId) {
    const structure = getBulletsJsonStructure();
    
    if (!structure[caliber]) {
        return structure;
    }
    
    if (bulletType === 'available' && Array.isArray(structure[caliber].available_bullets)) {
        structure[caliber].available_bullets = structure[caliber].available_bullets.filter(id => id !== bulletId);
    } else if (bulletType === 'special' && structure[caliber].special_bullets) {
        delete structure[caliber].special_bullets[bulletId];
    }
    
    // 如果口径已经为空，删除该口径
    if (
        (!Array.isArray(structure[caliber].available_bullets) || structure[caliber].available_bullets.length === 0) &&
        (!structure[caliber].special_bullets || Object.keys(structure[caliber].special_bullets).length === 0)
    ) {
        delete structure[caliber];
    }
    
    LocalStorageUtil.saveBulletsJsonStructure(structure);
    
    return structure;
}

/**
 * 更新默认子弹
 * @param {string|number} bulletId - 子弹ID
 * @param {object} bulletData - 子弹数据
 */
export function updateDefaultBullet(bulletId, bulletData) {
    return addBulletToStructure('default_bullets', null, bulletId, bulletData);
}
