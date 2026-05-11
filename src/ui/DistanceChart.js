import { Log } from "../utils/Log";
import { Chart } from "chart.js/auto";
import { ConstConfig } from "../data/ConstConfig";
import SimulateShot from "../utils/SimulateShot";
import { DOMControl } from "../data/DomControl";

const TOP_WEAPONS_COUNT = 10;

const verticalLinePlugin = {
    id: 'verticalLinePlugin',
    afterDraw(chart) {
        const activeElements = chart.tooltip?.getActiveElements?.() || [];
        if(activeElements.length === 0){
            return;
        }

        const {ctx, chartArea: {top, bottom}} = chart;
        const x = activeElements[0].element?.x;
        if(!Number.isFinite(x)){
            return;
        }

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

export class DistanceChart{
    static resultsMap = new Map();
    static chartInstance = null;
    
    static clear(){
        DistanceChart.resultsMap.clear();
    }

    static formatMs(value){
        return `${Number(value).toFixed(0)} ms`;
    }

    static formatMsFixed(value){
        return `${Number(value).toFixed(2)} ms`;
    }

    static getOrCreateTooltip(chart){
        const parent = chart.canvas.parentNode;
        if(!parent){
            return null;
        }

        if(getComputedStyle(parent).position === 'static'){
            parent.style.position = 'relative';
        }

        let tooltipEl = parent.querySelector('.distance-chart-tooltip');
        if(tooltipEl){
            return tooltipEl;
        }

        tooltipEl = document.createElement('div');
        tooltipEl.className = 'distance-chart-tooltip';
        Object.assign(tooltipEl.style, {
            position: 'absolute',
            pointerEvents: 'none',
            background: 'rgba(255, 255, 255, 0.96)',
            border: '1px solid rgba(0, 0, 0, 0.12)',
            borderRadius: '8px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12)',
            color: '#222',
            minWidth: '220px',
            padding: '10px 14px',
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

    static renderExternalTooltip(context){
        const {chart, tooltip} = context;
        const tooltipEl = DistanceChart.getOrCreateTooltip(chart);
        if(!tooltipEl){
            return;
        }

        if(tooltip.opacity === 0){
            tooltipEl.style.opacity = '0';
            return;
        }

        tooltipEl.replaceChildren();

        const title = document.createElement('div');
        title.textContent = tooltip.title?.[0] || '';
        Object.assign(title.style, {
            fontWeight: '600',
            marginBottom: '8px'
        });
        tooltipEl.appendChild(title);

        const items = tooltip.dataPoints || [];
        items.forEach((item, index) => {
            const row = document.createElement('div');
            Object.assign(row.style, {
                display: 'grid',
                gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: '8px',
                marginTop: index === 0 ? '0' : '4px'
            });

            const colorDot = document.createElement('span');
            Object.assign(colorDot.style, {
                width: '8px',
                height: '8px',
                borderRadius: '999px',
                background: String(item.dataset.borderColor || '#000'),
                flex: '0 0 auto'
            });

            const name = document.createElement('span');
            name.textContent = `${index + 1}. ${String(item.dataset.label || '')}`;
            Object.assign(name.style, {
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: '0',
                flex: '1 1 auto'
            });

            const totalTtk = document.createElement('span');
            totalTtk.textContent = DistanceChart.formatMsFixed(item.parsed?.y || 0);
            Object.assign(totalTtk.style, {
                whiteSpace: 'nowrap',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums'
            });

            row.appendChild(colorDot);
            row.appendChild(name);
            row.appendChild(totalTtk);
            tooltipEl.appendChild(row);
        });

        const {offsetLeft, offsetTop} = chart.canvas;
        tooltipEl.style.opacity = '1';
        tooltipEl.style.left = `${offsetLeft + tooltip.caretX}px`;
        tooltipEl.style.top = `${offsetTop + tooltip.caretY}px`;
    }

    static showResultsInDistanceChart(){

        Log.log('显示结果');
        Log.log(this.resultsMap);
        const canvas = document.getElementById('distanceChart');
        if(!canvas){
            console.error('未找到画布');
            return;
        }
        //清理画布上的旧图表数据
        if(this.chartInstance){
            this.chartInstance.destroy();
            this.chartInstance = null;
        }

        const selectedDistance = Number(DOMControl.getDistanceFromUI());

        //读取结构：weaponName -> subMap，其中 subMap 的键是 distance，值是 { btkDistribution }
        const weaponLines = new Map();

        this.resultsMap.forEach((weaponSubMap, weaponName) =>{
            if(!(weaponSubMap instanceof Map) || weaponSubMap.size === 0){
                return;
            }

            let weaponData = null;
            weaponSubMap.forEach((entry) => {
                if(entry && entry.weaponData){
                    weaponData = entry.weaponData;
                }
            });

            if(!weaponData){
                return;
            }

            weaponSubMap.forEach((entry, key) => {
                const distance = Number(key);
                if(!Number.isFinite(distance)){
                    return;
                }

                const btkDistribution = entry && entry.btkDistribution;
                if(!(btkDistribution instanceof Map) || btkDistribution.size === 0){
                    return;
                }

                const triggerDelay = Number(weaponData.triggerDelay || 0);
                const velocity = Number(weaponData.velocity || 0);
                const flyDelay = velocity > 0 ? Number(distance) / velocity * 1000 : 0;
                const simCount = Array.from(btkDistribution.values()).reduce((sum, count) => sum + count, 0)
                    || DOMControl.getSimaulteCountFromUI();

                let btkTtk = 0;
                if(weaponData.isBurst){
                    let btkTtkSum = 0;
                    btkDistribution.forEach((count, btk) => {
                        btkTtkSum += SimulateShot.calculateBurstTtkByBtk(weaponData, btk, 0, 0) * count;
                    });
                    btkTtk = btkTtkSum / simCount;
                } else {
                    let totalBtk = 0;
                    btkDistribution.forEach((count, btk) => {
                        totalBtk += Number(btk) * count;
                    });
                    btkTtk = SimulateShot.calculateAutoTtkByBtk(weaponData, totalBtk / simCount, 0, 0);
                }

                const totalTTK = btkTtk + triggerDelay + flyDelay;

                if(!weaponLines.has(weaponName)){
                    weaponLines.set(weaponName, []);
                }

                weaponLines.get(weaponName).push({
                    x: distance,
                    y: totalTTK,
                    btkTtk,
                    triggerDelay,
                    flyDelay
                });
            });
        });

        const lineColors = [
            '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f',
            '#bcbd22', '#17becf', '#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33',
            '#a65628', '#f781bf', '#999999', '#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854',
            '#ffd92f', '#e5c494', '#b3b3b3', '#6a3d9a', '#cab2d6', '#ffed6f', '#b2df8a', '#1b9e77'
        ];

        const chartData = {
            datasets: Array.from(weaponLines.entries())
                .map(([weaponName, points], index) => {
                    const color = lineColors[index % lineColors.length];
                    const sortedPoints = [...points].sort((a, b) => a.x - b.x);

                    //让每条线从 0 米开始绘制，0 米点使用最近距离的BTK构成并将飞行延时置为0
                    if(sortedPoints.length > 0 && sortedPoints[0].x > 0){
                        const firstPoint = sortedPoints[0];
                        sortedPoints.unshift({
                            x: 0,
                            y: firstPoint.btkTtk + firstPoint.triggerDelay,
                            btkTtk: firstPoint.btkTtk,
                            triggerDelay: firstPoint.triggerDelay,
                            flyDelay: 0
                        });
                    }

                    //将每条线补全为 0-100 每一米一个点，保证任意米数悬停都可查看排名
                    const densePoints = [];
                    for(let meter = 0; meter <= 100; meter++){
                        densePoints.push(DistanceChart.interpolatePointByMeter(sortedPoints, meter));
                    }

                    const currentDistancePoint = DistanceChart.interpolatePointByMeter(
                        sortedPoints,
                        Number.isFinite(selectedDistance) ? selectedDistance : 0
                    );

                    return {
                        label: weaponName,
                        data: densePoints,
                        currentDistanceTTK: Number(currentDistancePoint?.y || Number.MAX_SAFE_INTEGER),
                        borderColor: color,
                        backgroundColor: color,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHitRadius: 8,
                        pointHoverRadius: 4,
                        spanGaps: true,
                        tension: 0.2
                    };
                })
                .sort((a, b) => a.currentDistanceTTK - b.currentDistanceTTK)
                .map((dataset, index) => ({
                    ...dataset,
                    hidden: index >= TOP_WEAPONS_COUNT
                }))
        };

        //生成图表
        this.chartInstance = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: chartData,
            options: {
                responsive: true,
                hover: {
                    mode: 'index',
                    intersect: false
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        type: 'linear',
                        min: 0,
                        max: 100,
                        ticks: {
                            stepSize: 1
                        },
                        title: {
                            display: true,
                            text: '距离 (m)'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return DistanceChart.formatMs(value);
                            }
                        },
                        title: {
                            display: true,
                            text: 'TTK (ms)'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: '0-100米不同武器 TTK 折线图'
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        enabled: false,
                        external: function(context) {
                            DistanceChart.renderExternalTooltip(context);
                        },
                        mode: 'index',
                        intersect: false,
                        itemSort: function(a, b) {
                            return Number(a.parsed?.y || 0) - Number(b.parsed?.y || 0);
                        },
                        callbacks: {
                            title: function(tooltipItems) {
                                if(!tooltipItems || tooltipItems.length === 0){
                                    return '';
                                }
                                const hoveredDistance = Math.round(Number(tooltipItems[0].parsed?.x));
                                return `${hoveredDistance}m TTK 排名`;
                            },
                            label: function(context) {
                                return String(context.dataset.label || '');
                            }
                        }
                    }
                }
            },
            plugins: [verticalLinePlugin]
        });
    }

    static interpolatePointByMeter(sortedPoints, meter){
        if(!Array.isArray(sortedPoints) || sortedPoints.length === 0){
            return {x: meter, y: 0, btkTtk: 0, triggerDelay: 0, flyDelay: 0};
        }

        if(meter <= Number(sortedPoints[0].x)){
            const p = sortedPoints[0];
            return {
                x: meter,
                y: Number(p.y),
                btkTtk: Number(p.btkTtk || 0),
                triggerDelay: Number(p.triggerDelay || 0),
                flyDelay: Number(p.flyDelay || 0)
            };
        }

        const lastPoint = sortedPoints[sortedPoints.length - 1];
        if(meter >= Number(lastPoint.x)){
            return {
                x: meter,
                y: Number(lastPoint.y),
                btkTtk: Number(lastPoint.btkTtk || 0),
                triggerDelay: Number(lastPoint.triggerDelay || 0),
                flyDelay: Number(lastPoint.flyDelay || 0)
            };
        }

        for(let i = 0; i < sortedPoints.length - 1; i++){
            const left = sortedPoints[i];
            const right = sortedPoints[i + 1];
            const leftX = Number(left.x);
            const rightX = Number(right.x);

            if(meter < leftX || meter > rightX){
                continue;
            }

            const ratio = rightX === leftX ? 0 : (rightX - meter) / (rightX - leftX);
            const lerp = (a, b) => Number(b) - (Number(b) - Number(a)) * ratio;

            return {
                x: meter,
                y: lerp(right.y - right.flyDelay + left.flyDelay, right.y),
                btkTtk: lerp(left.btkTtk || 0, right.btkTtk || 0),
                triggerDelay: lerp(left.triggerDelay || 0, right.triggerDelay || 0),
                flyDelay: lerp(left.flyDelay || 0, right.flyDelay || 0)
            };
        }

        return {
            x: meter,
            y: Number(lastPoint.y),
            btkTtk: Number(lastPoint.btkTtk || 0),
            triggerDelay: Number(lastPoint.triggerDelay || 0),
            flyDelay: Number(lastPoint.flyDelay || 0)
        };
    }
}