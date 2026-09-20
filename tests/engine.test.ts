import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle, createBattle, newCampaign, chooseTactic, key, settleBattle, distance, facingToward, heroUnit } from '../src/engine';
import type { Campaign } from '../src/engine';
import { MISSIONS, JOBS, SKILLS } from '../src/data';
import { validSave } from '../src/save';
const fresh=()=>new Battle(createBattle(newCampaign(),0));
function isolated(){const b=fresh();b.state.units=b.state.units.filter(u=>u.id==='rowan'||u.id==='enemy-0');const [a,e]=b.state.units;a.x=4;a.z=8;e.x=5;e.z=8;e.facing='west';return {b,a,e};}
test('all five authored maps have legal, distinct spawns and reachable battlefields',()=>{
 const c=newCampaign();for(const m of MISSIONS){const b=new Battle(createBattle(c,m.id));assert.equal(b.state.tiles.length,100);assert.equal(new Set(b.state.tiles.map(key)).size,100);assert.equal(new Set(b.state.units.map(key)).size,b.state.units.length);for(const u of b.state.units){assert.equal(b.tile(u)?.blocked,false,`${m.title}: ${u.name}`);assert.ok(b.reachable(u).size>1,`${u.name} can move`);}}
});
test('move rejects blocked, occupied, excessive height, distant and second destinations',()=>{
 const b=fresh(),u=b.active;assert.equal(b.move({x:3,z:8}),false);assert.equal(b.move({x:5,z:5}),false);assert.equal(b.move({x:9,z:0}),false);assert.equal(b.move({x:2,z:5}),false);assert.equal(b.move({x:3,z:7}),true);assert.equal(b.move({x:4,z:7}),false);assert.deepEqual({x:u.x,z:u.z},{x:3,z:7});
});
test('movement can be undone before acting and is locked after acting',()=>{
 const {b,a,e}=isolated();assert.ok(b.move({x:4,z:7}));assert.ok(b.undoMove());assert.equal(a.z,8);assert.ok(b.move({x:5,z:7}));assert.ok(b.act('attack',e));assert.equal(b.undoMove(),false);assert.equal(b.act('attack',e),false);
});
test('acting before movement is legal and consumes each resource once',()=>{
 const {b,e}=isolated();assert.ok(b.act('attack',e));assert.ok(b.move({x:4,z:7}));assert.ok(b.state.acted&&b.state.moved);assert.equal(b.move({x:4,z:6}),false);
});
test('illegal targets and unknown abilities never spend MP, items, or the action',()=>{
 const {b,a}=isolated(),mp=a.mp,items={...b.state.items};assert.equal(b.act('comet',{x:5,z:8}),false);assert.equal(b.act('potion',{x:5,z:8}),false);assert.equal(b.act('mend',{x:0,z:0}),false);assert.equal(a.mp,mp);assert.deepEqual(b.state.items,items);assert.equal(b.state.acted,false);
});
test('height, facing, guard, charging and ward are included in deterministic damage',()=>{
 const {b,a,e}=isolated(),s=SKILLS.attack,front=b.damage(a,e,s);e.facing='east';assert.ok(b.damage(a,e,s)>front);e.statuses.guard=2;assert.ok(b.damage(a,e,s)<front);delete e.statuses.guard;e.facing='west';b.tile(a)!.h=2;assert.ok(b.damage(a,e,s)>front);b.tile(a)!.h=0;const magic=b.damage(a,e,SKILLS.ember);e.charm='ward';assert.ok(b.damage(a,e,SKILLS.ember)<magic);e.charm='none';b.state.casts.push({caster:e.id,skill:'mend',target:e,remaining:3});assert.ok(b.damage(a,e,SKILLS.ember)>magic);
});
test('ranged attacks respect line of sight and high terraces extend range',()=>{
 const b=fresh(),u=b.state.units.find(u=>u.id==='pip')!;u.x=4;u.z=8;assert.equal(b.range(u,SKILLS.attack),4);b.tile(u)!.h=2;assert.equal(b.range(u,SKILLS.attack),5);b.tile({x:4,z:6})!.h=4;assert.equal(b.hasLineOfSight(u,{x:4,z:4}),false);
});
test('charged area magic resolves on a tile and damages allies in its cross',()=>{
 const b=fresh(),u=b.state.units.find(u=>u.id==='iona')!,friend=b.state.units[0],enemy=b.state.units.find(u=>u.team==='enemy')!;
 b.state.units=[u,friend,enemy];b.state.active=u.id;u.x=4;u.z=8;friend.x=4;friend.z=6;enemy.x=5;enemy.z=6;enemy.ct=0;friend.ct=0;const hp=friend.hp;
 assert.ok(b.act('ember',{x:5,z:6}));assert.equal(friend.hp,hp);assert.equal(b.state.casts.length,1);b.endTurn();assert.ok(friend.hp<hp);assert.ok(enemy.hp<enemy.maxHp);assert.equal(b.state.casts.length,0);
});
test('charged spells miss when the target has moved away',()=>{
 const b=fresh(),u=b.state.units.find(u=>u.id==='iona')!,enemy=b.state.units.find(u=>u.team==='enemy')!;b.state.units=[u,enemy];b.state.active=u.id;u.x=4;u.z=8;enemy.x=4;enemy.z=5;enemy.ct=0;assert.ok(b.act('frost',enemy));const hp=enemy.hp;enemy.x=8;enemy.z=8;b.endTurn();assert.equal(enemy.hp,hp);
});
test('tonics consume shared supplies, heal only to max, and empty items are rejected',()=>{
 const {b,a}=isolated();a.hp-=15;b.state.items.potion=1;assert.ok(b.act('potion',a));assert.equal(a.hp,a.maxHp);assert.equal(b.state.items.potion,0);b.state.acted=false;assert.equal(b.act('potion',a),false);
});
test('revival requires a downed ally and an unoccupied tile',()=>{
 const b=fresh(),a=b.active,t=b.state.units.find(u=>u.id==='bryn')!;t.hp=0;t.fallenAt=0;assert.ok(b.act('feather',t));assert.equal(t.hp,Math.round(t.maxHp*.5));assert.equal(t.fallenAt,undefined);
 const b2=fresh(),down=b2.state.units[1],blocker=b2.state.units[2];down.hp=0;blocker.x=down.x;blocker.z=down.z;assert.equal(b2.validTarget(b2.active,SKILLS.feather,down),false);assert.equal(a.hp,a.maxHp);
});
test('a caster falling cancels the queued spell',()=>{
 const {b,a,e}=isolated();e.hp=1;b.state.casts=[{caster:e.id,skill:'ember',target:a,remaining:4}];assert.ok(b.act('attack',e));assert.equal(b.state.casts.length,0);assert.equal(b.state.outcome,'victory');
});
test('guarding preserves CT and grants damage reduction',()=>{
 const b=fresh(),a=b.active;b.state.units[1].ct=100;b.endTurn();assert.equal(a.ct,40);assert.equal(a.statuses.guard,2);assert.equal(b.state.tick,0);
});
test('poison ticks on the affected turn; MP regenerates and statuses expire',()=>{
 const {b,a,e}=isolated();a.ct=100;e.ct=99;e.hp=e.maxHp;e.mp=0;e.statuses.poison=1;e.statuses.slow=1;const hp=e.hp;b.endTurn();assert.equal(b.active.id,e.id);assert.equal(e.hp,hp-Math.ceil(e.maxHp*.1));assert.equal(e.mp,3);assert.equal(e.statuses.poison,undefined);assert.equal(e.statuses.slow,undefined);
});
test('AI planning does not mutate units and yields executable moves and skills',()=>{
 const b=fresh(),before=structuredClone(b.state);const plan=chooseTactic(b);assert.deepEqual(b.state,before);if(key(plan.destination)!==key(b.active))assert.ok(b.move(plan.destination));if(plan.skill&&plan.target)assert.ok(b.act(plan.skill,plan.target));
});
test('defeat occurs when the last ally falls, with no campaign reward',()=>{
 const {b,a,e}=isolated(),c=newCampaign();b.state.active=e.id;e.ct=100;a.hp=1;assert.ok(b.act('attack',a));assert.equal(b.state.outcome,'defeat');const before=structuredClone(c);settleBattle(c,b.state);assert.deepEqual(c,before);
});
test('weapon, armor, job and charm choices affect actual battle stats',()=>{
 const c=newCampaign(),h=c.heroes[0],u=heroUnit(h,{x:2,z:2});h.weapon=2;h.armor=2;h.charm='boots';const improved=heroUnit(h,{x:2,z:2});assert.equal(improved.power,u.power+10);assert.equal(improved.magic,u.magic+8);assert.equal(improved.maxHp,u.maxHp+28);assert.equal(improved.move,u.move+1);h.job='chronist';assert.equal(heroUnit(h,{x:2,z:2}).speed,JOBS.chronist.speed);
});
test('secondary disciplines expose learned skills without granting unlearned ones',()=>{
 const b=fresh(),u=b.active;assert.ok(b.skills(u).some(s=>s.id==='mend'));assert.equal(b.skills(u).some(s=>s.id==='raise'),false);u.learned.push('raise');assert.ok(b.skills(u).some(s=>s.id==='raise'));u.secondary='ranger';assert.equal(b.skills(u).some(s=>s.id==='mend'),false);
});
test('round-trip saves retain active battles and reject damaged records',()=>{
 const c=newCampaign();c.battle=createBattle(c,0);const roundtrip=JSON.parse(JSON.stringify(c));assert.ok(validSave(roundtrip));assert.equal(JSON.stringify(roundtrip),JSON.stringify(c));assert.equal(validSave({...c,heroes:[]}),false);assert.equal(validSave({...c,formation:['rowan','rowan','iona','pip']}),false);assert.equal(validSave({...c,unlocked:6}),false);
});
test('save validation rejects malformed battle units, supplies, jobs and active turns',()=>{
 const c=newCampaign();c.battle=createBattle(c,0);const copy=()=>JSON.parse(JSON.stringify(c)) as Campaign;
 const a=copy();a.battle!.active='missing';assert.equal(validSave(a),false);
 const b=copy();b.battle!.units[0].hp=99999;assert.equal(validSave(b),false);
 const d=copy();d.items={} as typeof d.items;assert.equal(validSave(d),false);
 const e=copy();e.heroes[0].job='toString' as typeof e.heroes[0]['job'];assert.equal(validSave(e),false);
 const f=copy();f.battle!.casts=[{caster:'missing',skill:'ember',target:{x:5,z:5},remaining:3}];assert.equal(validSave(f),false);
});
test('a charged revival cannot create two living units on the same tile',()=>{
 const b=fresh(),caster=b.state.units[3],down=b.state.units[0],occupant=b.state.units[1];b.state.active=caster.id;caster.x=4;caster.z=8;down.x=4;down.z=7;down.hp=0;down.fallenAt=0;caster.mp=30;
 assert.ok(b.act('raise',down));occupant.x=down.x;occupant.z=down.z;b.state.units.forEach(u=>{if(u.id!==caster.id)u.ct=0;});b.endTurn();assert.equal(down.hp,0);assert.ok(b.state.log.some(l=>l.includes('tile is occupied')));
});
test('turn forecasts follow discrete CT ticks without changing the battle',()=>{
 const b=fresh(),before=structuredClone(b.state),forecast=b.forecast(7).map(u=>u.id);assert.deepEqual(b.state,before);const actual=[b.active.id];for(let i=0;i<6;i++){b.state.moved=true;b.state.acted=true;b.endTurn();actual.push(b.active.id);}assert.deepEqual(forecast,actual);
});
test('restoration previews use their fixed recovery value',()=>{
 const b=fresh();assert.equal(b.damage(b.active,b.active,SKILLS.ether),28);assert.equal(b.damage(b.active,b.active,SKILLS.chakra),25);
});

function prepare(c:Campaign){
 for(const h of c.heroes){for(const id of [...JOBS[h.job].skills].reverse()){const s=SKILLS[id];if(!h.learned.includes(id)&&h.jp>=s.jp){h.jp-=s.jp;h.learned.push(id);}}}
 for(let tier=1;tier<=3;tier++)for(const h of [c.heroes[2],c.heroes[3],c.heroes[0],c.heroes[1]]){if(h.weapon<tier&&c.crowns>=tier*120){c.crowns-=tier*120;h.weapon=tier;}}
 for(const h of c.heroes){const cost=(h.armor+1)*100;if(h.armor<3&&c.crowns>=cost){c.crowns-=cost;h.armor++;}}
}
function play(c:Campaign,mission:number){const b=new Battle(createBattle(c,mission));let turns=0;while(!b.state.outcome&&turns++<600){const plan=chooseTactic(b);if(key(plan.destination)!==key(b.active))assert.ok(b.move(plan.destination));if(plan.skill&&plan.target)assert.ok(b.act(plan.skill,plan.target));if(!b.state.outcome){const t=b.state.units.filter(t=>t.hp>0&&t.team!==b.active.team).sort((a,z)=>distance(a,b.active)-distance(z,b.active))[0];b.endTurn(t?facingToward(b.active,t):b.active.facing);}b.events=[];for(const u of b.state.units){assert.ok(u.hp>=0&&u.hp<=u.maxHp);assert.ok(u.mp>=0&&u.mp<=u.maxMp);}assert.equal(new Set(b.state.units.filter(u=>u.hp>0).map(key)).size,b.state.units.filter(u=>u.hp>0).length,'living units never overlap');}assert.ok(b.state.outcome,'battle must terminate');return b;}
test('complete tactical campaign is winnable through legal battles, training and upgrades',()=>{
 const c=newCampaign();const route:{mission:number;turns:number;result:string|null}[]=[];
 for(let m=0;m<5;m++){
   let victory=false;for(let attempt=0;attempt<5&&!victory;attempt++){
     prepare(c);const b=play(c,m);route.push({mission:m,turns:b.state.turn,result:b.state.outcome});
     if(b.state.outcome==='victory'){settleBattle(c,b.state);victory=true;}
     else{assert.ok(m>0,'opening battle is beatable without grinding');const training=play(c,0);assert.equal(training.state.outcome,'victory');settleBattle(c,training.state);}
   }
   assert.ok(victory,`Chapter ${m+1}: ${JSON.stringify(route)}`);assert.ok(validSave(c));
 }
 assert.equal(c.finished,true);assert.deepEqual(c.cleared,[0,1,2,3,4]);assert.equal(c.battle,null);console.log('Verified tactical route:',JSON.stringify(route));
});
