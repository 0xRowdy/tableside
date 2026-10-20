import { runnerInfo } from './index';

const info = runnerInfo();
console.log(`Tableside runner: engine ${info.engine}, definitions ${info.definitions}, Node ${info.node}`);
