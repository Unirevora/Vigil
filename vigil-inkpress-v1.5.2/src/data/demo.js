import {dayOffset} from '../core/format.js';

// Delete demo entries without touching notes the user edited or created.
export function createDemoEntries() {
  const now = new Date().toISOString();
  return [
    {id:'demo-first',title:'把晚风写进今天',date:dayOffset(0),content:'今天傍晚，天色像一张被轻轻晕开的宣纸。\n\n路过街角的时候，晚风吹动树梢，忽然觉得有些日子不必发生什么特别的事，也值得被认真记下。\n\n> 好的生活，有时只是一场不慌不忙的散步。\n\n想把这一点安静，留给未来的自己。',createdAt:now,updatedAt:now,demo:true},
    {id:'demo-second',title:'在雨声里读一本旧书',date:dayOffset(2),content:'## 午后的雨\n\n窗外下了很久的雨。泡了一壶茶，读完了上周没读完的那本书。\n\n- 记住喜欢的段落\n- 不急着完成所有计划\n- 给自己一点缓慢的时间\n\n**阅读也是一种远行。**',createdAt:now,updatedAt:now,demo:true},
    {id:'demo-third',title:'周末的河岸',date:dayOffset(7),content:'沿着河走了很远，水面上有一点碎金色的光。\n\n听见远处有人说笑，也听见自己的脚步声。秋天好像不声不响地来了。\n\n留下些什么？就从这一行字开始。',createdAt:now,updatedAt:now,demo:true},
    {id:'demo-fourth',title:'给下个月的自己',date:dayOffset(15),content:'想试着把日子过得简单一些。\n\n**三件小事：**\n\n1. 每周认真写一篇手记\n2. 多去阳光下走走\n3. 留一点不被安排的时间\n\n希望回看时，会喜欢现在的自己。',createdAt:now,updatedAt:now,demo:true}
  ];
}
