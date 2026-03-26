import { SimulateEngine } from "../core/SimulateEngine.js";
import { BulletsData } from "../data/BulletsData.js";
import { DOMControl } from "../data/DomControl.js";
import { WeaponData } from "../data/WeaponData.js";
import { LocalStorageUtil } from "../utils/LocalStorageUtil.js";
import { Log } from "../utils/Log.js";

export class UIHandle{ 
    constructor() {
        this.bindEventHandlers();
        this.showBulletOptions();
        this.restoreHitPartWeights();
        this.addSegmentRow(0,200,1.0);
        this.weaponDatas=LocalStorageUtil.loadWeapons();
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
            const burstCountInput = document.getElementById('burstCount');
            const burstRateOfFireInput = document.getElementById('burstRateOfFire');
            const burstIntervalInput = document.getElementById('burstInterval');

            // 定义一个函数来更新连发设置的可用状态
            const updateBurstSettingsState = () => {
                const isBurst = isBurstCheckbox.checked;
                burstCountInput.disabled = !isBurst;
                burstRateOfFireInput.disabled = !isBurst;
                burstIntervalInput.disabled = !isBurst;
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

                this.showWeaponInTable(weaponData);
                this.weaponDatas.push(weaponData);
                LocalStorageUtil.saveWeapons(this.weaponDatas);
                //LocalStorageUtil.addWeapon(weaponData);
                Log.log('添加武器');
            });
        }
    }
    collectDecaySegment() {
        const rows = document.querySelectorAll('.decay-segment-row');
        const range=[]
        const decay=[]

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

    bindEventHandlers() {
        this.bindCalTTk();
        this.bindCalTTkAccordingDistance();
        this.bindAddNewWeapon();
        this.bindImportWeapons();
        this.bindExportWeapons();
        this.bindAddSegment();
        this.bindBurstSettings();
        this.bindCheckboxSelectAll();
        this.bindHitPartWeightsPersistence();
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
 
        const defaultSelected = ['1','2','3','4','5'];

        Object.keys(BulletsData).forEach(bulletType => {   
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `bullet_${bulletType}`;
            checkbox.value = bulletType;
            checkbox.name = 'ammoType';
            // 检查是否需要默认勾选
            if (defaultSelected.includes(bulletType)) {
                checkbox.checked = true;
            }

            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.textContent = bulletType;

            const container = document.createElement('div');
            container.appendChild(checkbox);
            container.appendChild(label);

            ammoCheckBoxGroup.appendChild(container);
        });   
    } 

    showWeaponInTable(weaponData){
        const tbody = document.querySelector('#weapon_table tbody');
        if(!tbody) {
            console.error('无法找到武器表格的 tbody 元素');
            return;
        }
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="checkbox" class="select_current_weapon" ${weaponData.isSelected ? 'checked' : ''}></input></td>
            <td>${weaponData.name}</td>
            <td>${weaponData.baseDamagePerSecond.toFixed(2)}</td>
            <td>${weaponData.armorDamagePerSecond.toFixed(2)}</td>
            <td>${weaponData.velocity}</td>
            <td>${weaponData.range.join('/')}</td>
            <td>${weaponData.decay.join('/')}</td>
            <td>${weaponData.baseDamage}</td>
            <td>${weaponData.armorDamage}</td>
            <td>${weaponData.rof}</td>
            <td><select class="ammo-type-select" align="center">
                ${weaponData.supportedAmmoTypes.map(ammo => `<option value="${ammo}">${ammo}</option>`).join('')}
                <option value="global" selected>global</option>
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
        
        weaponData.currentAmmoType = 'global';
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