import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {Battle,chooseTactic,key,distance,facingToward,newCampaign,createBattle} from '../../src/engine';
import type {BattleState,Campaign} from '../../src/engine';
type State={campaign:Campaign;battle:BattleState;mode:string;busy:boolean;renderer:string};
const state=(page:Page)=>page.evaluate(()=>((window as any).__CINDERS__.state as State));
async function ready(page:Page){await page.waitForFunction(()=>!!(window as any).__CINDERS__,{},{timeout:45000});}
function trackErrors(page:Page){const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});return errors;}
async function start(page:Page){await page.goto('/');await ready(page);await page.getByRole('button',{name:'Begin battle',exact:true}).click();await page.getByRole('button',{name:'Skip story'}).click();}
async function clickTile(page:Page,p:{x:number;z:number}){
 const s=await state(page),occupant=s.battle.units.find(u=>u.x===p.x&&u.z===p.z&&!u.departed);
 if(occupant&&s.mode!=='move'){await page.locator(`#unit-labels [data-unit="${occupant.id}"]`).click();return;}
 const screen=await page.evaluate(p=>{const point=(window as any).__CINDERS__.project(p),r=document.getElementById('stage')!.getBoundingClientRect();return {x:r.left+point.x,y:r.top+point.y};},p);await page.mouse.click(screen.x,screen.y);
}
async function idle(page:Page){await page.waitForFunction(()=>{const s=(window as any).__CINDERS__.state;return !s.busy;});}
async function configureFast(page:Page){await page.getByRole('button',{name:'Settings',exact:true}).click();await page.locator('[data-setting="speed"]').selectOption('2.2');await page.locator('[data-setting="reducedMotion"]').check();await page.locator('[data-setting="sound"]').uncheck();await page.locator('[data-setting="music"]').uncheck();await page.getByRole('button',{name:'Close dialog'}).click();}

test('desktop WebGPU scene and real company customization persist across reload',async({page})=>{
 const errors=trackErrors(page);await page.goto('/');await ready(page);if(process.env.CI)expect(['WebGPU','WebGL2']).toContain((await state(page)).renderer);else expect((await state(page)).renderer).toBe('WebGPU');await expect(page.locator('canvas')).toBeVisible();await expect(page.getByRole('button',{name:'Begin battle',exact:true})).toBeEnabled();
 await page.screenshot({path:'test-results/desktop-campaign.png',fullPage:true});
 await page.getByRole('button',{name:'Company',exact:true}).click();await page.locator('[data-action="job"][data-id="ranger"]').click();await page.locator('#secondary-job').selectOption('mage');await page.getByRole('tab',{name:'Abilities',exact:true}).click();await page.locator('[data-action="learn"][data-id="venom"]').click();await page.getByRole('tab',{name:'Equipment',exact:true}).click();await page.locator('[data-action="buy-gear"][data-id="weapon"]').click();await page.locator('[data-action="charm"][data-id="boots"]').click();
 await page.getByRole('button',{name:'Close dialog'}).click();await page.reload();await ready(page);const s=await state(page);expect(s.campaign.heroes[0]).toMatchObject({job:'ranger',secondary:'mage',weapon:1,charm:'boots',jp:0});expect(s.campaign.heroes[0].learned).toContain('venom');expect(s.campaign.crowns).toBe(0);expect(s.battle.units[0].move).toBe(5);expect(errors).toEqual([]);
});

test('touch viewport keeps battlefield visible while moving, undoing, acting and resuming',async({browser})=>{
 const context=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,hasTouch:true,isMobile:true});const page=await context.newPage(),errors=trackErrors(page);await start(page);await configureFast(page);
 const layout=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,viewport:innerHeight}));expect(layout.width).toBe(393);expect(layout.height).toBe(layout.viewport);
 await page.locator('[data-action="move"]').tap();await page.screenshot({path:'test-results/mobile-move.png'});await clickTile(page,{x:3,z:7});await expect(page.getByRole('button',{name:'Move here'})).toBeVisible();await page.getByRole('button',{name:'Move here'}).tap();await idle(page);expect((await state(page)).battle.units[0]).toMatchObject({x:3,z:7});
 await page.locator('[data-action="undo"]').tap();await idle(page);expect((await state(page)).battle.units[0]).toMatchObject({x:2,z:8});await page.locator('[data-action="skill"][data-id="rally"]').tap();await clickTile(page,{x:2,z:8});await page.getByRole('button',{name:'Confirm Rally'}).tap();await idle(page);expect((await state(page)).battle.units[0].statuses.power).toBe(3);
 await page.reload();await ready(page);expect((await state(page)).battle.acted).toBe(true);await expect(page.locator('[data-action="skill"][data-id="attack"]')).toBeDisabled();await page.screenshot({path:'test-results/mobile-battle.png'});expect(errors).toEqual([]);await context.close();
});

for(const renderer of ['webgl2','webgl1'])test(`${renderer} compatibility renders the same playable scene`,async({page})=>{
 const errors=trackErrors(page);await page.goto(`/?renderer=${renderer}`);await ready(page);expect((await state(page)).renderer.toLowerCase()).toBe(renderer);await page.getByRole('button',{name:'Begin battle',exact:true}).click();await page.getByRole('button',{name:'Skip story'}).click();await page.locator('[data-action="move"]').click();await clickTile(page,{x:3,z:7});await page.getByRole('button',{name:'Move here'}).click();await idle(page);expect((await state(page)).battle.moved).toBe(true);await page.screenshot({path:`test-results/${renderer}.png`});expect(errors).toEqual([]);
});

for(const legacy of [false,true])test(`automatic fallback with ${legacy?'only WebGL1':'no WebGPU'} available`,async({page})=>{
 const errors=trackErrors(page);await page.addInitScript(legacy=>{Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true});if(legacy){const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:any[]){return type==='webgl2'?null:original.call(this,type,...args);} as typeof original;}},legacy);await page.goto('/');await ready(page);expect((await state(page)).renderer).toBe(legacy?'WebGL1':'WebGL2');await expect(page.getByRole('button',{name:'Begin battle',exact:true})).toBeEnabled();expect(errors).toEqual([]);
});

test('complete opening battle through visible controls, claim rewards, and unlock the next chapter',async({page})=>{
 // A hosted runner draws every frame with SwiftShader while executing hundreds of UI actions.
 test.setTimeout(process.env.CI?600000:240000);const errors=trackErrors(page);await start(page);await configureFast(page);
 for(let turns=0;turns<100;turns++){
   await idle(page);const snapshot=await state(page);if(snapshot.battle.outcome)break;
   const b=new Battle(snapshot.battle),plan=chooseTactic(b);expect(b.active.team).toBe('ally');
   if(key(plan.destination)!==key(b.active)){await page.locator('[data-action="move"]').click();await clickTile(page,plan.destination);await page.getByRole('button',{name:'Move here'}).click();await idle(page);}
   if(plan.skill&&plan.target){await page.locator(`[data-action="skill"][data-id="${plan.skill}"]`).click();await clickTile(page,plan.target);await page.locator('[data-action="confirm-skill"]').click();await idle(page);}
   const after=await state(page);if(after.battle.outcome)break;
   const current=new Battle(after.battle),foe=current.state.units.filter(u=>u.hp>0&&u.team!==current.active.team).sort((a,b)=>distance(a,current.active)-distance(b,current.active))[0];await page.locator('[data-action="end-turn"]').click();if(foe)await page.locator(`[data-action="face"][data-id="${facingToward(current.active,foe)}"]`).click();await page.locator('[data-action="finish-turn"]').click();
 }
 expect((await state(page)).battle.outcome).toBe('victory');await expect(page.getByRole('heading',{name:'A little victory.'})).toBeVisible();await page.screenshot({path:'test-results/victory.png'});await page.locator('[data-action="claim"]').click();await expect(page.getByRole('heading',{name:'Roots of Rebellion',exact:true})).toBeVisible();const result=await state(page);expect(result.campaign.unlocked).toBe(1);expect(result.campaign.cleared).toEqual([0]);expect(result.campaign.crowns).toBe(440);expect(result.campaign.heroes.every(h=>h.level>=2)).toBe(true);expect(errors).toEqual([]);
});

test('defeat, retry and retreat restore the original supplies without granting rewards',async({page})=>{
 const c=newCampaign();c.battle=createBattle(c,0);for(const u of c.battle.units.filter(u=>u.team==='ally')){u.hp=0;u.fallenAt=0;}c.battle.outcome='defeat';c.battle.items.potion=0;
 await page.addInitScript(c=>localStorage.setItem('crown-and-cinders-save-v1',JSON.stringify(c)),c);await page.goto('/');await ready(page);await expect(page.getByRole('heading',{name:'Every hero gets another try.'})).toBeVisible();await page.getByRole('button',{name:'Try again'}).click();await page.getByRole('button',{name:'Skip story'}).click();expect((await state(page)).battle.items.potion).toBe(5);expect((await state(page)).battle.units.filter(u=>u.team==='ally').every(u=>u.hp===u.maxHp)).toBe(true);
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Retreat from this battle'}).click();await page.getByRole('button',{name:'Return to camp'}).click();await expect(page.getByRole('heading',{name:'The little company.'})).toBeVisible();const s=await state(page);expect(s.campaign.battle).toBeNull();expect(s.campaign.crowns).toBe(260);expect(s.campaign.cleared).toEqual([]);
});

test('invalid saves recover gracefully and field guide and settings remain usable',async({page})=>{
 const errors=trackErrors(page);await page.addInitScript(()=>localStorage.setItem('crown-and-cinders-save-v1','{"version":1,"heroes":[]}'));await page.goto('/');await ready(page);await expect(page.getByRole('button',{name:'Begin battle',exact:true})).toBeEnabled();await expect(page.getByRole('status').filter({hasText:'The old save could not be read.'})).toBeVisible();await page.getByRole('button',{name:'Field guide',exact:true}).click();await expect(page.getByRole('heading',{name:'Magic needs a moment.'})).toBeVisible();await page.getByRole('button',{name:'Close dialog'}).click();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.locator('[data-setting="difficulty"]').selectOption('story');expect((await state(page)).campaign.settings.difficulty).toBe('story');expect(errors).toEqual([]);
});

test('every chapter renders, travel works, and the final reward completes the campaign',async({page})=>{
 const errors=trackErrors(page),c=newCampaign();c.unlocked=4;c.cleared=[0,1,2,3];c.battlesWon=4;
 await page.addInitScript(c=>{if(!localStorage.getItem('crown-and-cinders-save-v1'))localStorage.setItem('crown-and-cinders-save-v1',JSON.stringify(c));},c);await page.goto('/');await ready(page);
 for(let m=0;m<5;m++){await page.getByRole('button',{name:'Campaign',exact:true}).click();await page.locator(`[data-action="travel"][data-id="${m}"]`).click();await expect.poll(async()=>(await state(page)).battle.mission).toBe(m);await page.screenshot({path:`test-results/chapter-${m+1}.png`});}
 const victory=newCampaign();victory.unlocked=4;victory.cleared=[0,1,2,3];victory.battle=createBattle(victory,4);victory.battle.outcome='victory';victory.battle.units.filter(u=>u.team==='enemy').forEach(u=>{u.hp=0;u.fallenAt=0;});
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.locator('#import-save').setInputFiles({name:'completed-battle.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(victory))});await page.getByRole('button',{name:'Import campaign',exact:true}).click();await ready(page);await expect(page.getByRole('heading',{name:'A kingdom, rekindled.'})).toBeVisible();await page.screenshot({path:'test-results/ending.png'});await page.locator('[data-action="claim"]').click();expect((await state(page)).campaign.finished).toBe(true);expect((await state(page)).campaign.cleared).toEqual([0,1,2,3,4]);
 await page.getByRole('button',{name:'Settings',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export save'}).click();expect((await download).suggestedFilename()).toBe('crown-and-cinders-save.json');expect(errors).toEqual([]);
});

test('landscape touch layout keeps both the board and commands inside the viewport',async({browser})=>{
 const context=await browser.newContext({viewport:{width:852,height:393},hasTouch:true,isMobile:true});const page=await context.newPage();await start(page);await page.screenshot({path:'test-results/mobile-landscape.png'});const sizes=await page.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight,view:innerHeight}));expect(sizes.w).toBe(852);expect(sizes.h).toBe(sizes.view);await expect(page.locator('[data-action="move"]')).toBeVisible();await context.close();
});

test('keyboard shortcuts move the tile cursor and confirm facing without a mouse',async({page})=>{
 await start(page);await configureFast(page);await page.getByRole('button',{name:'Company',exact:true}).focus();await page.keyboard.press('m');await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');await idle(page);expect((await state(page)).battle.units[0]).toMatchObject({x:2,z:7});await page.keyboard.press('w');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await idle(page);expect((await state(page)).battle.units[0].facing).toBe('east');expect((await state(page)).battle.active).toBe('bryn');
});
