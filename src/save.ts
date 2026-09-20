import { newCampaign } from './engine';
import type { Campaign } from './engine';
import { JOBS, SKILLS, NEW_HEROES } from './data';
const KEY='crown-and-cinders-save-v1';
export function validSave(value: unknown): value is Campaign {
  const integer=(v:unknown,min=0,max=1e7)=>typeof v==='number'&&Number.isInteger(v)&&v>=min&&v<=max;
  const string=(v:unknown,max=1000)=>typeof v==='string'&&v.length<=max;
  const job=(v:unknown)=>typeof v==='string'&&Object.hasOwn(JOBS,v);
  const skills=(v:unknown)=>Array.isArray(v)&&v.length<=30&&v.every(s=>typeof s==='string'&&Object.hasOwn(SKILLS,s));
  const position=(v:unknown)=>!!v&&typeof v==='object'&&integer((v as {x:unknown}).x,0,9)&&integer((v as {z:unknown}).z,0,9);
  const items=(v:Campaign['items'])=>!!v&&['potion','feather','ether'].every(k=>integer(v[k as keyof typeof v],0,99999));
  const charm=(v:unknown)=>['none','boots','ward','counter'].includes(v as string);
  try{
    if(!value||typeof value!=='object')return false;const c=value as Campaign;
    if(c.version!==1||!Array.isArray(c.heroes)||c.heroes.length!==4||new Set(c.heroes.map(h=>h.id)).size!==4)return false;
    if(!c.heroes.every(h=>NEW_HEROES.some(n=>n.id===h.id)&&string(h.name,60)&&string(h.bio,500)&&/^#[a-f0-9]{6}$/i.test(h.hair)&&/^#[a-f0-9]{6}$/i.test(h.skin)&&job(h.job)&&job(h.secondary)&&integer(h.level,1,15)&&integer(h.xp,0,99)&&integer(h.jp)&&integer(h.weapon,0,3)&&integer(h.armor,0,3)&&charm(h.charm)&&skills(h.learned)))return false;
    if(!Array.isArray(c.formation)||c.formation.length!==4||new Set(c.formation).size!==4||!c.formation.every(id=>c.heroes.some(h=>h.id===id)))return false;
    if(!integer(c.unlocked,0,4)||!Array.isArray(c.cleared)||new Set(c.cleared).size!==c.cleared.length||!c.cleared.every(n=>integer(n,0,4))||!integer(c.crowns)||!integer(c.battlesWon)||typeof c.finished!=='boolean'||!items(c.items))return false;
    const s=c.settings;if(!s||!['story','tactical'].includes(s.difficulty)||![1,1.6,2.2].includes(s.speed)||!['auto','high','low'].includes(s.quality)||![s.sound,s.music,s.reducedMotion].every(v=>typeof v==='boolean'))return false;
    if(c.battle===null)return true;const b=c.battle;
    if(!b||!integer(b.mission,0,4)||!integer(b.tick)||!integer(b.turn,1)||typeof b.moved!=='boolean'||typeof b.acted!=='boolean'||(b.origin!==null&&!position(b.origin))||!['victory','defeat',null].includes(b.outcome)||!['story','tactical'].includes(b.difficulty)||!items(b.items))return false;
    if(!Array.isArray(b.tiles)||b.tiles.length!==100||new Set(b.tiles.map(t=>`${t.x},${t.z}`)).size!==100||!b.tiles.every(t=>position(t)&&integer(t.h,-1,4)&&['stone','roof','grass','water'].includes(t.terrain)&&(t.blocked===undefined||typeof t.blocked==='boolean')&&(t.prop===undefined||['fountain','tree','crate','banner','crystal'].includes(t.prop))))return false;
    if(!Array.isArray(b.units)||b.units.length<4||b.units.length>10||new Set(b.units.map(u=>u.id)).size!==b.units.length)return false;
    if(!b.units.every(u=>string(u.id,40)&&/^[a-z0-9-]+$/.test(u.id)&&string(u.name,60)&&job(u.job)&&job(u.secondary)&&position(u)&&['ally','enemy'].includes(u.team)&&integer(u.level,1,15)&&integer(u.maxHp,1,9999)&&integer(u.hp,0,u.maxHp)&&integer(u.maxMp,1,9999)&&integer(u.mp,0,u.maxMp)&&[u.power,u.magic,u.speed,u.move,u.jump,u.range].every(v=>integer(v,1,999))&&integer(u.defense,0,999)&&Number.isFinite(u.ct)&&u.ct>=0&&u.ct<=150&&['north','east','south','west'].includes(u.facing)&&typeof u.boss==='boolean'&&charm(u.charm)&&skills(u.learned)&&u.statuses&&Object.entries(u.statuses).every(([k,v])=>['guard','poison','haste','slow','power'].includes(k)&&integer(v,1,3))&&(u.fallenAt===undefined||integer(u.fallenAt,0,b.tick))&&(u.departed===undefined||typeof u.departed==='boolean')))return false;
    if(!c.heroes.every(h=>b.units.some(u=>u.id===h.id&&u.team==='ally'))||(!b.outcome&&!b.units.some(u=>u.id===b.active&&u.hp>0)))return false;
    if(!Array.isArray(b.casts)||b.casts.length>10||!b.casts.every(c=>b.units.some(u=>u.id===c.caster)&&Object.hasOwn(SKILLS,c.skill)&&position(c.target)&&integer(c.remaining,1,6)))return false;
    if(!Array.isArray(b.log)||b.log.length>100||!b.log.every(l=>string(l,1000))||!b.earned||!c.heroes.every(h=>b.earned[h.id]&&integer(b.earned[h.id].xp)&&integer(b.earned[h.id].jp)))return false;
    return true;
  }catch{return false;}
}
export function loadCampaign(): {campaign:Campaign; notice?:string} {
  try{const raw=localStorage.getItem(KEY);if(!raw)return {campaign:newCampaign()};const value=JSON.parse(raw);if(validSave(value))return {campaign:value};return {campaign:newCampaign(),notice:'The old save could not be read. A fresh company is ready.'};}
  catch{return {campaign:newCampaign(),notice:'Saving is unavailable in this browser. You can still play and export your progress.'};}
}
export function saveCampaign(campaign:Campaign): boolean {try{localStorage.setItem(KEY,JSON.stringify(campaign));return true;}catch{return false;}}
export function exportCampaign(c:Campaign){const blob=new Blob([JSON.stringify(c,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='crown-and-cinders-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
