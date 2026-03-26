import {Log} from "./Log";


export default class SimulateShot {
    static calculateAutoTtkByBtk(weaponData, btk, triggerDelay, flyDelay){
        const rof = Number(weaponData.rof) || 0;
        if(rof <= 0){
            console.error('射速数据异常');
        }

        const btkValue = Math.max(1, Number(btk) || 1);
        return (btkValue - 1) * 60000 / rof + triggerDelay + flyDelay;
    }

    static calculateBurstTtkByBtk(weaponData, btk, triggerDelay, flyDelay){
        const burstCount = Number(weaponData.burstCount) || 0;
        const burstInterval = Number(weaponData.burstInterval) || 0;
        const burstRof = Number(weaponData.burstRateOfFire) || 0;
        if(burstCount <= 0 || burstRof <= 0){
            return triggerDelay + flyDelay;
        }

        const shotInterval = 60000 / burstRof;
        const btkValue = Number(btk) || 1;
        const fullBurstCount = Math.floor((btkValue - 1) / burstCount);
        const intraBurstShots = (btkValue - 1) % burstCount;

        return fullBurstCount * burstInterval
            + (fullBurstCount * (burstCount - 1) + intraBurstShots) * shotInterval + triggerDelay + flyDelay;
    }

    static calculateTtkByBtk(weaponData, btk, triggerDelay, flyDelay){
        if(weaponData.isBurst){
            return SimulateShot.calculateBurstTtkByBtk(weaponData, btk, triggerDelay, flyDelay);
        }

        return SimulateShot.calculateAutoTtkByBtk(weaponData, btk, triggerDelay, flyDelay);
    }

    static addSimulateShotCount(chartClass,weaponData,shotStats,distance){
        const btk = Number(shotStats.shotCount);
        if(!chartClass.resultsMap.has(weaponData.name)){
            chartClass.resultsMap.set(weaponData.name, new Map());
        }  
        if(!chartClass.resultsMap.get(weaponData.name).has(weaponData)){
            chartClass.resultsMap.get(weaponData.name).set(weaponData, { weaponData });
        }
        if(!chartClass.resultsMap.get(weaponData.name).has(distance)){
            chartClass.resultsMap.get(weaponData.name).set(distance, { btkDistribution: new Map() });
        }
        const btkDistribution = chartClass.resultsMap.get(weaponData.name).get(distance).btkDistribution;
        btkDistribution.set(btk, (btkDistribution.get(btk) || 0) + 1);
    }
}