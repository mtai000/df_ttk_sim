import { ConstConfig } from "../data/ConstConfig.js";

export class Log{
    constructor(){

    }

    static log(...args){
        if(ConstConfig.LOG_LEVEL >= 1) console.log(...args);
    }

    static log_detail(...args){
        if(ConstConfig.LOG_LEVEL >= 2) console.log(...args);
    }
}