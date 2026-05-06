import { Log } from './Log.js';
export class LocalStorageUtil {
    static STORAGE_KEY = 'df_ttk_sim_weapons';
    static BULLETS_STORAGE_KEY = 'df_ttk_sim_bullets';
    static HIT_PART_WEIGHTS_KEY = 'df_ttk_sim_hit_part_weights';
    static HIT_PART_KEYS = ['head', 'chest', 'abdomen', 'arm', 'hand', 'leg', 'foot'];
    static initialize() {
        if (typeof localStorage === 'undefined') {
            console.warn('当前环境不支持 localStorage，LocalStorageUtil 将无法正常工作');
            return;
        }

        if (!localStorage.getItem('this.STORAGE_KEY')) {
            localStorage.setItem('this.STORAGE_KEY', JSON.stringify([]));
        }
    }
    static async loadWeapons() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (!stored) {
            Log.log('没有找到存储的武器数据，使用默认数据');
            const response = await fetch('./data/weapons.json')
            const weaponsData = await response.json();
            this.saveWeapons(weaponsData);
            return weaponsData;
        }
        try {
            const weaponsData = JSON.parse(stored);
            Log.log('成功加载武器数据:', weaponsData);
            return weaponsData;
        } catch (error) {
            console.error('解析存储的武器数据时发生错误:', error);
            return [];
        }
    }

    static saveWeapons(weapons) {
        try {
            const weaponsData = JSON.stringify(weapons);
            localStorage.setItem(this.STORAGE_KEY, weaponsData);
            console.log('成功保存武器数据:', weapons);
        } catch (error) {
            console.error('保存武器数据时发生错误:', error);
        }
    }

    static async loadBullets() {
        const stored = localStorage.getItem(this.BULLETS_STORAGE_KEY);
        if (!stored) {
            Log.log('没有找到存储的子弹数据，使用默认数据');
            const response = await fetch('./data/bullets.json')
            const bulletsData = await response.json();
            return bulletsData;
        }
        try {
            const bullets = JSON.parse(stored);
            if (bullets && typeof bullets === 'object') {
                return bullets;
            }
            return {};
        } catch (error) {
            console.error('解析存储的子弹数据时发生错误:', error);
            return {};
        }
    }

    static saveBullets(bullets) {
        try {
            const bulletsData = JSON.stringify(bullets);
            localStorage.setItem(this.BULLETS_STORAGE_KEY, bulletsData);
            console.log('成功保存子弹数据:', bullets);
        } catch (error) {
            console.error('保存子弹数据时发生错误:', error);
        }
    }

    static addBullet(name, bullet) {
        const bullets = this.loadBullets();
        bullets[name] = bullet;
        this.saveBullets(bullets);
    }

    static removeBullet(name) {
        const bullets = this.loadBullets();
        if (bullets.hasOwnProperty(name)) {
            delete bullets[name];
            this.saveBullets(bullets);
        }
    }

    static loadHitPartWeights() {
        const stored = localStorage.getItem(this.HIT_PART_WEIGHTS_KEY);
        if (!stored) {
            return null;
        }

        try {
            const parsed = JSON.parse(stored);
            const normalized = {};

            this.HIT_PART_KEYS.forEach((key) => {
                const numericValue = Number(parsed[key] || 0);
                if (Number.isFinite(numericValue)) {
                    normalized[key] = numericValue;
                }
            });

            if (Object.keys(normalized).length !== this.HIT_PART_KEYS.length) {
                return null;
            }

            return normalized;
        } catch (error) {
            console.error('解析命中部位权重时发生错误:', error);
            return null;
        }
    }

    static saveHitPartWeights(weights) {
        try {
            const normalized = {};

            this.HIT_PART_KEYS.forEach((key) => {
                const numericValue = Number(weights[key] || 0);
                if (Number.isFinite(numericValue)) {
                    normalized[key] = numericValue;
                }
            });

            if (Object.keys(normalized).length !== this.HIT_PART_KEYS.length) {
                console.warn('命中部位权重不完整，未保存');
                return;
            }

            localStorage.setItem(this.HIT_PART_WEIGHTS_KEY, JSON.stringify(normalized));
        } catch (error) {
            console.error('保存命中部位权重时发生错误:', error);
        }
    }

    static addWeapon(weapon) {
        const weapons = this.loadWeapons();
        weapons.push(weapon);
        this.saveWeapons(weapons);
    }

    static async removeWeapon(weapon) {
        let weapons = await this.loadWeapons();
        weapons = weapons.filter(w => w.name !== weapon.name);
        this.saveWeapons(weapons);

    }

    static import() {
        // 询问用户是否需要备份
        const shouldBackup = confirm('导入数据将覆盖现有武器数据。是否需要先备份当前数据？');
        if (shouldBackup) {
            this.export();
        }

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'application/json';

        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) {
                console.warn('没有选择文件');
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importedWeapons = JSON.parse(e.target.result);
                    if (Array.isArray(importedWeapons)) {
                        const current = await this.loadWeapons();
                        Log.log('当前武器数据:', current);
                        const processedImported = importedWeapons.map(weapon => {
                            if (current.some(w => w.name === weapon.name)) {
                                return { ...weapon, name: `${weapon.name}_${Date.now()}` };
                            }
                            return weapon;
                        });
                        const newWeapons = [...current, ...processedImported];
                        this.saveWeapons(newWeapons);
                        console.log('成功合并导入的武器数据:', newWeapons);
                        window.location.reload();
                    } else {
                        console.error('导入的文件格式不正确，应该是一个武器数组');
                    }
                } catch (error) {
                    console.error('解析导入的武器数据时发生错误:', error);
                }

            };
            reader.readAsText(file);
        });
        fileInput.click();
    }

    static export() {
        const weapons = this.loadWeapons();
        const jsonStr = JSON.stringify(weapons, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `weapons_export_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    static importBullets() {
        // 询问用户是否需要备份
        const shouldBackup = confirm('导入数据将覆盖现有子弹数据。是否需要先备份当前数据？');
        if (shouldBackup) {
            this.exportBullets();
        }

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'application/json';

        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) {
                console.warn('没有选择文件');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedBullets = JSON.parse(e.target.result);
                    if (importedBullets && typeof importedBullets === 'object') {
                        this.saveBullets(importedBullets);
                        console.log('成功导入子弹数据:', importedBullets);
                        window.location.reload();
                    } else {
                        console.error('导入的文件格式不正确，应该是一个子弹对象');
                    }
                } catch (error) {
                    console.error('解析导入的子弹数据时发生错误:', error);
                }
            };
            reader.readAsText(file);
        });
        fileInput.click();
    }

    static exportBullets() {
        const bullets = this.loadBullets();
        const jsonStr = JSON.stringify(bullets, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bullets_export_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ==================== 原始结构（bullets.json 格式）相关方法 ====================

    static BULLETS_JSON_STRUCTURE_KEY = 'df_ttk_sim_bullets_json_structure';

    /**
     * 保存原始结构格式的子弹数据（保持 bullets.json 的分层结构）
     * @param {object} structure - 原始结构的子弹数据
     */
    static saveBulletsJsonStructure(structure) {
        try {
            const jsonStr = JSON.stringify(structure);
            localStorage.setItem(this.BULLETS_JSON_STRUCTURE_KEY, jsonStr);
            console.log('成功保存结构化子弹数据:', structure);
        } catch (error) {
            console.error('保存结构化子弹数据时发生错误:', error);
        }
    }

    /**
     * 获取原始结构格式的子弹数据
     * @returns {object|null} 原始结构的子弹数据，如果不存在返回 null
     */
    static async getBulletsJsonStructure() {
        const stored = localStorage.getItem(this.BULLETS_JSON_STRUCTURE_KEY);
        if (!stored) {
            Log.log('没有找到存储的结构化子弹数据，使用默认数据');
            const response = await fetch('./data/bullets.json');
            const bulletsJson = await response.json();
            return bulletsJson;
        }
        try {
            const structure = JSON.parse(stored);
            if (structure && typeof structure === 'object') {
                return structure;
            }
            return null;
        } catch (error) {
            console.error('解析结构化子弹数据时发生错误:', error);
            return null;
        }
    }

    /**
     * 导出原始结构格式的子弹数据为 bullets.json 文件
     */
    static exportBulletsJsonStructure() {
        // 动态导入 BulletsData 中的导出方法
        import('../data/BulletsData.js').then(module => {
            const jsonStr = module.exportBulletsJson();
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bullets_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }).catch(error => {
            console.error('导出子弹数据时发生错误:', error);
        });
    }

    /**
     * 导入原始结构格式的子弹数据（bullets.json 文件）
     */
    static importBulletsJsonStructure() {
        // 询问用户是否需要备份
        const shouldBackup = confirm('导入数据将覆盖现有子弹数据。是否需要先备份当前数据？');
        if (shouldBackup) {
            this.exportBulletsJsonStructure();
        }

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'application/json';

        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) {
                console.warn('没有选择文件');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedStructure = JSON.parse(e.target.result);
                    if (importedStructure && typeof importedStructure === 'object') {
                        this.saveBulletsJsonStructure(importedStructure);
                        console.log('成功导入结构化子弹数据:', importedStructure);
                        window.location.reload();
                    } else {
                        console.error('导入的文件格式不正确，应该是一个有效的 bullets.json 结构');
                    }
                } catch (error) {
                    console.error('解析导入的子弹数据时发生错误:', error);
                }
            };
            reader.readAsText(file);
        });
        fileInput.click();
    }
}