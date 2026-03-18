import { Chart } from "chart.js/auto";
import { Log } from "../utils/Log";
import { ConstConfig } from "../data/ConstConfig";

export class TTKChart{
    static resultsMap = new Map();
    static chartInstance = null;
    static showResultsInChart(){
        let distance = 0;
        
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
            if(distance === 0 && value.distance !== undefined){
                distance = value.distance;
            }
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
                                const totalCount = Number(ConstConfig.SIMULATE_COUNT) || 1;
                                const distributionMap = weaponStats.btkDistribution;
                                if(!distributionMap || distributionMap.size === 0){
                                    return ['---- BTK 概率分布 ----', '无数据'];
                                }

                                const sortedDistribution = Array.from(distributionMap.entries())
                                    .sort((a, b) => Number(a[0]) - Number(b[0]));

                                const distributionLines = sortedDistribution.map(([btk, count]) => {
                                    const probability = count / totalCount * 100;
                                    return `BTK ${btk}: ${formatNumber(probability, 1)}%  \t\t (${count}/${totalCount}),  \t\t
                                            ttk:${((btk-1) / weaponStats.weaponData.rof * 60 * 1000 + distance/Number(weaponStats.weaponData.velocity)*1000 + Number(weaponStats.weaponData.triggerDelay)).toFixed(0)}ms`;
                                });

                                return [
                                    '---- BTK 概率分布 ----',
                                    `使用子弹: ${weaponStats.weaponData.currentAmmoType}  ttk考虑扳机和飞行时间`,
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

    static addSimulateShotCount(weaponData,shots,hit,distance,btk){
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
        //统计概率分布情况，以便分析各btk的概率
        //定义个map， btk为key，统中该btk的出现次数
        if(!stats.btkDistribution){
            stats.btkDistribution = new Map();
        }
        const btkValue = Number.isFinite(Number(btk)) ? Number(btk) : Number(shots);
        const currentCount = stats.btkDistribution.get(btkValue) || 0;
        stats.btkDistribution.set(btkValue, currentCount + 1);
    }

    static showResultMap(){
        Log.log(this.resultsMap);
    }

    static clear(){
        TTKChart.resultsMap.clear();
    }
}