import { Chart } from "chart.js/auto";
import { Log } from "../utils/Log";
import { ConstConfig } from "../data/ConstConfig";
import SimulateShot from "../utils/SimulateShot";

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
        //读取结构：weaponName -> subMap，其中 subMap 的键是 distance，值是 { btkDistribution }
        const normalizedEntries = [];

        this.resultsMap.forEach((weaponSubMap, weaponName) => {
            if(!(weaponSubMap instanceof Map) || weaponSubMap.size === 0){
                return;
            }

            let weaponData = null;
            let distance = 0;
            let distributionMap = null;

            weaponSubMap.forEach((entry, key) => {
                if(entry && entry.weaponData){
                    weaponData = entry.weaponData;
                    return;
                }

                const numericDistance = Number(key);
                if(Number.isFinite(numericDistance) && entry && entry.btkDistribution instanceof Map){
                    distance = numericDistance;
                    distributionMap = entry.btkDistribution;
                }
            });

            if(!weaponData || !distributionMap || distributionMap.size === 0){
                return;
            }

            const totalCount = Array.from(distributionMap.values()).reduce((sum, count) => sum + count, 0) || ConstConfig.SIMULATE_COUNT;
            let totalBtk = 0;
            distributionMap.forEach((count, btk) => {
                totalBtk += Number(btk) * count;
            });

            const triggerDelay = Number(weaponData.triggerDelay || 0);
            const velocity = Number(weaponData.velocity || 0);
            const flyDelay = velocity > 0 ? Number(distance) / velocity * 1000 : 0;

            let totalTTK = 0;
            let burstIntervalTime = 0;
            if(weaponData.isBurst){
                let totalTtkSum = 0;
                let burstIntervalSum = 0;
                distributionMap.forEach((count, btk) => {
                    totalTtkSum += SimulateShot.calculateBurstTtkByBtk(weaponData, btk, triggerDelay, flyDelay) * count;
                    burstIntervalSum += SimulateShot.calculateBurstIntervalTimeByBtk(weaponData, btk) * count;
                });
                totalTTK = totalTtkSum / totalCount;
                burstIntervalTime = burstIntervalSum / totalCount;
            } else {
                totalTTK = SimulateShot.calculateAutoTtkByBtk(weaponData, totalBtk / totalCount, triggerDelay, flyDelay);
            }

            normalizedEntries.push([
                weaponName,
                {
                    weaponData,
                    distance,
                    btkDistribution: distributionMap,
                    total: totalBtk,
                    totalCount,
                    triggerDelay,
                    flyDelay,
                    totalTTK,
                    firingTTK: Math.max(0, totalTTK - triggerDelay - flyDelay),
                    burstIntervalTime
                }
            ]);
        });
        Log.log('normalizedEntries', normalizedEntries);

        const sortedEntries = normalizedEntries.sort((a, b) => a[1].totalTTK + a[1].burstIntervalTime - b[1].totalTTK - b[1].burstIntervalTime);
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
                    label: '射击',
                    data: sortedEntries.map(([, value]) => value.firingTTK - value.burstIntervalTime),
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                },
                {
                    label: 'burst间隔',
                    data: sortedEntries.map(([, value]) => value.burstIntervalTime),
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
                                const totalCount = Number(weaponStats.totalCount) || 1;
                                const distributionMap = weaponStats.btkDistribution;
                                if(!distributionMap || distributionMap.size === 0){
                                    return ['---- BTK 概率分布 ----', '无数据'];
                                }

                                const sortedDistribution = Array.from(distributionMap.entries())
                                    .sort((a, b) => Number(a[0]) - Number(b[0]));

                                const distributionLines = sortedDistribution.map(([btk, count]) => {
                                    const probability = count / totalCount * 100;
                                    const ttk = SimulateShot.calculateTtkByBtk(
                                        weaponStats.weaponData,
                                        btk,
                                        weaponStats.triggerDelay,
                                        weaponStats.flyDelay
                                    );
                                    return `BTK ${btk}: ${formatNumber(probability, 1)}% (${count}/${totalCount}), TTK: ${formatNumber(ttk, 0)}ms`;
                                });

                                return [
                                    '---- BTK 概率分布 ----',
                                    `使用子弹: ${weaponStats.weaponData.currentAmmoType}  平均btk: ${(weaponStats.total / totalCount).toFixed(2)}`,
                                    `扳机延时: ${formatNumber(weaponStats.triggerDelay, 0)}ms 飞行延时: ${formatNumber(weaponStats.flyDelay, 0)}ms`,
                                    ...distributionLines
                                ];
                            }
                        }
                    }
                }
            }
        };
        this.chartInstance = new Chart(canvas, config);  
    }


    static clear(){
        TTKChart.resultsMap.clear();
    }
}