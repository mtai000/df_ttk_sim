import { SimulateEngine } from "../core/SimulateEngine.js";
import { BulletsData, getMergedBulletsData, getBulletsJsonStructure, addBulletToStructure } from "../data/BulletsData.js";
import { DOMControl } from "../data/DomControl.js";
import { WeaponData } from "../data/WeaponData.js";
import { LocalStorageUtil } from "../utils/LocalStorageUtil.js";
import { Log } from "../utils/Log.js";
import { BulletsTableUI } from "./BulletsTableUI.js";
import { getSupportedAmmoTypes } from "../data/WeaponData.js";

export class UIHandle {
    constructor() {
        this.init();
    }

    async init() {
        this.weaponDatas = await LocalStorageUtil.loadWeapons();
        this.bulletsData = getMergedBulletsData();
        this.bindEventHandlers();
        this.showCaliberOptions();
        this.restoreHitPartWeights();
        this.addSegmentRow(0, 200, 1.0);
        this.refreshWeaponTable();
        this.bulletsTableUI = new BulletsTableUI('bullets-table-container');
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

    bindCalTTk() {
        const btn_cal_ttk = document.getElementById('button_cal_ttk');
        if (btn_cal_ttk) {
            btn_cal_ttk.addEventListener('click', (event) => {
                event.preventDefault();
                //获取选中的武器数据
                const selectedWeapons = this.weaponDatas.filter(w => w.isSelected);
                if (selectedWeapons.length === 0) {
                    alert('请至少选择一把武器');
                    return;
                }
                // 调用计算 ttk 的函数
                const simulateEngine = new SimulateEngine(selectedWeapons);
                simulateEngine.runMultipleSimulations(DOMControl.getDistanceFromUI(), DOMControl.getHitChanceFromUI());
            });
        }
    }

    bindCalTTkAccordingDistance() {
        const btn_cal_ttk_according_distance = document.getElementById('button_cal_ttk_according_distance');
        if (btn_cal_ttk_according_distance) {
            btn_cal_ttk_according_distance.addEventListener('click', (event) => {
                event.preventDefault();
                const selectedWeapons = this.weaponDatas.filter(w => w.isSelected);
                if (selectedWeapons.length === 0) {
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
        if (isBurstCheckbox) {
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
        if (btn_add_new_gun) {
            btn_add_new_gun.addEventListener('click', (event) => {
                event.preventDefault();

                // 从口径选择框获取选定的口径
                const caliber = document.getElementById('caliberSelect').value;
                if (!caliber) {
                    alert('请选择武器口径');
                    return;
                }

                const weaponData = new WeaponData({
                    name: document.getElementById('newName').value,
                    velocity: parseFloat(document.getElementById('newVelocity').value),
                    baseDamage: parseFloat(document.getElementById('newBaseDamage').value),
                    armorDamage: parseFloat(document.getElementById('newArmorDamage').value),
                    rof: parseFloat(document.getElementById('newRateOfFire').value),
                    caliber: caliber,
                });
                weaponData.setPartMultiplier('head', parseFloat(document.getElementById('multHead').value) || 1.9);
                weaponData.setPartMultiplier('chest', parseFloat(document.getElementById('multChest').value) || 1.0);
                weaponData.setPartMultiplier('hand', parseFloat(document.getElementById('multHand').value) || 0.4);
                weaponData.setPartMultiplier('abdomen', parseFloat(document.getElementById('multAbdomen').value) || 0.9);
                weaponData.setPartMultiplier('arm', parseFloat(document.getElementById('multarm').value) || 0.4);
                weaponData.setPartMultiplier('leg', parseFloat(document.getElementById('multLeg').value) || 0.4);
                weaponData.setPartMultiplier('foot', parseFloat(document.getElementById('multFoot').value) || 0.4);

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
        const range = [];
        const decay = [];

        rows.forEach((row, index) => {
            const end = parseFloat(row.querySelector('.segment-end').value);
            const multiplier = parseFloat(row.querySelector('.segment-multiplier').value);
            if (isNaN(end) || isNaN(multiplier)) {
                alert(`请确保第 ${index + 1} 行的结束距离和伤害倍率都是有效数字`);
                throw new Error(`Invalid input in decay segment row ${index + 1}`);
            }

            range.push(end);
            decay.push(multiplier);
        });

        return { range, decay };
    }



    bindImportWeapons() {
        const btn_import_guns = document.getElementById('importWeaponsBtn');
        if (btn_import_guns) {
            btn_import_guns.addEventListener('click', (event) => {
                event.preventDefault();
                LocalStorageUtil.import();
            });
        }
    }

    bindExportWeapons() {
        const btn_export_guns = document.getElementById('exportWeaponsBtn');
        if (btn_export_guns) {
            btn_export_guns.addEventListener('click', (event) => {
                event.preventDefault();
                LocalStorageUtil.export();
            });
        }
    }
    bindAddSegment() {
        const addSegmentBtn = document.getElementById('addSegmentBtn');
        if (addSegmentBtn) {
            addSegmentBtn.addEventListener('click', (event) => {
                event.preventDefault();
                this.addSegmentRow('', 200, 1.0);
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
            this.showCaliberOptions();
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
            const caliber = document.getElementById('bulletCaliberSelect').value;
            const name = document.getElementById('newBulletName').value.trim();
            const damage = parseFloat(document.getElementById('newBulletDamage').value);
            const armorDamageMultiplier = parseFloat(document.getElementById('newBulletArmorDamage').value);

            if (!caliber || caliber === 'default_bullets') {
                alert('默认模板不可修改，请选择一个具体的口径');
                return;
            }
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
            const multIds = ['Head', 'Chest', 'Hand', 'Abdomen', 'Arm', 'Leg', 'Foot'];
            multIds.forEach(id => {
                const value = parseFloat(document.getElementById(`bulletMult${id}`).value);
                if (!Number.isNaN(value)) {
                    multipliers[id.toLowerCase()] = value;
                }
            });

            // 检查指定口径下是否已存在同名子弹
            const structure = getBulletsJsonStructure();
            const isExisting = structure[caliber]?.special_bullets?.[name];

            const bulletData = {
                damage,
                armorDamage: armorDamageMultiplier,
                armor
            };
            if (Object.keys(multipliers).length > 0) {
                bulletData.multipliers = multipliers;
            }

            // 添加或更新子弹到指定口径的 special_bullets
            addBulletToStructure(caliber, 'special', name, bulletData);

            this.saveBulletsToStorage();
            this.showCaliberOptions();
            this.updateJsonEditorsIfVisible();

            // 刷新子弹表格UI
            if (this.bulletsTableUI) {
                this.bulletsTableUI.render();
                this.bulletsTableUI.bindEvents();
            }

            Log.log(`${isExisting ? '更新' : '添加'}子弹: ${caliber} - ${name}`);

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
                input.value = weight || 0;
            }
        });
    }

    bindCheckboxSelectAll() {
        const selectAllCheckbox = document.getElementById('select_all_weapons');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', () => {
                const isChecked = selectAllCheckbox.checked;
                document.querySelectorAll('.select_current_weapon').forEach(checkbox => {
                    checkbox.checked = isChecked;
                    const weaponName = checkbox.closest('tr').querySelector('td:nth-child(2)').textContent;
                    this.weaponDatas.forEach(w => {
                        if (w.name === weaponName) {
                            w.isSelected = isChecked;
                        }
                    });
                });
            });
        }
    }

    addSegmentRow(start, end, multiplier = 1.0) {
        const tableBody = document.getElementById('decayTableBody');
        if (!tableBody) return;

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
            if (tableBody.children.length <= 1) {
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
            if (index === 0) {
                startInput.value = 0;
            } else {
                startInput.value = lastEndValue;
            }
            lastEndValue = parseFloat(endInput.value) || 0;
        });
    }

    showCaliberOptions() {
        const caliberSelect = document.getElementById('caliberSelect');
        if (!caliberSelect) return;

        // 清空旧选项（保留默认选项）
        while (caliberSelect.options.length > 1) {
            caliberSelect.remove(1);
        }

        // 获取所有可用的口径
        const calibers = this.getCalibers();

        calibers.forEach(caliber => {
            const option = document.createElement('option');
            option.value = caliber;
            option.textContent = caliber;
            caliberSelect.appendChild(option);
        });
    }

    getCalibers() {
        // 从bulletsData中提取所有口径
        const calibers = new Set();

        Object.keys(this.bulletsData).forEach(bulletKey => {
            if (bulletKey !== "default_bullets") {
                calibers.add(bulletKey);
            }
        });

        // 返回排序后的口径列表
        return Array.from(calibers).sort();
    }

    getSupportedAmmoTypesByCaliper(caliber) {
        // 根据口径返回该口径的所有可用弹药类型
        const ammoTypes = [];

        Object.keys(this.bulletsData).forEach(bulletKey => {
            const bullet = this.bulletsData[bulletKey];
            if (bullet.caliber === caliber) {
                ammoTypes.push(bulletKey);
            }
        });

        return ammoTypes;
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
                    this.weaponDatas = JSON.parse(weaponsEditor.value);
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
                    this.bulletsData = JSON.parse(bulletsEditor.value);
                    this.saveBulletsToStorage();
                    this.showCaliberOptions();
                    alert('子弹数据保存成功');
                } catch (error) {
                    alert('子弹数据 JSON 格式不正确，请检查');
                }
            });
        }
    }

    bindImportBullets() {
        const btn_import_bullets = document.getElementById('importBulletsBtn');
        if (btn_import_bullets) {
            btn_import_bullets.addEventListener('click', (event) => {
                event.preventDefault();
                LocalStorageUtil.importBullets();
            });
        }
    }

    bindExportBullets() {
        const btn_export_bullets = document.getElementById('exportBulletsBtn');
        if (btn_export_bullets) {
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
    bindResetWeapons() {
        const resetWeaponsBtn = document.getElementById('resetWeaponsToDefault');
        if (resetWeaponsBtn) {
            resetWeaponsBtn.addEventListener('click', async () => {
                if (confirm('确定要还原武器数据为默认值吗？这将覆盖当前的所有武器数据。')) {
                    try {
                        const response = await fetch('./data/weapons.json');
                        this.weaponDatas = await response.json();
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
    }
    bindResetBullets() {
        const resetBulletsBtn = document.getElementById('resetBulletsToDefault');
        if (resetBulletsBtn) {
            resetBulletsBtn.addEventListener('click', async () => {
                if (confirm('确定要还原子弹数据为默认值吗？这将覆盖当前的所有子弹数据。')) {
                    try {
                        const response = await fetch('./data/bullets.json');
                        const defaultBullets = await response.json();
                        this.bulletsData = defaultBullets;
                        this.saveBulletsToStorage();
                        this.showCaliberOptions();
                        this.loadJsonEditors();
                        alert('子弹数据已还原为默认值');
                    } catch (error) {
                        alert('还原子弹数据失败：' + error.message);
                    }
                }
            });
        }
    }

    bindResetToDefault() {
        this.bindResetWeapons();
        this.bindResetBullets();
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
            this.showCaliberOptions();
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
            this.showCaliberOptions();
        });
    }

    showWeaponInTable(weaponData) {
        const tbody = document.querySelector('#weapon_table tbody');
        if (!tbody) {
            console.error('无法找到武器表格的 tbody 元素');
            return;
        }

        const rangeDisplay = (Array.isArray(weaponData.range) && weaponData.range.length) ? weaponData.range.join('/') : ((Array.isArray(weaponData.ranges) && weaponData.ranges.length) ? weaponData.ranges.join('/') : '');
        const decayDisplay = (Array.isArray(weaponData.decay) && weaponData.decay.length) ? weaponData.decay.join('/') : ((Array.isArray(weaponData.decays) && weaponData.decays.length) ? weaponData.decays.join('/') : '');
        // 根据口径获取支持的子弹类型
        let bulletList = getSupportedAmmoTypes(weaponData);
        let bulletOptions = bulletList.map(ammo => {
            const value = ammo.toString();
            const selected = this.currentAmmoType?.toString() === value ? 'selected' : '';
            return `<option value="${value}" ${selected}>${value}</option>`;
        }).join('');
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="checkbox" class="select_current_weapon" ${weaponData.isSelected ? 'checked' : ''}></input></td>
            <td>${weaponData.name}</td>
            <td>${(weaponData.baseDamage * weaponData.rof / 60).toFixed(2)}</td>
            <td>${(weaponData.armorDamage * weaponData.rof / 60).toFixed(2)}</td>
            <td>${weaponData.rof || 0}</td>
            <td>${rangeDisplay}</td>
            <td>${decayDisplay}</td>
            <td>${weaponData.baseDamage || 0}</td>
            <td>${weaponData.armorDamage || 0}</td>
            <td>${weaponData.velocity || 0}</td>
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
                if (w.name === weaponData.name) {
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