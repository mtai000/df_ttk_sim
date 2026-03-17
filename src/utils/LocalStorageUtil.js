
export class LocalStorageUtil {
    static STORAGE_KEY = 'df_ttk_sim_weapons';
    static initialize() {
        if (typeof localStorage === 'undefined') {
            console.warn('当前环境不支持 localStorage，LocalStorageUtil 将无法正常工作');
            return;
        }

        if (!localStorage.getItem('this.STORAGE_KEY')) {
            localStorage.setItem('this.STORAGE_KEY', JSON.stringify([]));
        }
    }
    static loadWeapons() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (!stored) {
            console.warn('没有找到存储的武器数据，返回空数组');
            return [];
        }
        try {
            const weaponsData = JSON.parse(stored);
            console.log('成功加载武器数据:', weaponsData);
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

    static addWeapon(weapon) {
        const weapons = this.loadWeapons();
        weapons.push(weapon);
        this.saveWeapons(weapons);
    }

    static removeWeapon(weapon) {
        let weapons = this.loadWeapons();
        weapons = weapons.filter(w => w.name !== weapon.name);
        this.saveWeapons(weapons);
        
    }

    static import() {
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
                    const importedWeapons = JSON.parse(e.target.result);
                    if (Array.isArray(importedWeapons)) {
                        const current = this.loadWeapons();
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
}