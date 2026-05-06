import { ConstConfig } from "../data/ConstConfig.js";
import { DOMControl } from "../data/DomControl.js";

export class Log{
    static detailLogBuffer = [];

    constructor(){

    }

    static startDetailLogSession() {
        if (ConstConfig.LOG_LEVEL >= 2) {
            this.detailLogBuffer = [];
        }
    }

    static formatLogArg(arg) {
        if (typeof arg === 'string') {
            return arg;
        }
        if (arg instanceof Error) {
            return `${arg.name}: ${arg.message}`;
        }
        try {
            return JSON.stringify(arg);
        } catch {
            return String(arg);
        }
    }

    static appendDetailLog(args) {
        if (ConstConfig.LOG_LEVEL < 2) {
            return;
        }
        const timestamp = new Date().toISOString();
        const message = args.map((arg) => this.formatLogArg(arg)).join(' ');
        this.detailLogBuffer.push(`[${timestamp}] ${message}`);
    }

    static saveDetailLogToTempFile() {
        if (ConstConfig.LOG_LEVEL < 2 || this.detailLogBuffer.length === 0 || !DOMControl.getIsPrintLogFromUI()) {
            return;
        }
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return;
        }
        console.log('正在准备保存日志...',this.detailLogBuffer.length);
        const content = this.detailLogBuffer.join('\n');
        console.log('正在保存日志到文件...');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const filenameTime = new Date().toISOString().replace(/[:.]/g, '-');

        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `df_ttk_sim_debug_${filenameTime}.log`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }


    static log(...args){
        if(ConstConfig.LOG_LEVEL >= 1) console.log(...args);
    }

    static log_detail(...args){
        this.appendDetailLog(args);
        if(ConstConfig.LOG_LEVEL > 2) console.log(...args);
    }
}