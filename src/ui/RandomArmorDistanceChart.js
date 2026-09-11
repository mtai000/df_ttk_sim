import { Chart } from "chart.js/auto";
import { Log } from "../utils/Log.js";
import { DistanceChart } from "./DistanceChart.js";
import { getMergedBulletsData } from "../data/BulletsData.js";
import { LocalStorageUtil } from "../utils/LocalStorageUtil.js";
import { DOMControl } from "../data/DomControl.js";

function getOrCreateCountTooltip(chart) {
    const parent = chart.canvas.parentNode;
    if (!parent) return null;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';

    let tooltipEl = parent.querySelector('.random-armor-distance-tooltip');
    if (tooltipEl) return tooltipEl;

    tooltipEl = document.createElement('div');
    tooltipEl.className = 'random-armor-distance-tooltip';
    Object.assign(tooltipEl.style, {
        position: 'absolute',
        pointerEvents: 'none',
        background: 'rgba(255, 255, 255, 0.96)',
        border: '1px solid rgba(0, 0, 0, 0.12)',
        borderRadius: '8px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12)',
        color: '#222',
        minWidth: '160px',
        padding: '8px 12px',
        opacity: '0',
        transform: 'translate(12px, -50%)',
        transition: 'opacity 80ms ease',
        zIndex: '10',
        fontSize: '12px',
        lineHeight: '1.45'
    });

    parent.appendChild(tooltipEl);
    return tooltipEl;
}

function renderExternalTooltipCount(context) {
    const { chart, tooltip } = context;
    const tooltipEl = getOrCreateCountTooltip(chart);
    if (!tooltipEl) return;

    if (tooltip.opacity === 0) {
        tooltipEl.style.opacity = '0';
        return;
    }

    tooltipEl.replaceChildren();
    const title = document.createElement('div');
    title.textContent = tooltip.title?.[0] || '';
    Object.assign(title.style, { fontWeight: '600', marginBottom: '6px' });
    tooltipEl.appendChild(title);

    const items = tooltip.dataPoints || [];
    items.forEach((item, index) => {
        const row = document.createElement('div');
        Object.assign(row.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: index === 0 ? '0' : '4px'
        });

        const colorDot = document.createElement('span');
        Object.assign(colorDot.style, { width: '8px', height: '8px', borderRadius: '999px', background: String(item.dataset.borderColor || '#000') });

        const name = document.createElement('span');
        name.textContent = String(item.dataset.label || '');
        Object.assign(name.style, { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: '1 1 auto' });

        const value = document.createElement('span');
        value.textContent = String(Number(item.parsed?.y || 0));
        Object.assign(value.style, { whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' });

        row.appendChild(colorDot);
        row.appendChild(name);
        row.appendChild(value);
        tooltipEl.appendChild(row);
    });

    const { offsetLeft, offsetTop } = chart.canvas;
    tooltipEl.style.opacity = '1';
    tooltipEl.style.left = `${offsetLeft + tooltip.caretX}px`;
    tooltipEl.style.top = `${offsetTop + tooltip.caretY}px`;
}

// 对选中武器在多个距离上运行随机护甲模拟，渲染为按距离的击杀次数折线图
export async function runAndRenderRandomArmorDistance(weaponDatas, hitChance) {
    const { SimulateEngine } = await import("../core/SimulateEngine.js");

    // 为每把武器分别计算自己的 baseDistances 与 samplePoints（避免不同武器共享采样点）
    // dataset per weapon name (收集在不同距离的击杀次数)
    const datasetsMap = new Map();

    // 为每把武器创建任务，使用受限并发运行 Worker 池来控制同时运行的线程数量
    const tasks = [];

    for (const weaponData of weaponDatas) {
        // 计算该武器的 base distances
        let baseDistances = Array.isArray(weaponData.range) ? weaponData.range.map(Number).filter(d => Number.isFinite(d)).sort((a, b) => a - b) : [];
        if (baseDistances.length === 0) baseDistances.push(Number(document.getElementById('distance')?.value || 20));
        if (!baseDistances.includes(0)) baseDistances = [0, ...baseDistances];

        // 构建该武器的采样点：每个 baseDistance 后加一个小偏移点，用于分段 (e.g., 35, 35.1).
        // 不对 0m 添加偏移，避免产生 0 -> 0.1 的小折线。
        let samplePoints = [];
        for (let i = 0; i < baseDistances.length - 1; i++) {
            const d = Number(baseDistances[i]);
            samplePoints.push(d);
            if (d > 0) {
                samplePoints.push(Number((d + 0.1).toFixed(3)));
            }
        }
        samplePoints.push(Number(baseDistances[baseDistances.length - 1]));
        if (!samplePoints.includes(100)) samplePoints.push(100);
        samplePoints = Array.from(new Set(samplePoints.map(Number))).sort((a, b) => a - b);

        // push task for this weapon
        tasks.push(async () => {
            const pointsMap = new Map();
            try {
                const workerUrl = new URL('../workers/randomArmorWorker.js', import.meta.url);
                const bulletsData = getMergedBulletsData();
                const armorPresets = LocalStorageUtil.loadArmorPresets();

                const simulateCount = DOMControl.getSimaulteCountFromUI();
                const enemyReactionAvg = DOMControl.getEnemyReactionAvgFromUI();
                const enemyReactionJitter = DOMControl.getEnemyReactionJitterFromUI();
                const partHitWeights = DOMControl.getPartHitWeightsFromUI();
                const defaultHp = DOMControl.getHealthPointFromUI();

                await new Promise((resolve, reject) => {
                    const w = new Worker(workerUrl, { type: 'module' });
                    const timeout = setTimeout(() => { try { w.terminate(); } catch (e) {} ; reject(new Error('worker timeout')); }, 5 * 60 * 1000);
                    w.onmessage = function(ev) {
                        clearTimeout(timeout);
                        const data = ev.data || {};
                        const results = Array.isArray(data.results) ? data.results : [];
                        results.forEach(r => {
                            pointsMap.set(Number(r.distance), Number(r.count));
                        });
                        try { w.terminate(); } catch (e) {}
                        resolve();
                    };
                    w.onerror = function(err) { clearTimeout(timeout); try { w.terminate(); } catch (e) {} ; reject(err); };

                    w.postMessage({
                        weaponData,
                        bulletsData,
                        armorPresets,
                        samplePoints,
                        simulateCount,
                        hitChance,
                        enemyReactionAvg,
                        enemyReactionJitter,
                        partHitWeights,
                        defaultHp
                    });
                });
            } catch (e) {
                // fallback to single-threaded simulation
                Log.log_detail('Worker 模拟失败，回退到主线程: ' + (e && e.message));
                for (let si = 0; si < samplePoints.length; si++) {
                    const distance = samplePoints[si];
                    const engine = new SimulateEngine([weaponData]);
                    const { results, simCount } = engine.runMultipleSimulationsWithRandomArmor(distance, hitChance);
                    results.forEach(r => {
                        pointsMap.set(Number(distance), Number(r.count));
                    });
                }
            }

            datasetsMap.set(weaponData.name, { label: weaponData.name, points: pointsMap, samples: samplePoints });
        });
    }

    // 并发控制：依据硬件线程数决定并发数，最少 1，最多 8
    const hw = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) ? navigator.hardwareConcurrency : 4;
    const concurrency = Math.max(1, Math.min(hw > 1 ? hw - 1 : hw, 8));

    // helper: run tasks with concurrency limit
    async function runWithConcurrency(taskFns, limit) {
        const executing = new Set();
        for (const fn of taskFns) {
            const p = fn().then(() => executing.delete(p)).catch(() => executing.delete(p));
            executing.add(p);
            if (executing.size >= limit) {
                await Promise.race(executing);
            }
        }
        await Promise.all(Array.from(executing));
    }

    await runWithConcurrency(tasks, concurrency);

    const lineColors = [
        '#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd','#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf'
    ];

    const TOP_WEAPONS_COUNT = 10;

    // 构建每条线在指定距离上的点（缺失填 0），并使用阶梯线表示每个阶段的击杀次数
    const chartDatasets = Array.from(datasetsMap.entries()).map(([name, obj], idx) => {
        const pointMap = obj.points instanceof Map ? obj.points : new Map();

        // 使用该武器的 samples 顺序构建点序列（包含 base 和 base+0.1），缺失点填 0
        const samples = Array.isArray(obj.samples) ? obj.samples : Array.from(pointMap.keys()).map(Number).sort((a, b) => a - b);
        const points = samples.map(sp => ({ x: sp, y: Number(pointMap.get(sp) || 0) }));

        const color = lineColors[idx % lineColors.length];

        // currentDistance value for sorting
        const currentDistance = Number(document.getElementById('distance')?.value || 0);
        const currentPoint = points.find(p => Number(p.x) === Number(currentDistance)) || { y: Number.MAX_SAFE_INTEGER };

        return {
            label: name,
            data: points,
            borderColor: color,
            backgroundColor: color,
            borderWidth: 2,
            pointRadius: 0,
            pointHitRadius: 8,
            pointHoverRadius: 4,
            spanGaps: true,
            stepped: false,
            tension: 0,
            currentDistanceTTK: Number(currentPoint.y || Number.MAX_SAFE_INTEGER)
        };
    })
        .sort((a, b) => a.currentDistanceTTK - b.currentDistanceTTK)
        .map((ds, index) => ({ ...ds, hidden: index >= TOP_WEAPONS_COUNT }));

    // 渲染到页面：优先插入到随机护甲柱状图之后，否则在 distanceChart 之后
    let insertAfter = document.getElementById('randomArmorBar') || document.getElementById('distanceChart');
    let container = document.getElementById('randomArmorDistance');
    if (!container) {
        container = document.createElement('div');
        container.id = 'randomArmorDistance';
        if (insertAfter && insertAfter.parentNode) {
            insertAfter.parentNode.insertBefore(container, insertAfter.nextSibling);
        } else {
            const parent = document.querySelector('.container');
            if (parent) parent.appendChild(container);
        }
    }
    container.innerHTML = '';

    const canvasId = 'randomArmorDistanceChart';
    let canvas = document.getElementById(canvasId);
    if (canvas) canvas.remove();
    canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.width = 1000;
    canvas.height = 400;
    container.appendChild(canvas);

    try {
        const ctx = canvas.getContext('2d');
        if (canvas._chartInstance) canvas._chartInstance.destroy();

        const verticalLinePlugin = {
            id: 'randomArmorVerticalLine',
            afterDraw(chart) {
                const activeElements = chart.tooltip?.getActiveElements?.() || [];
                if (activeElements.length === 0) return;
                const { ctx, chartArea: { top, bottom } } = chart;
                const x = activeElements[0].element?.x;
                if (!Number.isFinite(x)) return;
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(x, top);
                ctx.lineTo(x, bottom);
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
                ctx.stroke();
                ctx.restore();
            }
        };

        canvas._chartInstance = new Chart(ctx, {
            type: 'line',
            data: { datasets: chartDatasets },
            options: {
                responsive: true,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: {
                        type: 'linear',
                        min: 0,
                        max: 100,
                        ticks: { stepSize: 1 },
                        title: { display: true, text: '距离 (m)' }
                    },
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: '击杀次数' }
                    }
                },
                plugins: {
                    title: (() => {
                        const minReactionTime = DOMControl.getEnemyReactionAvgFromUI() - DOMControl.getEnemyReactionJitterFromUI();
                        const maxReactionTime = DOMControl.getEnemyReactionAvgFromUI() + DOMControl.getEnemyReactionJitterFromUI(); 
                        return { 
                            display: true, 
                            text: `随机护甲 敌人反应时间${minReaction}至${maxReactionTime} 击杀次数}`
                        };
                    })(),
                    legend: { position: 'bottom', labels: { usePointStyle: true } },
                    tooltip: {
                        enabled: false,
                        external: function(context) {
                            renderExternalTooltipCount(context);
                        },
                        mode: 'index',
                        intersect: false,
                        itemSort: function(a, b) { return Number(a.parsed?.y || 0) - Number(b.parsed?.y || 0); },
                        callbacks: {
                            title: function(tooltipItems) {
                                if(!tooltipItems || tooltipItems.length === 0) return '';
                                const hoveredDistance = Math.round(Number(tooltipItems[0].parsed?.x));
                                return `${hoveredDistance}m 击杀次数`;
                            },
                            label: function(context) { return String(context.dataset.label || ''); }
                        }
                    }
                }
            },
            plugins: [verticalLinePlugin]
        });
    } catch (e) {
        Log.log_detail('绘制随机护甲距离图出错: ' + e.message);
    }
}
