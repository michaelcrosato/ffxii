import { JOBS, SKILLS, MISSIONS, NEW_HEROES, makeMap } from './data';
import type { Direction, Hero, JobId, Pos, Skill, Status, Team, Tile } from './data';

export interface Unit extends Pos {
  id: string; name: string; job: JobId; secondary: JobId; team: Team; level: number;
  hp: number; maxHp: number; mp: number; maxMp: number; power: number; magic: number;
  defense: number; speed: number; move: number; jump: number; range: number;
  ct: number; facing: Direction; statuses: Partial<Record<Status, number>>;
  learned: string[]; charm: Hero['charm']; boss: boolean; fallenAt?: number; departed?: boolean;
}
export interface Cast { caster: string; skill: string; target: Pos; remaining: number; }
export interface BattleState {
  mission: number; tiles: Tile[]; units: Unit[]; active: string; tick: number; turn: number;
  moved: boolean; acted: boolean; origin: Pos | null; casts: Cast[];
  outcome: 'victory' | 'defeat' | null; log: string[];
  items: { potion: number; feather: number; ether: number };
  earned: Record<string, { xp: number; jp: number }>; difficulty: 'story' | 'tactical';
}
export interface Campaign {
  version: 1; heroes: Hero[]; unlocked: number; cleared: number[]; crowns: number;
  items: BattleState['items']; formation: string[]; battle: BattleState | null;
  settings: { sound: boolean; music: boolean; speed: number; difficulty: 'story' | 'tactical'; reducedMotion: boolean; quality: 'auto' | 'high' | 'low' };
  finished: boolean; battlesWon: number;
}
export interface BattleEvent { type: 'move' | 'damage' | 'heal' | 'cast' | 'status' | 'down' | 'revive' | 'turn' | 'end'; unit?: string; value?: number; text?: string; path?: Pos[]; skill?: string; }
export const distance = (a: Pos, b: Pos) => Math.abs(a.x-b.x)+Math.abs(a.z-b.z);
export const key = (p: Pos) => `${p.x},${p.z}`;
export function newCampaign(): Campaign {
  return {version:1,heroes:structuredClone(NEW_HEROES),unlocked:0,cleared:[],crowns:260,items:{potion:5,feather:2,ether:2},formation:NEW_HEROES.map(h=>h.id),battle:null,settings:{sound:true,music:true,speed:1,difficulty:'tactical',reducedMotion:false,quality:'auto'},finished:false,battlesWon:0};
}
export function heroUnit(hero: Hero, pos: Pos): Unit {
  const j=JOBS[hero.job], level=hero.level-1;
  return {id:hero.id,name:hero.name,job:hero.job,secondary:hero.secondary,team:'ally',level:hero.level,...pos,
    hp:j.hp+level*12+hero.armor*14,maxHp:j.hp+level*12+hero.armor*14,mp:j.mp+level*5,maxMp:j.mp+level*5,
    power:j.power+level*3+hero.weapon*5,magic:j.magic+level*3+hero.weapon*4,defense:j.defense+hero.armor*3,
    speed:j.speed,move:j.move+(hero.charm==='boots'?1:0),jump:j.jump,range:j.range,ct:0,facing:'north',statuses:{},
    learned:[...hero.learned],charm:hero.charm,boss:false};
}
export function createBattle(campaign: Campaign, mission: number): BattleState {
  const m=MISSIONS[mission];
  const allies=campaign.formation.map((id,i)=>heroUnit(campaign.heroes.find(h=>h.id===id)!,m.spawn[i]));
  allies.forEach((u,i)=>u.ct=100-i*9);
  const enemies=m.enemies.map((e,i)=>{
    const hero: Hero={...NEW_HEROES[0],id:`enemy-${i}`,name:e.name,job:e.job,secondary:'squire',level:e.level,learned:[...JOBS[e.job].skills],weapon:0,armor:0,charm:'none'};
    const u=heroUnit(hero,e);u.team='enemy';u.ct=48+i*5;u.facing='south';u.boss=!!e.boss;
    if(mission===0){u.maxHp=Math.round(u.maxHp*.8);u.hp=u.maxHp;u.power=Math.round(u.power*.85);u.magic=Math.round(u.magic*.8);u.learned=JOBS[e.job].skills.slice(0,2);}
    if(mission<=2&&!e.boss)u.learned=JOBS[e.job].skills.slice(0,2);
    // A four-hero company faces larger patrols; regulars have lower base stats.
    u.maxHp=Math.round(u.maxHp*.82);u.hp=u.maxHp;u.power=Math.round(u.power*.8);u.magic=Math.round(u.magic*.8);
    if(e.boss){u.maxHp=Math.round(u.maxHp*1.65);u.hp=u.maxHp;u.power+=5;u.magic+=4;}
    if(campaign.settings.difficulty==='story'){u.maxHp=Math.round(u.maxHp*.72);u.hp=u.maxHp;u.power=Math.round(u.power*.8);u.magic=Math.round(u.magic*.8);}
    return u;
  });
  return {mission,tiles:makeMap(m.theme),units:[...allies,...enemies],active:allies[0].id,tick:0,turn:1,moved:false,acted:false,origin:null,casts:[],outcome:null,log:[`${m.title}. ${m.objective}.`,`${allies[0].name} takes the initiative.`],items:{...campaign.items},earned:Object.fromEntries(allies.map(u=>[u.id,{xp:0,jp:0}])),difficulty:campaign.settings.difficulty};
}

export class Battle {
  state: BattleState;
  events: BattleEvent[]=[];
  constructor(state: BattleState){this.state=state;}
  get active(){return this.state.units.find(u=>u.id===this.state.active)!;}
  tile(p: Pos){return this.state.tiles.find(t=>t.x===p.x&&t.z===p.z);}
  unitAt(p: Pos, includeDown=false){return this.state.units.find(u=>u.x===p.x&&u.z===p.z&&!u.departed&&(includeDown||u.hp>0));}
  log(message: string){this.state.log.push(message);if(this.state.log.length>80)this.state.log.shift();}
  casting(u: Unit){return this.state.casts.find(c=>c.caster===u.id);}
  skills(u: Unit): Skill[] {
    const ids=['attack',...JOBS[u.job].skills,...JOBS[u.secondary].skills];
    if(u.team==='ally')ids.push('potion','feather','ether');
    return [...new Set(ids)].filter(id=>id==='attack'||SKILLS[id].item||u.learned.includes(id)||JOBS[u.job].skills[0]===id).map(id=>SKILLS[id]);
  }
  canAfford(u: Unit,s: Skill){return u.mp>=s.mp&&(!s.item||this.state.items[s.item]>0);}
  reachable(u: Unit=this.active): Map<string, Pos[]> {
    const visited=new Map<string,Pos[]>([[key(u),[]]]);const queue:Pos[]=[{x:u.x,z:u.z}];
    for(let q=0;q<queue.length;q++){
      const p=queue[q],path=visited.get(key(p))!;
      for(const n of [{x:p.x+1,z:p.z},{x:p.x-1,z:p.z},{x:p.x,z:p.z+1},{x:p.x,z:p.z-1}]){
        const t=this.tile(n);if(!t||t.blocked||visited.has(key(n))||Math.abs(t.h-this.tile(p)!.h)>u.jump)continue;
        const occupant=this.unitAt(n);if(occupant&&occupant.id!==u.id)continue;
        const step=t.terrain==='water'?2:1;
        if(path.length+step>u.move)continue;
        visited.set(key(n),[...path,n]);queue.push(n);
      }
    }
    return visited;
  }
  move(p: Pos): boolean {
    const u=this.active;if(this.state.outcome||u.hp<=0||this.state.moved)return false;
    const path=this.reachable(u).get(key(p));if(!path?.length)return false;
    this.state.origin={x:u.x,z:u.z};u.facing=facingToward(path.length>1?path[path.length-2]:u,p);
    this.events.push({type:'move',unit:u.id,path:[{x:u.x,z:u.z},...path]});u.x=p.x;u.z=p.z;this.state.moved=true;return true;
  }
  undoMove(): boolean {
    if(!this.state.origin||this.state.acted||!this.state.moved)return false;
    const u=this.active;const origin=this.state.origin;this.events.push({type:'move',unit:u.id,path:[{x:u.x,z:u.z},origin]});Object.assign(u,origin);this.state.origin=null;this.state.moved=false;return true;
  }
  hasLineOfSight(from: Pos,to: Pos): boolean {
    const steps=Math.max(Math.abs(to.x-from.x),Math.abs(to.z-from.z))*3;
    const start=this.tile(from)!.h+1.3,end=this.tile(to)!.h+1;
    for(let i=1;i<steps;i++){
      const f=i/steps,p={x:Math.round(from.x+(to.x-from.x)*f),z:Math.round(from.z+(to.z-from.z)*f)};
      if(key(p)===key(from)||key(p)===key(to))continue;
      const t=this.tile(p);if(t&&(t.h+(t.prop==='tree'?2:0))>start+(end-start)*f+.1)return false;
    }
    return true;
  }
  range(u: Unit,s: Skill,from: Pos=u): number {
    const base=s.id==='attack'?u.range:s.range;
    return base+(base>=4&&!s.magic?Math.max(0,Math.floor(this.tile(from)!.h/2)):0);
  }
  validTarget(u: Unit,s: Skill,p: Pos,from: Pos=u): boolean {
    const tile=this.tile(p);if(!tile||distance(from,p)>this.range(u,s,from))return false;
    if(s.target==='self')return key(p)===key(from);
    if(s.id==='attack'&&u.range===1&&Math.abs(tile.h-this.tile(from)!.h)>u.jump)return false;
    if(!s.magic&&s.target==='enemy'&&distance(from,p)>1&&!this.hasLineOfSight(from,p))return false;
    const targets=this.state.units.filter(t=>key(t)===key(p)&&!t.departed);
    if(s.target==='any')return !tile.blocked||!!targets.length;
    return targets.some(t=>s.target==='down'?t.hp<=0&&t.team===u.team&&!this.unitAt(p):s.target==='ally'?t.hp>0&&t.team===u.team:t.hp>0&&t.team!==u.team);
  }
  targets(u: Unit,s: Skill,p: Pos): Unit[] {
    if(s.target==='self')return [u];
    return this.state.units.filter(t=>!t.departed&&distance(t,p)<=s.radius&&(
      s.target==='down'?t.hp<=0&&t.team===u.team:t.hp>0&&(s.target==='any'||(s.target==='ally'?t.team===u.team:t.team!==u.team))));
  }
  damage(u: Unit,t: Unit,s: Skill,from: Pos=u): number {
    if(s.effect==='chakra')return s.power;
    if(s.effect==='heal')return s.item?s.power:Math.round(u.magic*s.power);
    if(s.effect==='revive')return Math.round(t.maxHp*s.power);
    if(s.power===0)return 0;
    const physical=!s.magic;
    let value=(physical?u.power:u.magic)*s.power-(physical?t.defense*.7:t.defense*.25);
    if(physical&&u.statuses.power)value*=1.25;
    if(physical){value*=1+Math.max(-2,Math.min(2,this.tile(from)!.h-this.tile(t)!.h))*.12;}
    if(s.id==='attack'||s.id==='rend'||s.id==='cleave')value*=this.flank(from,t)==='rear'?1.3:this.flank(from,t)==='side'?1.12:1;
    if(t.statuses.guard)value*=.6;
    if(this.casting(t))value*=1.2;
    if(s.magic&&t.charm==='ward')value*=.75;
    return Math.max(5,Math.round(value));
  }
  flank(from: Pos,t: Unit): 'front'|'side'|'rear' {
    const direction=facingToward(t,from),dirs:Direction[]=['north','east','south','west'];
    const d=Math.abs(dirs.indexOf(direction)-dirs.indexOf(t.facing));return d===0?'front':d===2?'rear':'side';
  }
  act(skillId: string,p: Pos): boolean {
    const u=this.active,s=SKILLS[skillId];
    if(!s||this.state.outcome||u.hp<=0||this.state.acted||this.casting(u)||!this.skills(u).some(a=>a.id===skillId)||!this.canAfford(u,s)||!this.validTarget(u,s,p))return false;
    u.mp-=s.mp;if(s.item)this.state.items[s.item]--;
    this.state.acted=true;this.state.origin=null;
    if(distance(u,p)>0)u.facing=facingToward(u,p);
    if(s.charge){this.state.casts.push({caster:u.id,skill:s.id,target:{...p},remaining:s.charge});this.log(`${u.name} prepares ${s.name} (${s.charge} ticks).`);this.events.push({type:'cast',unit:u.id,skill:s.id});}
    else this.resolve(u,s,p);
    if(u.team==='ally'){this.state.earned[u.id].xp+=18;this.state.earned[u.id].jp+=8;}
    this.checkOutcome();return true;
  }
  private resolve(u: Unit,s: Skill,p: Pos){
    const targets=this.targets(u,s,p);
    if(!targets.length){this.log(`${u.name}’s ${s.name} finds only empty ground.`);return;}
    for(const t of targets){
      if(s.effect==='heal'||s.effect==='revive'||s.effect==='chakra'){
        if(s.effect==='revive'&&this.unitAt(t)){this.log(`${s.name} cannot revive ${t.name}: the tile is occupied.`);continue;}
        const amount=s.effect==='chakra'?s.power:this.damage(u,t,s);const restored=Math.min(t.maxHp-t.hp,amount);
        t.hp=Math.min(t.maxHp,t.hp+amount);
        if(s.effect==='revive'){t.fallenAt=undefined;t.ct=30;this.events.push({type:'revive',unit:t.id});}
        if(s.effect==='chakra'){t.mp=Math.min(t.maxMp,t.mp+s.power);delete t.statuses.poison;}
        if(s.id==='sanctuary'){delete t.statuses.poison;delete t.statuses.slow;}
        this.events.push({type:'heal',unit:t.id,value:restored,skill:s.id});this.log(`${u.name} uses ${s.name}: ${t.name} +${restored} HP${s.effect==='chakra'?`, +${s.power} MP`:''}.`);
      }else{
        if(s.power>0){const amount=this.damage(u,t,s);t.hp=Math.max(0,t.hp-amount);this.events.push({type:'damage',unit:t.id,value:amount,skill:s.id});this.log(`${u.name} → ${t.name}: ${s.name}, ${amount} damage.`);
          if(t.hp<=0)this.down(t);
          else if(t.charm==='counter'&&!s.magic&&distance(u,t)===1&&s.power>0){const counter=Math.max(5,Math.round(t.power*.45));u.hp=Math.max(0,u.hp-counter);this.events.push({type:'damage',unit:u.id,value:counter,text:'COUNTER'});this.log(`${t.name} counters for ${counter}.`);if(u.hp<=0)this.down(u);}
        }
        if(s.effect&&t.hp>0){
          if(s.effect==='rend')t.defense=Math.max(0,t.defense-5);
          else {t.statuses[s.effect]=3;if(s.effect==='haste')delete t.statuses.slow;if(s.effect==='slow')delete t.statuses.haste;if(s.id==='challenge')t.statuses.power=3;}
          this.events.push({type:'status',unit:t.id,text:s.effect.toUpperCase()});if(s.power===0)this.log(`${u.name} uses ${s.name} on ${t.name}.`);
        }
      }
    }
  }
  private down(t: Unit){t.fallenAt=this.state.tick;t.statuses={};this.state.casts=this.state.casts.filter(c=>c.caster!==t.id);this.events.push({type:'down',unit:t.id});this.log(`${t.name} falls. Revival window: 30 clock ticks.`);}
  private checkOutcome(){
    if(!this.state.units.some(u=>u.team==='enemy'&&u.hp>0))this.state.outcome='victory';
    else if(!this.state.units.some(u=>u.team==='ally'&&u.hp>0))this.state.outcome='defeat';
    if(this.state.outcome)this.events.push({type:'end',text:this.state.outcome});
  }
  endTurn(facing: Direction=this.active.facing){
    if(this.state.outcome)return;
    const u=this.active;
    u.facing=facing;const cost=this.state.moved&&this.state.acted?100:this.state.moved||this.state.acted?80:60;
    u.ct=Math.max(0,u.ct-cost);
    if(!this.state.acted){u.statuses.guard=2;this.log(`${u.name} guards and waits.`);}
    this.state.active='';this.state.moved=false;this.state.acted=false;this.state.origin=null;
    this.advance();
  }
  private advance(){
    for(let guard=0;guard<1000&&!this.state.outcome;guard++){
      const ready=this.state.units.filter(u=>u.hp>0&&u.ct>=100&&!this.casting(u)).sort((a,b)=>b.ct-a.ct||b.speed-a.speed);
      if(ready.length){
        const u=ready[0];
        for(const status of Object.keys(u.statuses) as Status[]){
          if(status==='poison'){const damage=Math.ceil(u.maxHp*.1);u.hp=Math.max(0,u.hp-damage);this.events.push({type:'damage',unit:u.id,value:damage,text:'POISON'});this.log(`${u.name} suffers ${damage} poison damage.`);}
          u.statuses[status]!--;if(!u.statuses[status])delete u.statuses[status];
        }
        if(u.hp<=0){this.down(u);this.checkOutcome();continue;}
        u.mp=Math.min(u.maxMp,u.mp+3);this.state.active=u.id;this.state.turn++;this.events.push({type:'turn',unit:u.id});this.log(`${u.name} is ready.`);return;
      }
      this.state.tick++;
      for(const u of this.state.units){
        if(u.hp>0)u.ct=Math.min(150,u.ct+u.speed*(u.statuses.haste?1.5:u.statuses.slow?.65:1));
        else if(u.fallenAt!==undefined&&this.state.tick-u.fallenAt>=30&&!u.departed){u.departed=true;this.log(`${u.name} withdraws from the battlefield.`);}
      }
      const resolving=this.state.casts.filter(c=>--c.remaining<=0);this.state.casts=this.state.casts.filter(c=>c.remaining>0);
      for(const cast of resolving){const u=this.state.units.find(u=>u.id===cast.caster)!;if(u.hp>0)this.resolve(u,SKILLS[cast.skill],cast.target);}
      this.checkOutcome();
    }
  }
  forecast(limit=7): Unit[] {
    const units=this.state.units.filter(u=>u.hp>0).map(u=>({...u,statuses:{...u.statuses}}));
    const casts=new Map(this.state.casts.map(c=>[c.caster,c.remaining]));const result:Unit[]=[];
    const active=units.find(u=>u.id===this.state.active);
    if(active){result.push({...active});active.ct=Math.max(0,active.ct-100);}
    for(let safety=0;safety<1000&&result.length<limit;safety++){
      const next=units.filter(u=>u.ct>=100&&(casts.get(u.id)??0)<=0).sort((a,b)=>b.ct-a.ct||b.speed-a.speed)[0];
      if(next){result.push({...next});next.ct=Math.max(0,next.ct-100);for(const status of ['haste','slow'] as const){if(next.statuses[status]){next.statuses[status]!--;if(!next.statuses[status])delete next.statuses[status];}}}
      else{for(const u of units)u.ct=Math.min(150,u.ct+u.speed*(u.statuses.haste?1.5:u.statuses.slow?.65:1));for(const [id,time]of casts)casts.set(id,time-1);}
    }
    return result;
  }
}
export function facingToward(from: Pos,to: Pos): Direction {
  const dx=to.x-from.x,dz=to.z-from.z;return Math.abs(dx)>Math.abs(dz)?(dx>0?'east':'west'):(dz>0?'south':'north');
}
export interface Tactic { destination: Pos; skill?: string; target?: Pos; score: number; }
export function chooseTactic(b: Battle): Tactic {
  const u=b.active,foes=b.state.units.filter(t=>t.hp>0&&t.team!==u.team);
  const origin={x:u.x,z:u.z};
  const positions=b.state.moved?[{x:u.x,z:u.z}]:[...b.reachable(u).keys()].map(k=>{const [x,z]=k.split(',').map(Number);return {x,z};});
  let best:Tactic={destination:{x:u.x,z:u.z},score:-Infinity};
  for(const p of positions){
    u.x=p.x;u.z=p.z;
    const nearest=Math.min(...foes.map(t=>distance(p,t)));
    const preferredRange=u.range>1||['mage','cleric','chronist'].includes(u.job)?3:1;
    let moveScore=-Math.abs(nearest-preferredRange)*.8-distance(origin,p)*.035+(b.tile(p)!.h*.2);
    for(const cast of b.state.casts){const caster=b.state.units.find(t=>t.id===cast.caster)!;const spell=SKILLS[cast.skill];if(spell.power>0&&!spell.effect&&distance(p,cast.target)<=spell.radius&&(spell.target==='any'||caster.team!==u.team))moveScore-=b.damage(caster,u,spell)*1.4;}
    // Spread out against area spells instead of offering a clustered target.
    moveScore-=b.state.units.filter(t=>t.id!==u.id&&t.team===u.team&&t.hp>0&&distance(p,t)<=1).length*3;
    if(moveScore>best.score)best={destination:p,score:moveScore};
    if(b.state.acted)continue;
    for(const s of b.skills(u)){
      if(!b.canAfford(u,s))continue;
      for(const t of b.state.units){
        const target=s.target==='self'?p:t;
        if(!b.validTarget(u,s,target,p))continue;
        let score=0;
        const affected=s.target==='self'?[u]:b.targets(u,s,target);
        for(const v of affected){
          if(s.effect==='heal')score+=Math.min(v.maxHp-v.hp,b.damage(u,v,s,p))*.8;
          else if(s.effect==='revive')score+=70;
          else if(s.effect==='chakra')score+=Math.min(u.maxHp-u.hp,s.power)*.65+Math.min(u.maxMp-u.mp,s.power)*.5;
          else if(s.power>0){const damage=b.damage(u,v,s,p);score+=(v.team!==u.team?1:-1.8)*(Math.min(v.hp,damage)+(damage>=v.hp?35:0));}
          else if(s.effect&&s.effect!=='rend'&&!v.statuses[s.effect])score+=s.effect==='haste'?18:s.effect==='slow'?12:8;
        }
        score+=moveScore-s.mp*.16-s.charge*.3;
        if(score>best.score&&score>moveScore+.1)best={destination:p,skill:s.id,target:{x:target.x,z:target.z},score};
      }
    }
  }
  u.x=origin.x;u.z=origin.z;
  return best;
}
export function settleBattle(c: Campaign,b: BattleState){
  if(b.outcome!=='victory')return;
  const first=!c.cleared.includes(b.mission),m=MISSIONS[b.mission];
  c.crowns+=first?m.reward:Math.round(m.reward*.55);c.battlesWon++;
  c.items={potion:Math.max(3,b.items.potion+2),feather:Math.max(1,b.items.feather+1),ether:Math.max(1,b.items.ether+1)};
  for(const hero of c.heroes){
    const earned=b.earned[hero.id]??{xp:0,jp:0};hero.xp+=50+Math.min(earned.xp,150);hero.jp+=40+Math.min(earned.jp,90);
    while(hero.xp>=100&&hero.level<15){hero.xp-=100;hero.level++;}
    if(hero.level===15)hero.xp=Math.min(99,hero.xp);
  }
  if(first)c.cleared.push(b.mission);c.unlocked=Math.min(MISSIONS.length-1,Math.max(c.unlocked,b.mission+1));
  if(b.mission===MISSIONS.length-1)c.finished=true;c.battle=null;
}
