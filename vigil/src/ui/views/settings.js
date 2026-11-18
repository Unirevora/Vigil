import {icon} from '../icons.js';
import {BACKGROUND_PRESETS,COLOR_PRESETS} from '../../appearance/settings.js';
import {dataManagementPanels} from './data.js';
import {aboutPanel} from './about.js';

export const SETTINGS_TABS=[['appearance','外观'],['reading','排版'],['data','数据'],['about','关于']];
const bgClass={paper:'bg-paper',mountains:'bg-mountains',sage:'bg-sage',sea:'bg-sea',custom:'bg-custom',none:'bg-none'};
const selectOption=(value,current,name)=>`<option value="${value}" ${value===current?'selected':''}>${name}</option>`;
const rangeControl=(label,key,value,min,max,step=1,unit='',disabled=false)=>`<label class="settings-range-row" for="setting-${key}">
  <span class="settings-row-title">${label}<output id="${key}Value" for="setting-${key}">${value}${unit}</output></span>
  <input type="range" id="setting-${key}" min="${min}" max="${max}" step="${step}" value="${value}" data-setting="${key}" ${disabled?'disabled':''}/>
</label>`;
const sectionHead=(title,subtitle)=>`<header class="settings-section-heading"><h2>${title}</h2><p>${subtitle}</p></header>`;
const toggleControl=(label,description,key,checked,id)=>`<label class="settings-toggle-row" for="${id}">
  <span class="settings-control-copy"><strong>${label}</strong><small>${description}</small></span>
  <input id="${id}" type="checkbox" data-setting="${key}" ${checked?'checked':''} aria-label="${label}"/>
  <span class="settings-toggle-visual" aria-hidden="true"></span>
</label>`;
const selectControl=(label,id,key,current,options)=>`<div class="settings-inline-field"><label for="${id}">${label}</label>
  <select id="${id}" data-setting="${key}" aria-label="${label}">${options.map(([value,name])=>selectOption(value,current,name)).join('')}</select></div>`;

function appearancePanel(state){
  const a=state.appearance;
  return `<div class="settings-panel-stack">
    <section class="settings-group">
      ${sectionHead('颜色与明暗','选择纸面明暗与全站主题色。')}
      <div class="settings-tone-row"><span class="settings-row-title">纸面主题</span>
        <button type="button" class="settings-theme-switch" data-action="theme" aria-label="切换日间与夜间主题">
          ${icon(a.theme==='paper'?'sun':'moon')}<span>${a.theme==='paper'?'暖纸日间':'深墨夜间'}</span>${icon('arrow')}
        </button>
      </div>
      <div class="settings-tone-row settings-colors-row"><span class="settings-row-title">主题色</span>
        <div class="settings-color-options" role="group" aria-label="选择主题色">
          ${COLOR_PRESETS.map(p=>`<button type="button" class="color-swatch ${a.accent===p.color?'active':''}" data-action="setting-accent" data-color="${p.color}" aria-label="${p.name}主题色" title="${p.name}" aria-pressed="${a.accent===p.color}"><span class="color-dot" style="background:${p.color}">${a.accent===p.color?icon('check'):''}</span><span>${p.name}</span></button>`).join('')}
          <label class="color-swatch color-custom" title="自定义主题色"><span class="color-dot" id="accentPreview" style="background:${a.accent}"><input type="color" id="accentColor" aria-label="自定义主题色" value="${a.accent}"></span><span>自定义</span></label>
        </div>
      </div>
    </section>
    <section class="settings-group">
      ${sectionHead('背景','内置风物、纯色或自己的图片。上传内容只保存在当前设备。')}
      <div class="settings-backgrounds" role="group" aria-label="背景选择">
        ${BACKGROUND_PRESETS.map(bg=>`<button type="button" class="settings-image-choice background-option ${bgClass[bg.key]} ${a.background===bg.key?'active':''}" data-action="setting-background" data-background="${bg.key}" aria-pressed="${a.background===bg.key}"><span class="settings-choice-preview bg-preview"></span><span>${bg.name}</span></button>`).join('')}
      </div>
      <div class="settings-file-actions"><button type="button" class="settings-text-action" data-action="setting-upload" data-input="backgroundFile">${icon('image')} 上传背景图片</button><input id="backgroundFile" type="file" accept="image/*" hidden>
        <button class="settings-text-action subtle" data-action="remove-custom-background" ${a.background==='custom'?'':'disabled'}>恢复默认背景</button></div>
      <div class="settings-inline-sliders">${rangeControl('背景强度','backgroundOpacity',a.backgroundOpacity,0,85,1,'%')}</div>
    </section>
    <section class="settings-group">
      ${sectionHead('纸面与玻璃','统一调整纸面、侧栏和悬浮控件的材质。')}
      ${selectControl('侧栏配色','sidebarToneSelect','sidebarTone',a.sidebarTone,[['accent','跟随主题色'],['ink','经典墨色']])}
      <div class="settings-inline-sliders">
        ${rangeControl('纸面透光','surfaceOpacity',a.surfaceOpacity,50,100,1,'%')}
        ${rangeControl('侧栏着色浓度','sidebarGlass',a.sidebarGlass,55,96,1,'%')}
        ${rangeControl('侧栏模糊程度','sidebarBlur',a.sidebarBlur,0,36,2,'px')}
        ${rangeControl('悬浮控件浓度','glassTint',a.glassTint,28,92,1,'%')}
      </div>
      ${toggleControl('纸张纤维','保留极淡的旧纸颗粒质感。','texture',a.texture,'textureToggle')}
    </section>
    <section class="settings-group">
      ${sectionHead('首页静物','选择经典打字机，或上传自己的照片。')}
      <div class="settings-hero-row" role="group" aria-label="首页静物选择">
        <button type="button" class="settings-image-choice hero-style-choice ${a.heroMode==='original'?'active':''}" data-action="setting-hero" data-hero="original" aria-pressed="${a.heroMode==='original'}"><img class="settings-choice-preview" src="assets/typewriter-still-life.webp" alt="经典打字机静物"><span>经典文房</span></button>
        <button type="button" class="settings-image-choice hero-style-choice ${a.heroMode==='custom'?'active':''}" data-action="setting-hero" data-hero="custom" aria-pressed="${a.heroMode==='custom'}"><span class="settings-choice-preview hero-custom-frame">${icon('image')}</span><span>我的照片</span></button>
      </div>
      <div class="settings-file-actions"><button type="button" class="settings-text-action" data-action="setting-upload" data-input="heroFile">${icon('upload')} 上传静物图片</button><input id="heroFile" type="file" accept="image/*" hidden>
        <button class="settings-text-action subtle" data-action="remove-custom-hero" ${a.heroMode==='custom'?'':'disabled'}>恢复经典静物</button></div>
    </section>
    <section class="settings-group">
      ${sectionHead('光影与动效','点阵帷幕与 3D 浮动可分别开关，强度即时生效。')}
      ${selectControl('动效强度','motionModeSelect','motionMode',a.motionMode,[['standard','轻盈回弹'],['subtle','更克制'],['off','关闭动效']])}
      <div class="settings-effect">
        ${toggleControl('Spectral Drape · 点阵帷幕','随曲面流动的微光点阵背景。','spectralDrape',a.spectralDrape,'spectralDrapeToggle')}
        <div class="settings-effect-controls" id="spectralDrapeControls">
          ${rangeControl('光点强度','drapeIntensity',a.drapeIntensity,15,85,1,'%',!a.spectralDrape)}
        </div>
      </div>
      <div class="settings-effect">
        ${toggleControl('全局 3D 浮动','纸面、卡片和浮层随鼠标轻微转动；侧栏与顶栏保持静止。','floating',a.floating,'floatingToggle')}
        <div class="settings-effect-controls">${rangeControl('浮动幅度','floatingIntensity',a.floatingIntensity,0,100,1,'%',!a.floating)}</div>
      </div>
      <p class="settings-hint">系统开启「减少动态效果」或关闭动效后，帷幕保持静态、浮动停用；触屏设备保持平面。</p>
    </section>
  </div>`;
}
function readingPanel(state){
  const a=state.appearance;
  return `<div class="settings-panel-stack"><section class="settings-group">
    ${sectionHead('正文排版','同时用于写作、阅读与手记卡片。')}
    ${selectControl('字体风格','fontFamilySelect','fontFamily',a.fontFamily,[['heritage','原版文房'],['song','宋体阅读'],['sans','现代无衬线'],['kai','楷体手札']])}
    <div class="settings-inline-sliders">
      ${rangeControl('正文大小','bodyFontSize',a.bodyFontSize,13,22,1,'px')}
      ${rangeControl('行间距','lineHeight',a.lineHeight,1.45,2.5,.05)}
      ${rangeControl('版心宽度','contentWidth',a.contentWidth,860,1740,20,'px')}
    </div>
  </section></div>`;
}
export function settingsView(state){
  const active=SETTINGS_TABS.some(([key])=>key===state.settingsTab)?state.settingsTab:'appearance';
  const content={appearance:appearancePanel,reading:readingPanel,about:aboutPanel};
  return `<section class="settings-hub">
    <div class="settings-heading">
    <header class="settings-titlebar">
      <h2 id="settingsTitle">设置</h2>
      <div class="settings-actions">
        ${active==='about'||active==='data'?'':`<button type="button" class="settings-reset" data-action="reset-appearance">${icon('refresh')} 恢复默认设置</button>`}
        <button type="button" class="settings-close" data-action="close-settings" aria-label="关闭设置" title="关闭设置">${icon('close')}</button>
      </div>
    </header>
    <nav class="settings-hub-tabs vigil-tabs" role="tablist" aria-label="设置分类">${SETTINGS_TABS.map(([key,label])=>`<button type="button" id="settings-tab-${key}" class="settings-tab vigil-tab ${active===key?'active':''}" role="tab" aria-controls="settings-content" aria-selected="${active===key}" tabindex="${active===key?'0':'-1'}" data-action="settings-tab" data-tab="${key}">${label}</button>`).join('')}</nav>
    </div>
    <section class="settings-hub-panel" id="settings-content" role="tabpanel" aria-labelledby="settings-tab-${active}" tabindex="0">
      ${active==='data'?dataManagementPanels(state,{embedded:true}):content[active](state)}
    </section>
    <footer class="settings-bottom-note">${icon('check')} 设置即时保存在当前设备，不会修改手记。</footer>
  </section>`;
}
