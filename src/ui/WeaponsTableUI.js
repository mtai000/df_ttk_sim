import { LocalStorageUtil } from '../utils/LocalStorageUtil.js';
import { Log } from '../utils/Log.js';

/**
 * 生成武器基础数据列的 HTML（多个 <td>），供两个页面复用。
 * 返回: { html, rangeDisplay, decayDisplay }
 */
export function renderWeaponBaseCells(weapon) {
    const rangeDisplay = (Array.isArray(weapon.range) && weapon.range.length)
        ? weapon.range.join('/')
        : (Array.isArray(weapon.ranges) ? weapon.ranges.join('/') : '-');
    const decayDisplay = (Array.isArray(weapon.decay) && weapon.decay.length)
        ? weapon.decay.join('/')
        : (Array.isArray(weapon.decays) ? weapon.decays.join('/') : '-');

    const multStr = weapon.multiplier
        ? `头${weapon.multiplier.head || 1.9} 胸${weapon.multiplier.chest || 1.0} 腹${weapon.multiplier.abdomen || 0.9} 臂${weapon.multiplier.arm || 0.4}`
        : '-';

    const burstStr = weapon.isBurst
        ? `✓ ${weapon.burstCount || 0}发`
        : '✗';

    const html = `
            <td><strong>${weapon.name || '未命名'}</strong></td>
            <td>${weapon.baseDamage != null ? weapon.baseDamage : '-'}</td>
            <td>${weapon.armorDamage != null ? weapon.armorDamage : '-'}</td>
            <td>${weapon.rof || '-'}</td>
            <td>${weapon.velocity || '-'}</td>
            <td>${weapon.triggerDelay != null ? weapon.triggerDelay + 'ms' : '-'}</td>
            <td>${burstStr}</td>
            <td style="font-size: 0.75rem; white-space: nowrap;">${multStr}</td>
            <td style="font-size: 0.75rem; white-space: nowrap;">
                ${rangeDisplay}<br><span style="color: #64748b;">×${decayDisplay}</span>
            </td>`;

    return { html, rangeDisplay, decayDisplay };
}

export class WeaponsTableUI {
    constructor(containerId = 'weapons-management-container') {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`容器 #${containerId} 不存在`);
            return;
        }
        this.weaponDatas = [];
        this.onEditWeapon = null; // callback: (weaponData, index) => void
    }

    setWeaponDatas(datas) {
        this.weaponDatas = datas || [];
    }

    setOnEditWeapon(callback) {
        this.onEditWeapon = callback;
    }

    render() {
        if (!this.container) return;

        // 按口径分组
        const grouped = this.groupByCaliber();

        let html = `
            <section class="weapons-table-ui">
                <div class="weapons-header">
                    <h2>📋 已添加的武器</h2>
                </div>
                <section class="settings-section" style="padding: 0; overflow-x: auto;">
        `;

        if (this.weaponDatas.length === 0) {
            html += `
                <div style="text-align: center; color: #94a3b8; padding: 40px 16px;">
                    暂无武器数据，请在上方添加武器
                </div>
            `;
        } else {
            // 渲染每个口径的分组
            const caliberKeys = Object.keys(grouped).sort();
            caliberKeys.forEach(caliber => {
                const weapons = grouped[caliber];
                html += this.renderCaliberSection(caliber, weapons);
            });
        }

        html += `
                </section>
            </section>
        `;

        this.container.innerHTML = html;
        this.bindEvents();
    }

    groupByCaliber() {
        const grouped = {};
        this.weaponDatas.forEach((weapon, index) => {
            // 保留原始 index 供编辑/删除使用
            const caliber = weapon.caliber || '未分类';
            if (!grouped[caliber]) {
                grouped[caliber] = [];
            }
            grouped[caliber].push({ weapon, index });
        });
        return grouped;
    }

    renderCaliberSection(caliber, weapons) {
        let html = `
            <div class="caliber-group">
                <h3 class="caliber-group-header">${caliber}</h3>
                <table class="weapons-management-table">
                    <thead>
                        <tr>
                            <th>武器名称</th>
                            <th>基础伤害</th>
                            <th>护甲伤害</th>
                            <th>射速</th>
                            <th>子弹初速</th>
                            <th>扳机延迟</th>
                            <th>连发</th>
                            <th>部位倍率</th>
                            <th>射程衰减</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        weapons.forEach(({ weapon, index }) => {
            html += this.renderWeaponRow(weapon, index);
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
        return html;
    }

    renderWeaponRow(weapon, index) {
        const { html: baseCells } = renderWeaponBaseCells(weapon);

        return `
            <tr>
                ${baseCells}
                <td>
                    <div style="display: flex; gap: 6px; justify-content: center;">
                        <button class="btn btn-sm btn-edit btn-edit-weapon" data-index="${index}">编辑</button>
                        <button class="btn btn-sm btn-delete btn-delete-weapon" data-index="${index}">删除</button>
                    </div>
                </td>
            </tr>
        `;
    }

    bindEvents() {
        // 编辑按钮
        document.querySelectorAll('.btn-edit-weapon').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                const weapon = this.weaponDatas[index];
                if (weapon && this.onEditWeapon) {
                    this.onEditWeapon(weapon, index);
                }
            });
        });

        // 删除按钮
        document.querySelectorAll('.btn-delete-weapon').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                const weapon = this.weaponDatas[index];
                if (!weapon) return;

                if (confirm(`确认删除武器 "${weapon.name}" 吗？此操作无法撤销。`)) {
                    LocalStorageUtil.removeWeapon(weapon);
                    this.weaponDatas.splice(index, 1);
                    Log.log(`已删除武器: ${weapon.name}`);
                    this.render();
                    this.bindEvents();
                    // 触发刷新回调（让 UIHandle 同步刷新第一页的武器表）
                    if (this.onWeaponListChanged) {
                        this.onWeaponListChanged();
                    }
                }
            });
        });
    }

    setOnWeaponListChanged(callback) {
        this.onWeaponListChanged = callback;
    }
}
