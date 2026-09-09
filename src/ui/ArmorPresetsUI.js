import { LocalStorageUtil } from "../utils/LocalStorageUtil.js";

export class ArmorPresetsUI {
    constructor(containerId) {
        this.containerId = containerId;
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const presets = LocalStorageUtil.loadArmorPresets();

        container.innerHTML = `
            <section class="settings-section">
                <h2>管理敌人护甲预设</h2>
                <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
                    <button id="exportArmorPresetsBtn" class="btn-small">导出</button>
                    <button id="importArmorPresetsBtn" class="btn-small">导入</button>
                    <button id="resetArmorPresetsBtn" class="btn-small">重置</button>
                </div>
                <div class="table-section">
                    <table id="armor_presets_table" class="bullets-table">
                        <thead>
                            <tr>
                                <th>名称</th>
                                <th>权重</th>
                                <th>头盔</th>
                                <th>护甲</th>
                                <th>额外</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody id="armor_presets_tbody"></tbody>
                    </table>
                </div>

                <h3 style="margin-top:16px;">添加 / 编辑 预设</h3>
                <div style="margin-top:8px;">
                    <div class="input-row">
                        <label for="armorPresetName">名称：</label>
                        <input type="text" id="armorPresetName" placeholder="预设名称">
                    </div>
                    <div class="input-row">
                        <label for="preset_helmet_lv">头盔等级：</label>
                        <select id="preset_helmet_lv">
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                            <option value="6">6</option>
                        </select>
                        <label for="preset_helmet_point">头盔耐久：</label>
                        <input type="number" id="preset_helmet_point" value="48" min="0">
                    </div>
                    <div class="input-row">
                        <label for="preset_armor_lv">护甲等级：</label>
                        <select id="preset_armor_lv">
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                            <option value="6">6</option>
                        </select>
                        <label for="preset_armor_point">护甲耐久：</label>
                        <input type="number" id="preset_armor_point" value="110" min="0">
                    </div>
                    <div class="input-row checkbox-row">
                        <label for="preset_protect_abdomen">保护腹部：</label>
                        <input type="checkbox" id="preset_protect_abdomen">
                        <label for="preset_protect_arms">护臂：</label>
                        <input type="checkbox" id="preset_protect_arms">
                    </div>
                    <div class="input-row">
                        <label for="preset_weight">权重：</label>
                        <input type="number" id="preset_weight" value="1" min="1">
                    </div>
                    <div style="margin-top:12px;">
                        <button id="saveArmorPresetBtn">保存预设</button>
                    </div>
                </div>
            </section>
        `;

        // populate table rows
        const tbody = container.querySelector('#armor_presets_tbody');
        if (tbody) {
            const keys = Object.keys(presets).sort();
            if (keys.length === 0) {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td colspan="6" style="text-align:center; color:#64748b; padding:16px;">暂无预设</td>`;
                tbody.appendChild(tr);
            } else {
                keys.forEach(name => {
                    const p = presets[name];
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="text-align:left; padding-left:12px;">${name}</td>
                        <td>${p.weight || 1}</td>
                        <td>${p.helmetLv} / ${p.helmetPoint}</td>
                        <td>${p.armorLv} / ${p.armorPoint}</td>
                        <td>${p.isProtectArms ? '护臂' : '-'} ${p.isProtectAbdomen ? '· 保护腹部' : ''}</td>
                        <td>
                            <button class="btn btn-sm btn-edit btn-edit-preset" data-name="${name}">编辑</button>
                            <button class="btn btn-sm btn-delete btn-delete-preset" data-name="${name}">删除</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }
    }

    bindEvents() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        document.querySelectorAll('.btn-delete-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const name = e.target.dataset.name;
                if (!name) return;
                if (!confirm(`确定删除预设：${name} ?`)) return;
                LocalStorageUtil.removeArmorPreset(name);
                this.render();
                this.bindEvents();
                // update main dropdown if present
                const sel = document.getElementById('armorPresetSelect');
                if (sel && window.UI) window.UI.showArmorPresetOptions();
            });
        });

        document.querySelectorAll('.btn-edit-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const name = e.target.dataset.name;
                const presets = LocalStorageUtil.loadArmorPresets();
                const p = presets[name];
                if (!p) return;
                document.getElementById('armorPresetName').value = name;
                document.getElementById('preset_helmet_lv').value = p.helmetLv;
                document.getElementById('preset_helmet_point').value = p.helmetPoint;
                document.getElementById('preset_armor_lv').value = p.armorLv;
                document.getElementById('preset_armor_point').value = p.armorPoint;
                document.getElementById('preset_protect_abdomen').checked = !!p.isProtectAbdomen;
                document.getElementById('preset_protect_arms').checked = !!p.isProtectArms;
                        document.getElementById('preset_weight').value = p.weight || 1;
            });
        });

        const saveBtn = document.getElementById('saveArmorPresetBtn');
        saveBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            const name = document.getElementById('armorPresetName').value.trim();
            if (!name) { alert('请输入预设名称'); return; }
            const preset = {
                helmetLv: parseInt(document.getElementById('preset_helmet_lv').value) || 1,
                helmetPoint: parseFloat(document.getElementById('preset_helmet_point').value) || 0,
                armorLv: parseInt(document.getElementById('preset_armor_lv').value) || 1,
                armorPoint: parseFloat(document.getElementById('preset_armor_point').value) || 0,
                isProtectAbdomen: !!document.getElementById('preset_protect_abdomen').checked,
                isProtectArms: !!document.getElementById('preset_protect_arms').checked,
                weight: Math.max(1, parseInt(document.getElementById('preset_weight').value) || 1)
            };
            LocalStorageUtil.addArmorPreset(name, preset);
            this.render();
            this.bindEvents();
            if (window.UI) window.UI.showArmorPresetOptions();
            alert('已保存预设');
        });

        document.getElementById('exportArmorPresetsBtn')?.addEventListener('click', () => {
            LocalStorageUtil.exportArmorPresets();
        });
        document.getElementById('importArmorPresetsBtn')?.addEventListener('click', () => {
            LocalStorageUtil.importArmorPresets();
        });
        document.getElementById('resetArmorPresetsBtn')?.addEventListener('click', () => {
            if (!confirm('确定重置为 data/armor_presets.json 中的默认预设吗？')) return;
            LocalStorageUtil.resetArmorPresetsToDefault();
            this.render();
            this.bindEvents();
            if (window.UI) window.UI.showArmorPresetOptions();
            alert('已重置为默认护甲预设');
        });
    }
}
