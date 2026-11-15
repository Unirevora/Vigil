import {DATA_KEY,PREVIOUS_PROTOTYPE_KEY,validateDataset,makeDataset} from './schema.js';
import {createDemoEntries} from '../data/demo.js';

// All localStorage access goes through this repository.
// The previous single-file prototype key is copied once, never removed.
export class LocalEntryRepository {
  constructor(storage=globalThis.localStorage) {
    this.storage=storage;
    this.readOnly=false;
  }
  load() {
    try {
      const current=this.storage.getItem(DATA_KEY);
      if(current!==null) {
        const entries=validateDataset(JSON.parse(current));
        return {entries,migrated:false,demo:false,error:null};
      }

      const old=this.storage.getItem(PREVIOUS_PROTOTYPE_KEY);
      if(old!==null) {
        const entries=validateDataset(JSON.parse(old));
        this.save(entries);
        return {entries,migrated:true,demo:false,error:null};
      }

      // First run: demo notes make the prototype easy to explore.
      const entries=createDemoEntries();
      this.save(entries);
      return {entries,migrated:false,demo:true,error:null};
    } catch(error) {
      this.readOnly=true;
      return {
        entries:[],migrated:false,demo:false,
        error:`无法安全读取手记库（${error?.message||'未知错误'}）。为防止覆盖，已进入只读保护。`
      };
    }
  }
  save(entries) {
    if(this.readOnly) throw new Error('存储已处于只读保护状态。');
    // Validate before changing the persisted dataset.
    const valid=validateDataset(makeDataset(entries));
    this.storage.setItem(DATA_KEY,JSON.stringify(makeDataset(valid)));
    return valid;
  }
}
