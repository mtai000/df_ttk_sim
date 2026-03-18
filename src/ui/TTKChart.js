import { Chart } from "chart.js/auto";
import { Log } from "../utils/Log";
import { ConstConfig } from "../data/ConstConfig";

export class TTKChart{
    static resultsMap = new Map();
    static chartInstance = null;
    static showResultsInChart(){
        
        console.log('显示结果');
        const canvas = document.getElementById('ttkChart');
        if(!canvas){
            console.error('未找到画布');
            return;
        }
        //清理画布上的旧图表数据
        if(this.chartInstance){
            this.chartInstance.destroy();
            this.chartInstance = null;
        }
        //计算各把枪的ttk情况，然后显示在图表上命中为蓝色，未命中为红色,扳机延时为橙色，飞行时间为绿色
        this.resultsMap.forEach((value,key) =>{
            //根据value中weaponData,以及total和hit,计算武器的ttk,子弹飞行时间如果考虑扳机延时，只加上延时
            const hitTTK = (value.hit / ConstConfig.SIMULATE_COUNT - 1) / value.weaponData.rof * 60 * 1000;
            const missTTK = (value.total - value.hit) / ConstConfig.SIMULATE_COUNT / value.weaponData.rof * 60 * 1000;
            value.hitTTK = hitTTK;
            value.missTTK = missTTK;
            value.triggerDelay = Number(value.weaponData.triggerDelay || 0);
            value.flyDelay = Number(value.distance / value.weaponData.velocity * 1000);
            value.totalTTK = hitTTK + missTTK + value.triggerDelay + value.flyDelay;
        });
        
        const sortedEntries = Array.from(this.resultsMap.entries()).sort((a, b) => a[1].totalTTK - b[1].totalTTK);
        const formatNumber = (value, fractionDigits = 2) => {
            const numericValue = Number(value);
            if(!Number.isFinite(numericValue)){
                return '-';
            }
            return numericValue.toFixed(fractionDigits);
        };

        const chartData = {
            labels: sortedEntries.map(([key]) => key),
            datasets: [
                {
                    label: '命中',
                    data: sortedEntries.map(([, value]) => value.hitTTK),
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                },
                {
                    label: '未命中',
                    data: sortedEntries.map(([, value]) => value.missTTK),
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                },
                {
                    label: '扳机',
                    data: sortedEntries.map(([, value]) => value.triggerDelay),
                    backgroundColor: 'rgba(255, 159, 64, 0.5)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 1
                },
                {
                    label: '飞行',
                    data: sortedEntries.map(([, value]) => value.flyDelay),
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }
            ]
        };
        const config = {
            type: 'bar',
            data: chartData,
            options: {
                responsive: true,
                scales: {
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'TTK (ms)'
                        }
                    },
                    x: {
                        stacked: true,
                        title: {
                            display: true,
                            text: '武器'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    title: {
                        display: true,
                        text: '武器 TTK 对比'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed?.y ?? context.raw;
                                return `${context.dataset.label}: ${formatNumber(value, 0)}ms`;
                            },
                            afterBody: function(tooltipItems) {
                                if(!tooltipItems || tooltipItems.length === 0){
                                    return [];
                                }

                                const index = tooltipItems[0].dataIndex;
                                const entry = sortedEntries[index];
                                if(!entry){
                                    return [];
                                }

                                const weaponStats = entry[1];
                                const weaponData = weaponStats.weaponData;

                                return [
                                    '---- 武器参数 ----',
                                    `基础伤害: ${formatNumber(weaponData.baseDamage, 1)}`,
                                    `甲伤: ${formatNumber(weaponData.armorDamage, 1)}`,
                                    `射速: ${formatNumber(weaponData.rof, 0)} RPM`,
                                    `弹速: ${formatNumber(weaponData.velocity, 0)} m/s`,
                                    `扳机延时: ${formatNumber(weaponData.triggerDelay, 0)} ms`,
                                    `爆头倍率: ${formatNumber(weaponData.headMultiplier, 2)}`,
                                    `胸部倍率: ${formatNumber(weaponData.chestMultiplier, 2)}`,
                                    `腹部倍率: ${formatNumber(weaponData.abdomenMultiplier, 2)}`,
                                    `手臂倍率: ${formatNumber(weaponData.armMultiplier, 2)}`,
                                    `腿部倍率: ${formatNumber(weaponData.legMultiplier, 2)}`,
                                    `脚部倍率: ${formatNumber(weaponData.footMultiplier, 2)}`,
                                    `距离: ${formatNumber(weaponStats.distance, 1)} m`
                                ];
                            }
                        }
                    }
                }
            }
        };
        this.chartInstance = new Chart(canvas, config);  
    }

    static addSimulateShotCount(weaponData,shots,hit,distance){
        if(!this.resultsMap.has(weaponData.name)){
            this.resultsMap.set(weaponData.name,{weaponData : weaponData,total: 0, hit: 0,distance: distance})
        }  
        const stats = this.resultsMap.get(weaponData.name)
        Log.log_detail(stats)
        stats.total += shots;
        stats.hit += hit;
        if(distance !== undefined){
            stats.distance = distance;
        }
    }

    static showResultMap(){
        Log.log(this.resultsMap);
    }

    static clear(){
        TTKChart.resultsMap.clear();
    }
}