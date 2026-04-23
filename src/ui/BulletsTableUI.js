import { LocalStorageUtil } from '../utils/LocalStorageUtil.js';
import bulletsJson from '../../data/bullets.json';
import { getBulletsJsonStructure, addBulletToStructure, removeBulletFromStructure } from '../data/BulletsData.js';
import { Log } from '../utils/Log.js';

export class BulletsTableUI {
    constructor(containerId = 'bullets-table-container') {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`容器 #${containerId} 不存在`);
            return;
        }
        this.tableHeader =`<thead>
                            <tr>
                                <th>子弹名称</th>
                                <th>伤害系数</th>
                                <th>全局甲伤系数</th>
                                <th>对不同护甲的甲伤系数</th>
                                <th>对不同护甲的穿透系数</th>
                                <th>操作</th>
                            </tr>
                        </thead>`;
        this.init();
        

    }

    init() {
        this.render();
        this.bindEvents();
        this.populateCaliberSelect();
    }

    populateCaliberSelect() {
        const caliberSelect = document.getElementById('bulletCaliberSelect');
        if (!caliberSelect) return;

        // 清空旧选项（保留默认选项）
        while (caliberSelect.options.length > 1) {
            caliberSelect.remove(1);
        }

        // 获取所有可用的口径
        const structure = getBulletsJsonStructure();
        const calibers = Object.keys(structure).filter(key => key !== 'default_bullets');

        calibers.forEach(caliber => {
            const option = document.createElement('option');
            option.value = caliber;
            option.textContent = caliber;
            caliberSelect.appendChild(option);
        });
    }

    render() {
        const structure = getBulletsJsonStructure();
        let html = `
            <section class="bullets-table-ui">
                <div class="bullets-header">
                    <h2>管理子弹</h2>
                    <div class="bullets-actions">
                        <button class="btn btn-primary" id="btn-add-caliber">添加新口径</button>
                        <button class="btn btn-secondary" id="btn-export-bullets">导出 JSON</button>
                        <button class="btn btn-secondary" id="btn-import-bullets">导入 JSON</button>
                        <button type="button" class="btn btn-secondary" id="resetBulletsToDefault">重置数据</button>
                    </div>
                </div>

                <div class="bullets-content">
                    <div class="default-bullets-section">
                        <h3>默认模版</h3>
                        ${this.renderDefaultBulletsTable(structure.default_bullets || {})}
                    </div>

                    <div class="caliber-bullets-sections">
        `;

        // 渲染每个口径的子弹
        Object.entries(structure).forEach(([caliber, caliberData]) => {
            if (caliber === 'default_bullets') return;
            
            html += this.renderCaliberSection(caliber, caliberData);
        });

        html += `
                    </div>
                </div>
            </section>
        `;

        this.container.innerHTML = html;
        this.populateCaliberSelect();
    }

    renderDefaultBulletsTable(defaultBullets) {
        let html = `
            <section class="settings-section">
            <table class="bullets-table">
                ${this.tableHeader} 
                <tbody>
        `;

        Object.entries(defaultBullets).forEach(([bulletId, bulletData]) => {
            const armorData = bulletData.armor || {};
            
            // 格式化护甲数据
            let armorDamageArray = [];
            let penetrateArray = [];
            for (let i = 1; i <= 6; i++) {
                const armor = armorData[i] || { armorDamage: 1.0, penetrate: 0 };
                armorDamageArray.push(armor.armorDamage);
                penetrateArray.push(armor.penetrate);
            }

            html += `
                <tr>
                    <td>${bulletId}</td>
                    <td>
                        <span class="damage-value">${bulletData.damage || 1.0}</span>
                    </td>
                    <td>
                        <span class="danage-value">${bulletData.armorDamage || 1.0}</span>
                    </td>
                    <td>${armorDamageArray.join('/')}</td>
                    <td>${penetrateArray.join('/')}</td>
                    <td>
                        <button class="btn btn-sm btn-load" data-bullet-id="${bulletId}" data-caliber="default_bullets" data-type="default">读取</button>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
            </section>
        `;

        return html;
    }

    renderCaliberSection(caliber, caliberData) {
        const availableBullets = caliberData.available_bullets || [];
        const specialBullets = caliberData.special_bullets || {};

        let html = `
            <h3>${caliber}</h3>
            <section class="settings-section">
            <div class="caliber-section" data-caliber="${caliber}">
                <table class="bullets-table">
                    ${this.tableHeader}
                    <tbody>
        `;

        // 渲染 available_bullets
        availableBullets.forEach(bulletId => {
            const defaultBullets = getBulletsJsonStructure().default_bullets || {};
            const bulletData = defaultBullets[bulletId] || { damage: 1.0 };
            const armorData = bulletData.armor || {};
            
            // 格式化护甲数据：分别提取所有 armorDamage 和 penetrate
            let armorDamageArray = [];
            let penetrateArray = [];
            for (let i = 1; i <= 6; i++) {
                const armor = armorData[i] || { armorDamage: 1.0, penetrate: 0 };
                armorDamageArray.push(armor.armorDamage);
                penetrateArray.push(armor.penetrate);
            }

            html += `
                <tr class="available-bullet-row">
                    <td>${bulletId}</td>
                    <td>
                        <span class="damage-value">${bulletData.damage || 1.0}</span>
                    </td>
                    <td>
                        <span class="danage-value">${bulletData.armorDamage || 1.0}</span>
                    </td>
                    <td>${armorDamageArray.join('/')}</td>
                    <td>${penetrateArray.join('/')}</td>
                    <td>
                    </td>
                </tr>
            `;
        });

        // 渲染 special_bullets
        Object.entries(specialBullets).forEach(([bulletName, bulletData]) => {
            const armorData = bulletData.armor || {};
            
            // 格式化护甲数据
            let armorDamageArray = [];
            let penetrateArray = [];
            for (let i = 1; i <= 6; i++) {
                const armor = armorData[i] || { armorDamage: 1.0, penetrate: 0 };
                armorDamageArray.push(armor.armorDamage);
                penetrateArray.push(armor.penetrate);
            }

            html += `
                <tr class="special-bullet-row">
                    <td>
                        <span class="bullet-type-badge special">${bulletName}</span>
                    </td>
                    <td>
                        <span class="damage-value">${bulletData.damage || 1.0}</span>
                    </td>
                    <td>
                        <span class="danage-value">${bulletData.armorDamage || 1.0}</span>
                    </td>
                    <td>${armorDamageArray.join('/')}</td>
                    <td>${penetrateArray.join('/')}</td>
                    <td>
                        <button class="btn btn-sm btn-edit" data-bullet-id="${bulletName}" data-caliber="${caliber}" data-type="special">编辑</button>
                        <button class="btn btn-sm btn-delete" data-bullet-id="${bulletName}" data-caliber="${caliber}" data-type="special">删除</button>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
            </section>
        `;

        return html;
    }

    bindEvents() {
        // 添加新口径
        document.getElementById('btn-add-caliber')?.addEventListener('click', () => this.handleAddCaliberClick());

        // 添加现有子弹
        document.querySelectorAll('.btn-add-available').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleAddAvailableBulletClick(e));
        });

        // 添加特定子弹
        document.querySelectorAll('.btn-add-special').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleAddSpecialBulletClick(e));
        });

        // 删除子弹
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleDeleteBullet(e));
        });

        // 编辑子弹
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleEditBullet(e));
        });

        // 读取默认子弹
        document.querySelectorAll('.btn-load').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleLoadBullet(e));
        });

        // 导出/导入
        document.getElementById('btn-export-bullets')?.addEventListener('click', () => {
            LocalStorageUtil.exportBulletsJsonStructure();
        });

        document.getElementById('btn-import-bullets')?.addEventListener('click', () => {
            LocalStorageUtil.importBulletsJsonStructure();
        });

        // 重置数据
        document.getElementById('resetBulletsToDefault')?.addEventListener('click', () => {
            if (confirm('确定要重置所有子弹数据为默认吗？此操作不可撤销。')) {
                // 还原 localStorage 中的 bullets 结构为初始 bullets.json
                LocalStorageUtil.saveBulletsJsonStructure(bulletsJson);
                this.render();
                this.bindEvents();
                alert('子弹数据已重置为默认状态！');
            }
        });
    }

    handleEditBullet(e) {
        const caliber = e.target.dataset.caliber;
        const bulletId = e.target.dataset.bulletId;
        const bulletType = e.target.dataset.type || 'special';

        const structure = getBulletsJsonStructure();
        let bulletData = null;

        // 根据类型获取子弹数据
        if (bulletType === 'default') {
            bulletData = structure.default_bullets?.[bulletId];
        } else {
            bulletData = structure[caliber]?.special_bullets?.[bulletId];
        }

        if (!bulletData) {
            alert('子弹数据不存在');
            return;
        }

        // 填充表单数据
        document.getElementById('bulletCaliberSelect').value = caliber;
        document.getElementById('newBulletName').value = bulletId;
        document.getElementById('newBulletDamage').value = bulletData.damage || 1.0;
        document.getElementById('newBulletArmorDamage').value = bulletData.damage || 1.0;

        // 填充护甲详情
        const armorData = bulletData.armor || {};
        for (let i = 1; i <= 6; i++) {
            const armor = armorData[i] || { armorDamage: 1.0, penetrate: 0 };
            document.getElementById(`armorDamage${i}`).value = armor.armorDamage || 1.0;
            document.getElementById(`penetrate${i}`).value = armor.penetrate || 0;
        }

        // 滚动到表单
        document.getElementById('tab-data').scrollIntoView({ behavior: 'smooth' });
    }

    handleLoadBullet(e) {
        const caliber = e.target.dataset.caliber;
        const bulletId = e.target.dataset.bulletId;
        const bulletType = e.target.dataset.type || 'default';

        const structure = getBulletsJsonStructure();
        let bulletData = null;

        // 根据类型获取子弹数据
        if (bulletType === 'default') {
            bulletData = structure.default_bullets?.[bulletId];
        }

        if (!bulletData) {
            alert('子弹数据不存在');
            return;
        }

        // 填充表单数据（不设置口径，让用户选择）
        document.getElementById('newBulletName').value = bulletId;
        document.getElementById('newBulletDamage').value = bulletData.damage || 1.0;
        document.getElementById('newBulletArmorDamage').value = bulletData.armorDamage || 1.0;

        // 填充护甲详情
        const armorData = bulletData.armor || {};
        for (let i = 1; i <= 6; i++) {
            const armor = armorData[i] || { armorDamage: 1.0, penetrate: 0 };
            document.getElementById(`armorDamage${i}`).value = armor.armorDamage || 1.0;
            document.getElementById(`penetrate${i}`).value = armor.penetrate || 0;
        }

        // 滚动到表单
        document.getElementById('tab-data').scrollIntoView({ behavior: 'smooth' });
    }


    handleAddCaliberClick() {
        const caliberName = prompt('请输入新口径名称 (例如: 5.56x45mm)');
        if (!caliberName || caliberName.trim() === '') {
            return;
        }

        const structure = getBulletsJsonStructure();
        if (structure[caliberName]) {
            alert('该口径已存在');
            return;
        }

        structure[caliberName] = {
            available_bullets: [],
            special_bullets: {}
        };

        LocalStorageUtil.saveBulletsJsonStructure(structure);
        this.render();
        this.bindEvents();
    }

    handleAddAvailableBulletClick(e) {
        const caliber = e.target.dataset.caliber;
        const bulletIdStr = prompt('请输入子弹ID (用逗号分隔多个，如: 1,2,3)');
        if (!bulletIdStr || bulletIdStr.trim() === '') {
            return;
        }

        const structure = getBulletsJsonStructure();
        const bulletIds = bulletIdStr.split(',').map(id => id.trim());

        bulletIds.forEach(bulletId => {
            if (!isNaN(bulletId)) {
                addBulletToStructure(caliber, 'available', parseInt(bulletId), null);
            }
        });

        this.render();
        this.bindEvents();
    }

    handleAddSpecialBulletClick(e) {
        const caliber = e.target.dataset.caliber;
        const bulletName = prompt('请输入特定子弹名称 (例如: AP, HP)');
        if (!bulletName || bulletName.trim() === '') {
            return;
        }

        const damage = prompt('请输入伤害系数 (默认: 1.0)', '1.0');
        const damageValue = parseFloat(damage) || 1.0;

        const structure = getBulletsJsonStructure();
        if (!structure[caliber]) {
            structure[caliber] = { available_bullets: [], special_bullets: {} };
        }

        if (!structure[caliber].special_bullets) {
            structure[caliber].special_bullets = {};
        }

        structure[caliber].special_bullets[bulletName] = {
            damage: damageValue,
            armor: {}
        };

        LocalStorageUtil.saveBulletsJsonStructure(structure);
        this.render();
        this.bindEvents();
    }

    handleDeleteCaliber(e) {
        const caliber = e.target.dataset.caliber;
        if (confirm(`确认删除口径 "${caliber}" 吗？此操作无法撤销。`)) {
            const structure = getBulletsJsonStructure();
            delete structure[caliber];
            LocalStorageUtil.saveBulletsJsonStructure(structure);
            this.render();
            this.bindEvents();
        }
    }

    handleDeleteBullet(e) {
        const caliber = e.target.dataset.caliber;
        const bulletId = e.target.dataset.bulletId;
        const bulletType = e.target.dataset.type || 'available';

        if (confirm(`确认删除该子弹吗？`)) {
            if (bulletType === 'default') {
                const structure = getBulletsJsonStructure();
                delete structure.default_bullets?.[bulletId];
                LocalStorageUtil.saveBulletsJsonStructure(structure);
            } else {
                removeBulletFromStructure(caliber, bulletType, bulletId);
            }
            this.render();
            this.bindEvents();
        }
    }

    handleDamageChange(e) {
        const bulletId = e.target.dataset.bulletId;
        const newDamage = parseFloat(e.target.value) || 1.0;

        const structure = getBulletsJsonStructure();
        if (structure.default_bullets && structure.default_bullets[bulletId]) {
            structure.default_bullets[bulletId].damage = newDamage;
            LocalStorageUtil.saveBulletsJsonStructure(structure);
            console.log(`已更新默认子弹 ${bulletId} 的伤害值为 ${newDamage}`);
        }
    }

    handleSpecialDamageChange(e) {
        const bulletName = e.target.dataset.bulletName;
        const caliber = e.target.dataset.caliber;
        const newDamage = parseFloat(e.target.value) || 1.0;

        const structure = getBulletsJsonStructure();
        if (structure[caliber]?.special_bullets?.[bulletName]) {
            structure[caliber].special_bullets[bulletName].damage = newDamage;
            LocalStorageUtil.saveBulletsJsonStructure(structure);
            console.log(`已更新 ${caliber} 的特定子弹 ${bulletName} 的伤害值为 ${newDamage}`);
        }
    }
}
