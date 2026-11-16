import test from 'node:test';
import assert from 'node:assert/strict';
import {createActionDispatcher} from '../src/ui/action-dispatcher.js';

test('未知动作静默返回 undefined，且不调用其他处理器',async()=>{
  let calls=0;
  const dispatch=createActionDispatcher({save:()=>{calls+=1;}});
  const button={dataset:{action:'missing'}};

  const result=await dispatch(button);

  assert.equal(result,undefined);
  assert.equal(calls,0);
});

test('动作注册表的继承属性不视为已注册动作',async()=>{
  const dispatch=createActionDispatcher({});

  assert.equal(await dispatch({dataset:{action:'toString'}}),undefined);
});

test('处理器收到包含 id 和其他 dataset 字段的原始 button 对象',async()=>{
  let received;
  const dispatch=createActionDispatcher({save:button=>{received=button;}});
  const button={id:'save-entry',dataset:{action:'save',entryId:'entry-42'}};

  await dispatch(button);

  assert.equal(received,button);
  assert.equal(received.id,'save-entry');
  assert.equal(received.dataset.entryId,'entry-42');
});

test('dispatch 等待异步处理器完成并返回其结果',async()=>{
  let finish;
  const completion=new Promise(resolve=>{finish=resolve;});
  const dispatch=createActionDispatcher({save:()=>completion});
  const button={dataset:{action:'save'}};
  let settled=false;

  const pending=dispatch(button).then(result=>{
    settled=true;
    return result;
  });
  await Promise.resolve();
  assert.equal(settled,false);

  finish('saved');
  assert.equal(await pending,'saved');
  assert.equal(settled,true);
});

test('两个动作可共用同一处理器并分别正确路由',async()=>{
  const received=[];
  const shared=button=>{
    received.push(button);
    return `handled:${button.id}`;
  };
  const dispatch=createActionDispatcher({save:shared,submit:shared});
  const saveButton={id:'save',dataset:{action:'save'}};
  const submitButton={id:'submit',dataset:{action:'submit'}};

  assert.equal(await dispatch(saveButton),'handled:save');
  assert.equal(await dispatch(submitButton),'handled:submit');
  assert.deepEqual(received,[saveButton,submitButton]);
});

test('处理器异常原样向调用方传播',async()=>{
  const failure=new Error('save failed');
  const dispatch=createActionDispatcher({save:async()=>{throw failure;}});

  await assert.rejects(
    dispatch({dataset:{action:'save'}}),
    error=>error===failure
  );
});
