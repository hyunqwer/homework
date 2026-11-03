// Revision checks prevent an older device from silently overwriting newer work.
export class PlannerSync {
  constructor({write, apply, status, checkpoint}) {
    Object.assign(this,{write,apply,status,checkpoint});
    this.revision=null;this.pending=null;this.remote=null;this.busy=false;this.blocked=false;this.closed=false;
  }
  restore(saved) {if(saved){this.revision=saved.revision;this.pending=saved.payload;}}
  receive(remote) {
    if(this.closed)return;
    this.remote=remote;
    if(this.busy)return;
    const revision=remote?.revision||0;
    if(this.pending!==null){
      if(this.revision!==revision){this.blocked=true;this.status('conflict');return;}
      void this.flush();return;
    }
    if(this.revision!==null&&revision<this.revision)return;
    this.revision=revision;
    if(remote){this.apply(remote.payload);this.status('synced');}else this.status('empty');
  }
  save(payload) {
    if(this.closed)return;
    this.pending=payload;this.keep();
    if(this.revision===null||this.blocked)return;
    void this.flush();
  }
  keep(){this.checkpoint(this.pending===null?null:{revision:this.revision,payload:this.pending});}
  async flush(){
    if(this.busy||this.blocked||this.closed||this.pending===null||this.revision===null)return;
    this.busy=true;this.status('saving');
    const payload=this.pending,base=this.revision;
    try{
      const revision=await this.write(payload,base);
      if(this.closed)return;
      this.revision=revision;
      if(this.pending===payload){this.pending=null;this.apply(payload);}
      this.keep();
    }catch(e){
      if(this.closed)return;
      if(e.code==='planner/conflict'){this.blocked=true;this.status('conflict');}
      else{this.blocked=true;this.status('error',e);}
    }finally{
      this.busy=false;
      if(!this.closed&&!this.blocked){
        if(this.pending!==null)void this.flush();
        else if(this.remote?.revision>this.revision)this.receive(this.remote);
        else this.status('synced');
      }
    }
  }
  useRemote(){
    if(this.busy||this.closed||!this.remote)return false;
    this.pending=null;this.blocked=false;this.keep();this.receive(this.remote);return true;
  }
  retry(remote){if(this.closed)return;this.blocked=false;this.receive(remote);}
  close(){this.closed=true;}
}
