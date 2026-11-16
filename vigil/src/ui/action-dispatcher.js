export function createActionDispatcher(actions){
  return async button=>{
    const action=button.dataset.action;
    if(!Object.hasOwn(actions,action))return undefined;
    const handler=actions[action];
    if(typeof handler!=='function')return undefined;
    return handler(button);
  };
}
