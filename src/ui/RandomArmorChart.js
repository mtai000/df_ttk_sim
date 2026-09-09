import { Chart } from "chart.js/auto";
import { Log } from "../utils/Log.js";

export function renderRandomArmorChart(results, simCount) {
    let container = document.getElementById('randomArmorResults');
    if (!container) {
        container = document.createElement('div');
        container.id = 'randomArmorResults';
        const parent = document.querySelector('.container');
        if (parent) parent.appendChild(container);
    }
    container.innerHTML = '';

    // 在 distanceChart 之后插入柱状图 canvas
    let distanceCanvas = document.getElementById('distanceChart');
    let barCanvas = document.getElementById('randomArmorBar');
    if (barCanvas) barCanvas.remove();
    barCanvas = document.createElement('canvas');
    barCanvas.id = 'randomArmorBar';
    barCanvas.width = 800;
    barCanvas.height = 300;

    if (distanceCanvas && distanceCanvas.parentNode) {
        distanceCanvas.parentNode.insertBefore(barCanvas, distanceCanvas.nextSibling);
    } else {
        container.appendChild(barCanvas);
    }

    try {
        const labels = results.map(r => r.name);
        const data = results.map(r => r.count);
        if (Chart) {
            const ctx = barCanvas.getContext('2d');
            if (barCanvas._chartInstance) barCanvas._chartInstance.destroy();
            barCanvas._chartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: '击杀次数',
                        data,
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false },
                        title: { display: true, text: '随机护甲 - 击杀次数' }
                    },
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: '击杀次数' } },
                        x: { title: { display: true, text: '武器' } }
                    }
                }
            });
        } else {
            const table = document.createElement('table');
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            table.innerHTML = `<thead><tr><th>武器</th><th>击杀次数</th><th>击杀率</th></tr></thead>`;
            const tbody = document.createElement('tbody');
            results.forEach(r => {
                const tr = document.createElement('tr');
                const nameTd = document.createElement('td');
                nameTd.textContent = r.name;
                const countTd = document.createElement('td');
                countTd.textContent = String(r.count);
                const rateTd = document.createElement('td');
                rateTd.textContent = `${((r.count / simCount) * 100).toFixed(2)}%`;
                tr.appendChild(nameTd);
                tr.appendChild(countTd);
                tr.appendChild(rateTd);
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            container.appendChild(table);
        }
    } catch (e) {
        Log.log_detail('绘制随机护甲柱状图时出错: ' + e.message);
    }
}

export async function runAndRenderRandomArmor(weaponDatas, distance, hitChance) {
    const { SimulateEngine } = await import("../core/SimulateEngine.js");
    const engine = new SimulateEngine(weaponDatas);
    const { results, simCount } = engine.runMultipleSimulationsWithRandomArmor(distance, hitChance);
    renderRandomArmorChart(results, simCount);
}
