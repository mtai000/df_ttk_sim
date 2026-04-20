import { SimulateEngine } from "../core/SimulateEngine.js";
import { BulletsData, getMergedBulletsData } from "../data/BulletsData.js";
import { DOMControl } from "../data/DomControl.js";
import { WeaponData } from "../data/WeaponData.js";
import { LocalStorageUtil } from "../utils/LocalStorageUtil.js";
import { Log } from "../utils/Log.js";

export class UIHandle{ 
    constructor() {
        this.weaponDatas = LocalStorageUtil.loadWeapons().map(weapon => this.normalizeWeaponData(weapon));
        this.bulletsData = getMergedBulletsData();
        this.bindEventHandlers();
        this.showBulletOptions();
        this.restoreHitPartWeights();
        this.addSegmentRow(0,200,1.0);
        this.refreshWeaponTable();
    }

    refreshWeaponTable() {
        const tbody = document.querySelector('#weapon_table tbody');
        if (tbody) {
            tbody.innerHTML = '';
        }
        this.weaponDatas.forEach(weaponData => {
            this.showWeaponInTable(weaponData);
        });
    }

    bindCalTTk(){
        const btn_cal_ttk = document.getElementById('button_cal_ttk'); 
        if(btn_cal_ttk ) {
            btn_cal_ttk.addEventListener('click', (event) => {
                event.preventDefault();
                //获取选中的武器数据
                const selectedWeapons = this.weaponDatas.filter(w => w.isSelected);
                if(selectedWeapons.length === 0) {
                    alert('请至少选择一把武器');
                    return;
                }
                // 调用计算 ttk 的函数
                const simulateEngine = new SimulateEngine(selectedWeapons);
                simulateEngine.runMultipleSimulations(DOMControl.getDistanceFromUI(),DOMControl.getHitChanceFromUI());
            });
        }
    }

    bindCalTTkAccordingDistance() {
        const btn_cal_ttk_according_distance = document.getElementById('button_cal_ttk_according_distance');
        if(btn_cal_ttk_according_distance) {
            btn_cal_ttk_according_distance.addEventListener('click', (event) => {
                event.preventDefault();
                const selectedWeapons = this.weaponDatas.filter(w => w.isSelected);
                if(selectedWeapons.length === 0) {
                    alert('请至少选择一把武器');
                    return;
                }
                const simulateEngine = new SimulateEngine(selectedWeapons);
                simulateEngine.runSimulationsAccordingDistance(DOMControl.getHitChanceFromUI());
            });
        }
    }

    bindBurstSettings() {
        const isBurstCheckbox = document.getElementById('isBurst');
        if(isBurstCheckbox) {
            // 获取连发设置的输入元素
            const burstSettingsContainer = document.getElementById('burstSettingsContainer');
            const burstCountInput = document.getElementById('burstCount');
            const burstRateOfFireInput = document.getElementById('burstRateOfFire');
            const burstIntervalInput = document.getElementById('burstInterval');

            // 定义一个函数来更新连发设置的可见状态
            const updateBurstSettingsState = () => {
                const isBurst = isBurstCheckbox.checked;
                if (burstSettingsContainer) {
                    burstSettingsContainer.style.display = isBurst ? 'grid' : 'none';
                }
                burstCountInput.disabled = !isBurst;
                burstRateOfFireInput.disabled = !isBurst;
                burstIntervalInput.disabled = !isBurst;
                // 当取消勾选时，清空连发参数
                if (!isBurst) {
                    burstCountInput.value = '';
                    burstRateOfFireInput.value = '';
                    burstIntervalInput.value = '';
                }
            };

            // 初始调用一次以设置正确的状态
            updateBurstSettingsState();

            // 监听复选框的变化事件
            isBurstCheckbox.addEventListener('change', updateBurstSettingsState);
        }
    }
    bindAddNewWeapon() {
        const btn_add_new_gun = document.getElementById('addNewWeaponBtn');
        if(btn_add_new_gun) {
            btn_add_new_gun.addEventListener('click', (event) => {
                event.preventDefault();
                const supportedAmmoTypes = [];
                document.querySelectorAll('input[name="ammoType"]:checked').forEach(checkbox => {
                    supportedAmmoTypes.push(checkbox.value);
                });
                const weaponData = new WeaponData({
                    name: document.getElementById('newName').value,
                    velocity: parseFloat(document.getElementById('newVelocity').value),
                    baseDamage: parseFloat(document.getElementById('newBaseDamage').value),
                    armorDamage: parseFloat(document.getElementById('newArmorDamage').value),
                    rof: parseFloat(document.getElementById('newRateOfFire').value),
                    supportedAmmoTypes: supportedAmmoTypes,
                });
                weaponData.setPartMultiplier('head', parseFloat(document.getElementById('multHead').value));
                weaponData.setPartMultiplier('chest', parseFloat(document.getElementById('multChest').value));
                weaponData.setPartMultiplier('hand', parseFloat(document.getElementById('multHand').value));
                weaponData.setPartMultiplier('abdomen', parseFloat(document.getElementById('multAbdomen').value));
                weaponData.setPartMultiplier('arm', parseFloat(document.getElementById('multarm').value));
                weaponData.setPartMultiplier('leg', parseFloat(document.getElementById('multLeg').value));
                weaponData.setPartMultiplier('foot', parseFloat(document.getElementById('multFoot').value));

                weaponData.setRangeDecay(this.collectDecaySegment());
                weaponData.setBurstSettings({
                    isBurst: document.getElementById('isBurst').checked,
                    burstCount: parseInt(document.getElementById('burstCount').value) || 0,
                    burstRateOfFire: parseFloat(document.getElementById('burstRateOfFire').value) || 0,
                    burstInterval: parseFloat(document.getElementById('burstInterval').value) || 0,
                });
                weaponData.triggerDelay = parseFloat(document.getElementById('triggerDelay').value) || 0;

                this.weaponDatas.push(weaponData);
                this.showWeaponInTable(weaponData);
                this.saveWeaponsToStorage();
                this.updateJsonEditorsIfVisible();
                Log.log('添加武器');
            });
        }
    }
    collectDecaySegment() {
        const rows = document.querySelectorAll('.decay-segment-row');
        const range=[];
        const decay=[];

        rows.forEach((row,index) => {
            const end=parseFloat(row.querySelector('.segment-end').value);
            const multiplier=parseFloat(row.querySelector('.segment-multiplier').value);
            if(isNaN(end) || isNaN(multiplier)) {
                alert(`请确保第 ${index + 1} 行的结束距离和伤害倍率都是有效数字`);
                throw new Error(`Invalid input in decay segment row ${index + 1}`);
            }

            range.push(end);
            decay.push(multiplier);
        });

        return {range, decay};
    }

    normalizeWeaponData(weaponData) {
        weaponData = weaponData || {};
        if (!weaponData.range && Array.isArray(weaponData.ranges)) {
            weaponData.range = weaponData.ranges;
        }
        if (!weaponData.decay && Array.isArray(weaponData.decays)) {
            weaponData.decay = weaponData.decays;
        }
        if (!Array.isArray(weaponData.range)) {
            weaponData.range = Array.isArray(weaponData.range) ? weaponData.range : [];
        }
        if (!Array.isArray(weaponData.decay)) {
            weaponData.decay = Array.isArray(weaponData.decay) ? weaponData.decay : [];
        }
        weaponData.currentAmmoType = weaponData.currentAmmoType ?? 'global';
        weaponData.allowedBullets = Array.isArray(weaponData.allowedBullets) ? weaponData.allowedBullets : (Array.isArray(weaponData.supportedAmmoTypes) ? weaponData.supportedAmmoTypes : []);
        weaponData.supportedAmmoTypes = Array.isArray(weaponData.supportedAmmoTypes) ? weaponData.supportedAmmoTypes : weaponData.allowedBullets;
        weaponData.baseDamagePerSecond = Number(weaponData.baseDamagePerSecond) || ((Number(weaponData.baseDamage) || 0) * (Number(weaponData.rof) || 0) / 60);
        weaponData.armorDamagePerSecond = Number(weaponData.armorDamagePerSecond) || ((Number(weaponData.armorDamage) || 0) * (Number(weaponData.rof) || 0) / 60);
        weaponData.mult = weaponData.mult || {
            head: weaponData.headMultiplier,
            chest: weaponData.chestMultiplier,
            abdomen: weaponData.abdomenMultiplier,
            arm: weaponData.armMultiplier,
            hand: weaponData.handMultiplier,
            leg: weaponData.legMultiplier,
            foot: weaponData.footMultiplier
        };
        weaponData.type = weaponData.type || '';
        return weaponData;
    }

    bindImportWeapons() {
        const btn_import_guns = document.getElementById('importWeaponsBtn');
        if(btn_import_guns) {
            btn_import_guns.addEventListener('click', (event) => {
                event.preventDefault();
                LocalStorageUtil.import();
            });
        }
    }

    bindExportWeapons() {  
        const btn_export_guns = document.getElementById('exportWeaponsBtn');
        if(btn_export_guns) {
            btn_export_guns.addEventListener('click', (event) => {
                event.preventDefault();
                LocalStorageUtil.export();
            });
        }
    } 
    bindAddSegment() {
        const addSegmentBtn = document.getElementById('addSegmentBtn');
        if(addSegmentBtn) {
            addSegmentBtn.addEventListener('click', (event) => {
                event.preventDefault();
                this.addSegmentRow('',200,1.0);
            });
        }
    }

    bindTabs() {
        document.querySelectorAll('.tab-btn').forEach(button => {
            button.addEventListener('click', () => {
                this.switchTab(button.dataset.tab);
            });
        });
    }

    switchTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tabId);
        });
        document.querySelectorAll('.tab-page').forEach(page => {
            page.classList.toggle('active', page.id === tabId);
        });

        if (tabId === 'tab-add') {
            this.showBulletOptions();
        }
        if (tabId === 'tab-data') {
            // Delay loading JSON editors to prevent UI blocking on large data
            setTimeout(() => this.loadJsonEditors(), 0);
        }
    }

    bindAddNewBullet() {
        const addBulletBtn = document.getElementById('addNewBulletBtn');
        if (!addBulletBtn) {
            return;
        }
        addBulletBtn.addEventListener('click', (event) => {
            event.preventDefault();
            const name = document.getElementById('newBulletName').value.trim();
            const damage = parseFloat(document.getElementById('newBulletDamage').value);
            const armorDamageMultiplier = parseFloat(document.getElementById('newBulletArmorDamage').value);

            if (!name) {
                alert('请填写子弹名称');
                return;
            }
            if (Number.isNaN(damage)) {
                alert('请填写有效的子弹伤害系数');
                return;
            }
            if (Number.isNaN(armorDamageMultiplier)) {
                alert('请填写有效的子弹甲伤系数');
                return;
            }

            const armor = {};
            for (let lv = 1; lv <= 6; lv++) {
                const armorDamage = parseFloat(document.getElementById(`armorDamage${lv}`).value);
                const penetrate = parseFloat(document.getElementById(`penetrate${lv}`).value);
                if (Number.isNaN(armorDamage) || Number.isNaN(penetrate)) {
                    alert(`请填写护甲等级 ${lv} 的甲伤系数和穿透系数`);
                    return;
                }
                armor[lv] = { armorDamage, penetrate };
            }

            const multipliers = {};
            const multIds = ['Head', 'Chest', 'Hand', 'Abdomen', 'arm', 'Leg', 'Foot'];
            multIds.forEach(id => {
                const value = parseFloat(document.getElementById(`bulletMult${id}`).value);
                if (!Number.isNaN(value)) {
                    multipliers[id.toLowerCase()] = value;
                }
            });

            if (this.bulletsData[name]) {
                alert(`子弹名 ${name} 已存在，请使用不同名称`);
                return;
            }

            const bulletData = { damage, armorDamageMultiplier, armor };
            if (Object.keys(multipliers).length > 0) {
                bulletData.multipliers = multipliers;
            }
            this.bulletsData[name] = bulletData;
            this.saveBulletsToStorage();
            this.showBulletOptions();
            this.updateJsonEditorsIfVisible();
            Log.log(`添加子弹: ${name}`);
            // 清空表单
            document.getElementById('newBulletName').value = '';
            document.getElementById('newBulletDamage').value = '';
            document.getElementById('newBulletArmorDamage').value = '1.0';
            for (let lv = 1; lv <= 6; lv++) {
                document.getElementById(`armorDamage${lv}`).value = '';
                document.getElementById(`penetrate${lv}`).value = '';
            }
            multIds.forEach(id => {
                document.getElementById(`bulletMult${id}`).value = '';
            });
        });
    }

    bindEventHandlers() {
        this.bindTabs();
        this.bindCalTTk();
        this.bindCalTTkAccordingDistance();
        this.bindAddNewWeapon();
        this.bindAddNewBullet();
        this.bindImportWeapons();
        this.bindExportWeapons();
        this.bindImportBullets();
        this.bindExportBullets();
        this.bindAddSegment();
        this.bindBurstSettings();
        this.bindCheckboxSelectAll();
        this.bindHitPartWeightsPersistence();
        this.bindJsonEditors();
        this.bindToggleJsonEditors();
        this.bindResetToDefault();
    }

    bindHitPartWeightsPersistence() {
        const hitPartIds = ['head', 'chest', 'abdomen', 'arm', 'hand', 'leg', 'foot'];
        hitPartIds.forEach((id) => {
            const input = document.getElementById(id);
            if (!input) {
                return;
            }

            input.addEventListener('change', () => {
                LocalStorageUtil.saveHitPartWeights(DOMControl.getPartHitWeightsFromUI());
            });
        });
    }

    restoreHitPartWeights() {
        const savedWeights = LocalStorageUtil.loadHitPartWeights();
        if (!savedWeights) {
            return;
        }

        Object.entries(savedWeights).forEach(([part, weight]) => {
            const input = document.getElementById(part);
            if (input) {
                input.value = weight;
            }
        });
    }

    bindCheckboxSelectAll() {
        const selectAllCheckbox = document.getElementById('select_all_weapons');
        if(selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', () => {
                const isChecked = selectAllCheckbox.checked;
                document.querySelectorAll('.select_current_weapon').forEach(checkbox => {
                    checkbox.checked = isChecked;
                    const weaponName = checkbox.closest('tr').querySelector('td:nth-child(2)').textContent;
                    this.weaponDatas.forEach(w => {
                        if(w.name === weaponName) {
                            w.isSelected = isChecked;
                        }
                    });
                });
            });
        }
    }

    addSegmentRow(start, end, multiplier=1.0) {
        const tableBody = document.getElementById('decayTableBody');
        if(!tableBody) return;

        const row = document.createElement('tr');
        row.className = 'decay-segment-row';

        row.innerHTML = `
            <td><input type="number" class="segment-start" value="${start}" placeholder="起始距离" readonly></td>
            <td><input type="number" class="segment-end" value="${end}" placeholder="结束距离"></td>
            <td><input type="number" class="segment-multiplier" value="${multiplier}" placeholder="伤害倍率" step="0.01"></td>
            <td><button type="button" class="remove-segment-btn">-</button></td>
        `;

        tableBody.appendChild(row);
        
        const removeBtn = row.querySelector('.remove-segment-btn');
        removeBtn.addEventListener('click', () => {
            if(tableBody.children.length <= 1) {
                alert('至少保留一个射程段');
                return;
            }
            row.remove();
            this.updateStartValues();
        });

        const endInput = row.querySelector('.segment-end');
        endInput.addEventListener('change', () => {
            this.updateStartValues();
        });

        this.updateStartValues();
    }

    updateStartValues() {
        const rows = document.querySelectorAll('.decay-segment-row');
        let lastEndValue = 0;
        rows.forEach((row, index) => {
            const startInput = row.querySelector('.segment-start');
            const endInput = row.querySelector('.segment-end');
            if(index === 0) {
                startInput.value = 0;
            } else {
                startInput.value = lastEndValue;
            }
            lastEndValue = parseFloat(endInput.value) || 0;
        });
    }

    showBulletOptions() {
        const ammoCheckBoxGroup = document.getElementById('ammoCheckBoxGroup');
        if(!ammoCheckBoxGroup) return;
        ammoCheckBoxGroup.innerHTML = '';
 
        const defaultSelected = ['1','2','3','4','5'];

        Object.keys(this.bulletsData).forEach(bulletType => {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `bullet_${bulletType}`;
            checkbox.value = bulletType;
            checkbox.name = 'ammoType';
            if (defaultSelected.includes(bulletType)) {
                checkbox.checked = true;
            }

            const container = document.createElement('label');
            container.className = 'ammo-option';
            container.htmlFor = checkbox.id;
            container.appendChild(checkbox);
            const text = document.createElement('span');
            text.textContent = bulletType;
            container.appendChild(text);

            ammoCheckBoxGroup.appendChild(container);
        });   
    } 

    saveWeaponsToStorage() {
        this.weaponDatas.forEach((weaponData) => {
            const rof = Number(weaponData.rof) || 0;
            const baseDamage = Number(weaponData.baseDamage) || 0;
            const armorDamage = Number(weaponData.armorDamage) || 0;
            weaponData.baseDamagePerSecond = baseDamage * (rof / 60);
            weaponData.armorDamagePerSecond = armorDamage * (rof / 60);
        });
        LocalStorageUtil.saveWeapons(this.weaponDatas);
    }

    saveBulletsToStorage() {
        LocalStorageUtil.saveBullets(this.bulletsData);
    }

    loadJsonEditors() {
        const weaponsEditor = document.getElementById('weaponsJsonEditor');
        if (weaponsEditor) {
            weaponsEditor.value = JSON.stringify(this.weaponDatas, null, 2);
        }

        const bulletsEditor = document.getElementById('bulletsJsonEditor');
        if (bulletsEditor) {
            bulletsEditor.value = JSON.stringify(this.bulletsData, null, 2);
        }
    }

    bindJsonEditors() {
        const saveWeaponsBtn = document.getElementById('saveWeaponsJson');
        if (saveWeaponsBtn) {
            saveWeaponsBtn.addEventListener('click', () => {
                const weaponsEditor = document.getElementById('weaponsJsonEditor');
                if (!weaponsEditor) return;
                try {
                    const parsed = JSON.parse(weaponsEditor.value);
                    this.weaponDatas = parsed.map(weapon => this.normalizeWeaponData(weapon));
                    this.saveWeaponsToStorage();
                    this.refreshWeaponTable();
                    alert('武器数据保存成功');
                } catch (error) {
                    alert('武器数据 JSON 格式不正确，请检查');
                }
            });
        }

        const saveBulletsBtn = document.getElementById('saveBulletsJson');
        if (saveBulletsBtn) {
            saveBulletsBtn.addEventListener('click', () => {
                const bulletsEditor = document.getElementById('bulletsJsonEditor');
                if (!bulletsEditor) return;
                try {
                    const parsed = JSON.parse(bulletsEditor.value);
                    this.bulletsData = parsed;
                    this.saveBulletsToStorage();
                    this.showBulletOptions();
                    alert('子弹数据保存成功');
                } catch (error) {
                    alert('子弹数据 JSON 格式不正确，请检查');
                }
            });
        }
    }

    bindImportBullets() {
        const btn_import_bullets = document.getElementById('importBulletsBtn');
        if(btn_import_bullets) {
            btn_import_bullets.addEventListener('click', (event) => {
                event.preventDefault();
                LocalStorageUtil.importBullets();
            });
        }
    }

    bindExportBullets() {
        const btn_export_bullets = document.getElementById('exportBulletsBtn');
        if(btn_export_bullets) {
            btn_export_bullets.addEventListener('click', (event) => {
                event.preventDefault();
                LocalStorageUtil.exportBullets();
            });
        }
    }

    bindToggleJsonEditors() {
        const toggleWeaponsBtn = document.getElementById('toggleWeaponsJsonEditor');
        if (toggleWeaponsBtn) {
            toggleWeaponsBtn.addEventListener('click', () => {
                const container = document.getElementById('weaponsJsonEditorContainer');
                if (container) {
                    const isVisible = container.style.display !== 'none';
                    container.style.display = isVisible ? 'none' : 'block';
                    toggleWeaponsBtn.textContent = isVisible ? '展开 JSON 编辑器' : '折叠 JSON 编辑器';
                    if (!isVisible) {
                        this.loadJsonEditors();
                    }
                }
            });
        }

        const toggleBulletsBtn = document.getElementById('toggleBulletsJsonEditor');
        if (toggleBulletsBtn) {
            toggleBulletsBtn.addEventListener('click', () => {
                const container = document.getElementById('bulletsJsonEditorContainer');
                if (container) {
                    const isVisible = container.style.display !== 'none';
                    container.style.display = isVisible ? 'none' : 'block';
                    toggleBulletsBtn.textContent = isVisible ? '展开 JSON 编辑器' : '折叠 JSON 编辑器';
                    if (!isVisible) {
                        this.loadJsonEditors();
                    }
                }
            });
        }
    }

    updateJsonEditorsIfVisible() {
        const weaponsContainer = document.getElementById('weaponsJsonEditorContainer');
        if (weaponsContainer && weaponsContainer.style.display !== 'none') {
            this.loadJsonEditors();
        }

        const bulletsContainer = document.getElementById('bulletsJsonEditorContainer');
        if (bulletsContainer && bulletsContainer.style.display !== 'none') {
            this.loadJsonEditors();
        }
    }

    bindResetToDefault() {
        const resetWeaponsBtn = document.getElementById('resetWeaponsToDefault');
        if (resetWeaponsBtn) {
            resetWeaponsBtn.addEventListener('click', async () => {
                if (confirm('确定要还原武器数据为默认值吗？这将覆盖当前的所有武器数据。')) {
                    try {
                        const response = await fetch('./src/data/weapons.json');
                        const defaultWeapons = await response.json();
                        this.weaponDatas = defaultWeapons.map(weapon => this.normalizeWeaponData(weapon));
                        this.saveWeaponsToStorage();
                        this.refreshWeaponTable();
                        this.loadJsonEditors();
                        alert('武器数据已还原为默认值');
                    } catch (error) {
                        alert('还原武器数据失败：' + error.message);
                    }
                }
            });
        }

        const resetBulletsBtn = document.getElementById('resetBulletsToDefault');
        if (resetBulletsBtn) {
            resetBulletsBtn.addEventListener('click', async () => {
                if (confirm('确定要还原子弹数据为默认值吗？这将覆盖当前的所有子弹数据。')) {
                    try {
                        const response = await fetch('./src/data/bullets.json');
                        const defaultBullets = await response.json();
                        this.bulletsData = defaultBullets;
                        this.saveBulletsToStorage();
                        this.showBulletOptions();
                        this.loadJsonEditors();
                        alert('子弹数据已还原为默认值');
                    } catch (error) {
                        alert('还原子弹数据失败：' + error.message);
                    }
                }
            });
        }
    }

    showEditableWeaponRow(weaponData) {
        const weaponBody = document.querySelector('#editable_weapon_table tbody');
        if (!weaponBody) {
            return;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="text" class="weapon-name inline-input" value="${weaponData.name}"></td>
            <td><input type="number" class="weapon-velocity inline-input" value="${weaponData.velocity || 0}"></td>
            <td><input type="number" class="weapon-base-damage inline-input" value="${weaponData.baseDamage || 0}" step="0.1"></td>
            <td><input type="number" class="weapon-armor-damage inline-input" value="${weaponData.armorDamage || 0}" step="0.01"></td>
            <td><input type="number" class="weapon-rof inline-input" value="${weaponData.rof || 0}" step="1"></td>
            <td><input type="text" class="weapon-supported-ammo inline-input" value="${(weaponData.supportedAmmoTypes || []).join(',')}"></td>
            <td><input type="text" class="weapon-current-ammo inline-input" value="${weaponData.currentAmmoType || ''}"></td>
            <td><button type="button" class="remove-weapon-btn">-</button></td>
        `;
        weaponBody.appendChild(row);

        const nameInput = row.querySelector('.weapon-name');
        const velocityInput = row.querySelector('.weapon-velocity');
        const baseDamageInput = row.querySelector('.weapon-base-damage');
        const armorDamageInput = row.querySelector('.weapon-armor-damage');
        const rofInput = row.querySelector('.weapon-rof');
        const supportedAmmoInput = row.querySelector('.weapon-supported-ammo');
        const currentAmmoInput = row.querySelector('.weapon-current-ammo');
        const removeBtn = row.querySelector('.remove-weapon-btn');

        nameInput.addEventListener('change', () => {
            const newName = nameInput.value.trim();
            if (!newName) {
                nameInput.value = weaponData.name;
                return;
            }
            if (newName !== weaponData.name && this.weaponDatas.some(w => w.name === newName)) {
                alert('武器名已存在，请使用不同名称');
                nameInput.value = weaponData.name;
                return;
            }
            weaponData.name = newName;
            this.saveWeaponsToStorage();
            this.refreshWeaponTable();
        });

        velocityInput.addEventListener('change', () => {
            weaponData.velocity = parseFloat(velocityInput.value) || 0;
            this.saveWeaponsToStorage();
            this.refreshWeaponTable();
        });

        baseDamageInput.addEventListener('change', () => {
            weaponData.baseDamage = parseFloat(baseDamageInput.value) || 0;
            this.saveWeaponsToStorage();
            this.refreshWeaponTable();
        });

        armorDamageInput.addEventListener('change', () => {
            weaponData.armorDamage = parseFloat(armorDamageInput.value) || 0;
            this.saveWeaponsToStorage();
            this.refreshWeaponTable();
        });

        rofInput.addEventListener('change', () => {
            weaponData.rof = parseFloat(rofInput.value) || 0;
            this.saveWeaponsToStorage();
            this.refreshWeaponTable();
        });

        supportedAmmoInput.addEventListener('change', () => {
            weaponData.supportedAmmoTypes = supportedAmmoInput.value.split(',').map(item => item.trim()).filter(Boolean);
            this.saveWeaponsToStorage();
        });

        currentAmmoInput.addEventListener('change', () => {
            weaponData.currentAmmoType = currentAmmoInput.value.trim();
            this.saveWeaponsToStorage();
        });

        removeBtn.addEventListener('click', () => {
            this.weaponDatas = this.weaponDatas.filter(w => w.name !== weaponData.name);
            this.saveWeaponsToStorage();
            this.refreshWeaponTable();
        });
    }

    showEditableBulletRow(bulletName, bulletData) {
        const bulletBody = document.querySelector('#editable_bullet_table tbody');
        if (!bulletBody) {
            return;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="text" class="bullet-name inline-input" value="${bulletName}"></td>
            <td><input type="number" class="bullet-damage inline-input" value="${bulletData.damage || 0}" step="0.01"></td>
            <td><textarea class="bullet-armor inline-textarea">${JSON.stringify(bulletData.armor || {}, null, 2)}</textarea></td>
            <td><button type="button" class="remove-bullet-btn">-</button></td>
        `;
        bulletBody.appendChild(row);

        let currentBulletKey = bulletName;
        const nameInput = row.querySelector('.bullet-name');
        const damageInput = row.querySelector('.bullet-damage');
        const armorTextarea = row.querySelector('.bullet-armor');
        const removeBtn = row.querySelector('.remove-bullet-btn');

        nameInput.addEventListener('change', () => {
            const newName = nameInput.value.trim();
            if (!newName) {
                nameInput.value = currentBulletKey;
                return;
            }
            if (newName !== currentBulletKey && this.bulletsData[newName]) {
                alert('子弹名已存在，请使用不同名称');
                nameInput.value = currentBulletKey;
                return;
            }
            this.bulletsData[newName] = this.bulletsData[currentBulletKey];
            delete this.bulletsData[currentBulletKey];
            currentBulletKey = newName;
            this.saveBulletsToStorage();
            this.showBulletOptions();
        });

        damageInput.addEventListener('change', () => {
            this.bulletsData[currentBulletKey].damage = parseFloat(damageInput.value) || 0;
            this.saveBulletsToStorage();
            this.showBulletOptions();
        });

        armorTextarea.addEventListener('change', () => {
            try {
                const parsedArmor = JSON.parse(armorTextarea.value);
                this.bulletsData[currentBulletKey].armor = parsedArmor;
                this.saveBulletsToStorage();
            } catch (error) {
                alert('护甲详情 JSON 格式不正确，请检查');
                armorTextarea.value = JSON.stringify(this.bulletsData[currentBulletKey].armor || {}, null, 2);
            }
        });

        removeBtn.addEventListener('click', () => {
            delete this.bulletsData[currentBulletKey];
            this.saveBulletsToStorage();
            this.showBulletOptions();
        });
    }

    showWeaponInTable(weaponData){
        const tbody = document.querySelector('#weapon_table tbody');
        if(!tbody) {
            console.error('无法找到武器表格的 tbody 元素');
            return;
        }

        const rangeDisplay = (Array.isArray(weaponData.range) && weaponData.range.length) ? weaponData.range.join('/') : ((Array.isArray(weaponData.ranges) && weaponData.ranges.length) ? weaponData.ranges.join('/') : '');
        const decayDisplay = (Array.isArray(weaponData.decay) && weaponData.decay.length) ? weaponData.decay.join('/') : ((Array.isArray(weaponData.decays) && weaponData.decays.length) ? weaponData.decays.join('/') : '');
        const bulletOptions = (weaponData.allowedBullets || weaponData.supportedAmmoTypes || []).map(ammo => {
            const value = ammo.toString();
            const selected = weaponData.currentAmmoType?.toString() === value ? 'selected' : '';
            return `<option value="${value}" ${selected}>${value}</option>`;
        }).join('');

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="checkbox" class="select_current_weapon" ${weaponData.isSelected ? 'checked' : ''}></input></td>
            <td>${weaponData.name}</td>
            <td>${weaponData.baseDamagePerSecond.toFixed(2)}</td>
            <td>${weaponData.armorDamagePerSecond.toFixed(2)}</td>
            <td>${weaponData.velocity || 0}</td>
            <td>${rangeDisplay}</td>
            <td>${decayDisplay}</td>
            <td>${weaponData.baseDamage || 0}</td>
            <td>${weaponData.armorDamage || 0}</td>
            <td>${weaponData.rof || 0}</td>
            <td><select class="ammo-type-select" align="center">
                ${bulletOptions}
                <option value="global" ${weaponData.currentAmmoType === 'global' ? 'selected' : ''}>global</option>
            </select></td>
            <td><button type="button" class="remove-weapon-btn">-</button></td>
            `;
        tbody.appendChild(row);
    
        const selectCheckbox = row.querySelector('.select_current_weapon');
        selectCheckbox.addEventListener('change', () => {
            const isChecked = selectCheckbox.checked;
            this.weaponDatas.forEach(w => {
                if(w.name === weaponData.name) {
                    Log.log(`武器 ${w.name} 选中状态: ${isChecked}`);
                    w.isSelected = isChecked;
                }
            });
        });
        
        const selectBulletType = row.querySelector('.ammo-type-select');
        selectBulletType.addEventListener('change', () => {
            const currentBulletType = selectBulletType.value;
            Log.log(`武器 ${weaponData.name} 选择子弹类型: ${currentBulletType}`);
            weaponData.currentAmmoType = currentBulletType;
            LocalStorageUtil.saveWeapons(this.weaponDatas);
        });

        const removeBtn = row.querySelector('.remove-weapon-btn');
        removeBtn.addEventListener('click', () => {
            LocalStorageUtil.removeWeapon(weaponData);
            this.weaponDatas = this.weaponDatas.filter(w => w.name !== weaponData.name);
            Log.log(`已删除武器: ${weaponData.name}`);
            Log.log('当前武器列表:', this.weaponDatas);
            row.remove();
            this.refreshWeaponTable();
        });
    }
};