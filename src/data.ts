export type JobId = 'squire' | 'knight' | 'ranger' | 'mage' | 'cleric' | 'monk' | 'chronist';
export type Team = 'ally' | 'enemy';
export type Direction = 'north' | 'east' | 'south' | 'west';
export type Status = 'guard' | 'poison' | 'haste' | 'slow' | 'power';
export type Pos = { x: number; z: number };
export interface Job { name: string; subtitle: string; hp: number; mp: number; power: number; magic: number; defense: number; speed: number; move: number; jump: number; range: number; color: string; icon: string; skills: string[]; level: number; }
export const JOBS: Record<JobId, Job> = {
  squire: { name: 'Squire', subtitle: 'Every legend starts somewhere.', hp: 110, mp: 28, power: 27, magic: 18, defense: 6, speed: 11, move: 4, jump: 1, range: 1, color: '#749bad', icon: 'sword', skills: ['rally', 'stone', 'cleave'], level: 1 },
  knight: { name: 'Vanguard', subtitle: 'A shield between the world and you.', hp: 135, mp: 24, power: 31, magic: 12, defense: 10, speed: 9, move: 3, jump: 1, range: 1, color: '#ac945f', icon: 'shield', skills: ['rend', 'challenge', 'cleave'], level: 1 },
  ranger: { name: 'Ranger', subtitle: 'The high ground is home.', hp: 95, mp: 30, power: 25, magic: 14, defense: 4, speed: 12, move: 4, jump: 2, range: 4, color: '#84a385', icon: 'bow', skills: ['aim', 'venom', 'volley'], level: 1 },
  mage: { name: 'Embermage', subtitle: 'A little spark. A very big problem.', hp: 85, mp: 65, power: 14, magic: 33, defense: 3, speed: 10, move: 3, jump: 1, range: 1, color: '#b28baa', icon: 'flame', skills: ['ember', 'frost', 'inferno'], level: 1 },
  cleric: { name: 'Mender', subtitle: 'Stitching hope into broken things.', hp: 95, mp: 62, power: 16, magic: 29, defense: 4, speed: 11, move: 3, jump: 1, range: 1, color: '#c9bda0', icon: 'spark', skills: ['mend', 'raise', 'sanctuary'], level: 1 },
  monk: { name: 'Pugilist', subtitle: 'Strong convictions. Stronger fists.', hp: 125, mp: 35, power: 33, magic: 22, defense: 5, speed: 12, move: 4, jump: 2, range: 1, color: '#c99475', icon: 'fist', skills: ['wave', 'chakra', 'revive'], level: 2 },
  chronist: { name: 'Chronist', subtitle: 'Always a little ahead of the times.', hp: 88, mp: 70, power: 15, magic: 30, defense: 3, speed: 12, move: 3, jump: 2, range: 1, color: '#9e9fc7', icon: 'clock', skills: ['haste', 'slow', 'comet'], level: 3 },
};
export interface Skill { id: string; name: string; description: string; icon: string; mp: number; range: number; radius: number; power: number; magic?: boolean; charge: number; target: 'enemy' | 'ally' | 'down' | 'self' | 'any'; effect?: Status | 'heal' | 'revive' | 'chakra' | 'rend'; jp: number; item?: 'potion' | 'feather' | 'ether'; }
export const SKILLS: Record<string, Skill> = Object.fromEntries(([
  { id: 'attack', name: 'Attack', description: 'Strike with your weapon. Flanks and high ground deal more damage.', icon: 'sword', mp: 0, range: 0, radius: 0, power: 1, charge: 0, target: 'enemy', jp: 0 },
  { id: 'rally', name: 'Rally', description: 'Bolster an ally: +25% physical power for three turns.', icon: 'flag', mp: 4, range: 3, radius: 0, power: 0, charge: 0, target: 'ally', effect: 'power', jp: 0 },
  { id: 'stone', name: 'Stone Toss', description: 'A reliable ranged strike. Ignores facing.', icon: 'diamond', mp: 0, range: 3, radius: 0, power: .65, charge: 0, target: 'enemy', jp: 40 },
  { id: 'cleave', name: 'Crescent Blade', description: 'Sweep across adjacent enemies around a target.', icon: 'sword', mp: 9, range: 1, radius: 1, power: 1.15, charge: 0, target: 'enemy', jp: 100 },
  { id: 'rend', name: 'Armor Rend', description: 'A heavy strike that lowers defense for the battle.', icon: 'shield', mp: 5, range: 1, radius: 0, power: 1.05, charge: 0, target: 'enemy', effect: 'rend', jp: 0 },
  { id: 'challenge', name: 'Iron Oath', description: 'Guard and empower yourself for three turns.', icon: 'shield', mp: 6, range: 0, radius: 0, power: 0, charge: 0, target: 'self', effect: 'guard', jp: 60 },
  { id: 'aim', name: 'Trueflight', description: 'A patient, powerful shot. Resolves after three clock ticks.', icon: 'bow', mp: 5, range: 5, radius: 0, power: 1.5, charge: 3, target: 'enemy', jp: 0 },
  { id: 'venom', name: 'Briar Arrow', description: 'Poisons an enemy for three of their turns.', icon: 'leaf', mp: 7, range: 4, radius: 0, power: .85, charge: 0, target: 'enemy', effect: 'poison', jp: 60 },
  { id: 'volley', name: 'Arrow Rain', description: 'A shower of arrows over a small area.', icon: 'bow', mp: 12, range: 5, radius: 1, power: 1.25, charge: 4, target: 'enemy', jp: 110 },
  { id: 'ember', name: 'Ember', description: 'A burst of fire that hits everyone in a cross. Watch your allies.', icon: 'flame', mp: 9, range: 4, radius: 1, power: 1.3, magic: true, charge: 3, target: 'any', jp: 0 },
  { id: 'frost', name: 'Winterbind', description: 'Chill a foe and slow their charge time for three turns.', icon: 'diamond', mp: 10, range: 4, radius: 0, power: 1.1, magic: true, charge: 2, target: 'enemy', effect: 'slow', jp: 60 },
  { id: 'inferno', name: 'Cinderfall', description: 'A great flame. High damage; hits allies in its cross too.', icon: 'flame', mp: 19, range: 5, radius: 1, power: 2, magic: true, charge: 5, target: 'any', jp: 120 },
  { id: 'mend', name: 'Mend', description: 'Restore an ally’s HP with a soft light.', icon: 'spark', mp: 7, range: 4, radius: 0, power: 1.7, magic: true, charge: 2, target: 'ally', effect: 'heal', jp: 0 },
  { id: 'raise', name: 'Rekindle', description: 'Return a fallen ally to battle with half their HP.', icon: 'feather', mp: 14, range: 4, radius: 0, power: .5, magic: true, charge: 3, target: 'down', effect: 'revive', jp: 65 },
  { id: 'sanctuary', name: 'Sanctuary', description: 'Restore allies in a cross and cleanse poison and slow.', icon: 'spark', mp: 16, range: 4, radius: 1, power: 1.6, magic: true, charge: 3, target: 'ally', effect: 'heal', jp: 110 },
  { id: 'wave', name: 'Earthwake', description: 'An immediate shockwave that ignores facing.', icon: 'fist', mp: 5, range: 3, radius: 0, power: 1.2, charge: 0, target: 'enemy', jp: 0 },
  { id: 'chakra', name: 'Stillwater', description: 'Restore your HP and MP, and cleanse poison.', icon: 'spark', mp: 0, range: 0, radius: 0, power: 25, charge: 0, target: 'self', effect: 'chakra', jp: 65 },
  { id: 'revive', name: 'Second Wind', description: 'Revive an adjacent fallen ally with 40% HP.', icon: 'feather', mp: 7, range: 1, radius: 0, power: .4, charge: 0, target: 'down', effect: 'revive', jp: 100 },
  { id: 'haste', name: 'Borrowed Time', description: 'Hasten an ally’s charge time for three turns.', icon: 'clock', mp: 8, range: 4, radius: 0, power: 0, charge: 1, target: 'ally', effect: 'haste', jp: 0 },
  { id: 'slow', name: 'Lost Hour', description: 'Slow an enemy’s charge time for three turns.', icon: 'clock', mp: 8, range: 4, radius: 0, power: 0, charge: 1, target: 'enemy', effect: 'slow', jp: 60 },
  { id: 'comet', name: 'Little Catastrophe', description: 'Call down a star. Ignores defense; hits allies in its cross.', icon: 'star', mp: 22, range: 5, radius: 1, power: 2.4, magic: true, charge: 6, target: 'any', jp: 120 },
  { id: 'potion', name: 'Tonic', description: 'Instantly restore 55 HP to a nearby ally.', icon: 'potion', mp: 0, range: 2, radius: 0, power: 55, charge: 0, target: 'ally', effect: 'heal', jp: 0, item: 'potion' },
  { id: 'feather', name: 'Dawn Feather', description: 'Instantly revive an adjacent fallen ally with half HP.', icon: 'feather', mp: 0, range: 1, radius: 0, power: .5, charge: 0, target: 'down', effect: 'revive', jp: 0, item: 'feather' },
  { id: 'ether', name: 'Moonwater', description: 'Restore 28 MP and 28 HP to yourself.', icon: 'potion', mp: 0, range: 0, radius: 0, power: 28, charge: 0, target: 'self', effect: 'chakra', jp: 0, item: 'ether' },
] satisfies Skill[]).map(s => [s.id, s]));

export interface Hero { id: string; name: string; job: JobId; secondary: JobId; level: number; xp: number; jp: number; learned: string[]; weapon: number; armor: number; charm: 'none' | 'boots' | 'ward' | 'counter'; hair: string; skin: string; bio: string; }
export const NEW_HEROES: Hero[] = [
  { id: 'rowan', name: 'Rowan', job: 'squire', secondary: 'cleric', level: 1, xp: 0, jp: 60, learned: ['rally', 'mend', 'stone'], weapon: 0, armor: 0, charm: 'none', hair: '#b9a078', skin: '#d9b997', bio: 'A runaway squire with a stolen banner and inconvenient principles.' },
  { id: 'bryn', name: 'Bryn', job: 'knight', secondary: 'squire', level: 1, xp: 0, jp: 60, learned: ['rend', 'rally', 'challenge'], weapon: 0, armor: 0, charm: 'none', hair: '#655048', skin: '#b98060', bio: 'Once a royal guard. Still believes a shield should protect someone.' },
  { id: 'iona', name: 'Iona', job: 'mage', secondary: 'cleric', level: 1, xp: 0, jp: 60, learned: ['ember', 'mend', 'frost'], weapon: 0, armor: 0, charm: 'none', hair: '#d3bca0', skin: '#e1bd9a', bio: 'A bellmaker’s apprentice who found a much louder use for fire.' },
  { id: 'pip', name: 'Pip', job: 'ranger', secondary: 'cleric', level: 1, xp: 0, jp: 65, learned: ['aim', 'mend', 'raise', 'venom'], weapon: 0, armor: 0, charm: 'none', hair: '#a76b49', skin: '#ccaa80', bio: 'A rooftop courier. Knows every shortcut and most of the trouble.' },
];
export interface Tile extends Pos { h: number; terrain: 'stone' | 'roof' | 'grass' | 'water'; blocked?: boolean; prop?: 'fountain' | 'tree' | 'crate' | 'banner' | 'crystal'; }
export interface EnemySpec extends Pos { name: string; job: JobId; level: number; boss?: boolean; }
export interface Mission { id: number; title: string; location: string; subtitle: string; objective: string; intro: [string, string][]; outro: string; reward: number; theme: 'town' | 'garden' | 'bridge' | 'abbey' | 'citadel'; enemies: EnemySpec[]; spawn: Pos[]; }
export const MISSIONS: Mission[] = [
  { id: 0, title: 'The Bellwether Uprising', location: 'BELLWETHER · OLD QUARTER', subtitle: 'Some revolutions begin with a crown. Ours began with a bread cart.', objective: 'Defeat the Crown patrol', intro: [['Pip', 'They closed the granary. Again. Apparently hunger is a crime now.'], ['Bryn', 'Archers on the terraces. Stay together, take the stairs, and make every move count.'], ['Rowan', 'Then let’s give them something better to worry about.']], outro: 'The grain carts roll again. In the empty square, someone raises a blue ribbon. Then another. By evening, Bellwether has a new color.', reward: 180, theme: 'town', spawn: [{x:2,z:8},{x:3,z:8},{x:2,z:9},{x:4,z:9}], enemies: [{name:'Crownblade',job:'knight',level:1,x:5,z:4},{name:'Roofwatch',job:'ranger',level:1,x:1,z:3},{name:'Ash Acolyte',job:'mage',level:1,x:7,z:2},{name:'Taxguard',job:'squire',level:1,x:7,z:5}] },
  { id: 1, title: 'Roots of Rebellion', location: 'GREENHOLLOW · THE KING’S GARDEN', subtitle: 'Even a king’s garden grows wild at the edges.', objective: 'Break the garden blockade', intro: [['Iona', 'The apothecary is beyond the garden. If we reach her, the wounded have a chance.'], ['Pip', 'The gardeners have rather enthusiastically sharpened their tools.']], outro: 'Under the old trees, the apothecary opens her door. Healing is a quiet kind of rebellion. Your company learns that strength can take many forms.', reward: 240, theme: 'garden', spawn: [{x:2,z:8},{x:3,z:8},{x:2,z:9},{x:4,z:9}], enemies: [{name:'Thornhand',job:'monk',level:2,x:4,z:4},{name:'Greencloak',job:'ranger',level:2,x:1,z:2},{name:'Crownblade',job:'knight',level:2,x:7,z:5},{name:'Briar Witch',job:'mage',level:2,x:7,z:2},{name:'Field Mender',job:'cleric',level:2,x:6,z:3}] },
  { id: 2, title: 'A Bridge Too Little', location: 'SAINT’S CROSSING · RIVER WARD', subtitle: 'Four rebels. One bridge. A surprisingly large toll.', objective: 'Defeat Captain Voss and his patrol', intro: [['Bryn', 'Voss. We served together. He used to give his pay to the widows.'], ['Rowan', 'Then maybe he’ll listen.'], ['Bryn', 'He has his orders. We have our people.']], outro: 'Voss drops his sword. Bryn offers a hand. Behind them, the bridge fills with families, not soldiers. The capital can no longer ignore four small rebels.', reward: 300, theme: 'bridge', spawn: [{x:3,z:8},{x:4,z:8},{x:3,z:9},{x:5,z:9}], enemies: [{name:'Captain Voss',job:'knight',level:3,x:5,z:2,boss:true},{name:'Toll Archer',job:'ranger',level:3,x:2,z:3},{name:'Riverwatch',job:'ranger',level:3,x:7,z:3},{name:'Crown Mender',job:'cleric',level:3,x:4,z:1},{name:'Iron Fist',job:'monk',level:3,x:5,z:5}] },
  { id: 3, title: 'The Thirteenth Bell', location: 'EMBER ABBEY · CLOISTER COURT', subtitle: 'An old abbey. An older secret. An extremely unhelpful prophecy.', objective: 'Silence the abbey’s wardens', intro: [['Iona', 'The abbey bells aren’t ringing. They’re counting down.'], ['Pip', 'I liked the bread-cart part of this rebellion better.'], ['Rowan', 'The Regent is feeding the bell with stolen aether. We break the circle here.']], outro: 'The thirteenth bell cracks. In its silence, the company hears the city singing. The Regent’s borrowed eternity is ending. Dawn is close.', reward: 360, theme: 'abbey', spawn: [{x:2,z:8},{x:3,z:8},{x:2,z:9},{x:4,z:9}], enemies: [{name:'Hourkeeper',job:'chronist',level:4,x:5,z:1,boss:true},{name:'Cinder Cantor',job:'mage',level:4,x:1,z:3},{name:'Dusk Cantor',job:'mage',level:4,x:8,z:3},{name:'Abbey Shield',job:'knight',level:4,x:4,z:5},{name:'Silent Brother',job:'monk',level:4,x:6,z:5},{name:'Bell Mender',job:'cleric',level:4,x:6,z:2}] },
  { id: 4, title: 'A Crown of Cinders', location: 'THE PALE CITADEL · DAWN', subtitle: 'A kingdom is not the one who wears its crown.', objective: 'Defeat the Regent and his last guard', intro: [['Regent', 'Do you imagine four little sparks can change a kingdom?'], ['Iona', 'Oh. He really should not have said sparks.'], ['Rowan', 'We didn’t come for your crown. We came to open the gates.']], outro: 'The crown falls, not onto another head, but into the ash. Bellwether opens its gates. Bryn plants a garden. Iona recasts the bells. Pip raises the price of deliveries. And Rowan finally returns that banner. Some kingdoms are saved by great heroes. This one was saved by a small company that stayed together.', reward: 500, theme: 'citadel', spawn: [{x:2,z:8},{x:3,z:8},{x:2,z:9},{x:4,z:9}], enemies: [{name:'The Pale Regent',job:'chronist',level:5,x:5,z:1,boss:true},{name:'Kingsguard',job:'knight',level:5,x:3,z:4},{name:'Queensguard',job:'knight',level:5,x:6,z:4},{name:'Crownfire',job:'mage',level:5,x:1,z:2},{name:'Last Arrow',job:'ranger',level:5,x:8,z:2},{name:'Court Mender',job:'cleric',level:5,x:6,z:1}] },
];
export function makeMap(theme: Mission['theme']): Tile[] {
  const tiles: Tile[] = [];
  for (let z=0;z<10;z++) for (let x=0;x<10;x++) {
    let h=0; let terrain: Tile['terrain']='stone'; let blocked=false; let prop: Tile['prop'];
    if (x<=2 && z>=1 && z<=5) { h=2; terrain='roof'; }
    if (x===3 && z>=2 && z<=5) h=1;
    if (x>=7 && z<=3) {h=2;terrain='roof';}
    if (x===6 && z<=3) h=1;
    if (z===0 && x>=3 && x<=6) h=1;
    if (x===5 && z===5) { blocked=true;prop='fountain'; }
    if ((x===0&&z===8)||(x===9&&z===6)) {blocked=true;prop='tree';}
    if ((x===8&&z===8)||(x===0&&z===6)) {blocked=true;prop='crate';}
    if (theme==='garden') { terrain=h>0?'grass':((x+z)%4===0?'stone':'grass'); if(x===5&&z===5)prop='tree'; }
    if (theme==='bridge') {
      h=(z>=3&&z<=6)?1:0;terrain='stone';blocked=false;prop=undefined;
      if(z>=3&&z<=6&&(x<3||x>6)) { terrain='water';h=-1;blocked=true; }
      if ((x===2||x===7)&&z===3){terrain='stone';h=2;blocked=false;}
      if((x===2||x===7)&&z===2)h=1;
    }
    if(theme==='abbey'||theme==='citadel') {
      terrain='stone'; if(z<=2&&x>=3&&x<=6)h=2; if(z===3&&x>=3&&x<=6)h=1;
      if(x===5&&z===5)prop='crystal';
    }
    tiles.push({x,z,h,terrain,blocked,prop});
  }
  return tiles;
}
