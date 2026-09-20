import type * as Three from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { JOBS, NEW_HEROES, MISSIONS } from './data';
import type { Pos, Tile } from './data';
import type { Battle, Unit, BattleEvent, Campaign } from './engine';
type Renderer=Three.WebGLRenderer|WebGPURenderer;
const TEAM={ally:'#77b8c0',enemy:'#d8846e'};

export class Battlefield {
  T!:typeof Three;renderer!:Renderer;scene!:Three.Scene;camera!:Three.OrthographicCamera;
  mode='';ready=false;angle=Math.PI/4;targetAngle=Math.PI/4;zoom=1;
  private environment!:Three.Group;private figures!:Three.Group;private overlays!:Three.Group;
  private unitMeshes=new Map<string,Three.Group>();private labels=new Map<string,HTMLElement>();
  private tileMeshes:Three.Mesh[]=[];private materials=new Map<string,Three.MeshStandardMaterial>();
  private particles!:Three.Points;private marker!:Three.Mesh;private battle?:Battle;
  private resizeObserver?:ResizeObserver;private animations:{id:string;path:Pos[];start:number;duration:number}[]=[];
  private frame=0;private frameTime=0;private renderScene?:()=>void;
  private mergeGeometry?:typeof import('three/addons/utils/BufferGeometryUtils.js').mergeGeometries;
  private bursts:{mesh:Three.Group;start:number;color:string;up:boolean}[]=[];
  private settings:Campaign['settings'];private hoverKey='';private pointers=new Map<number,{x:number;y:number}>();private down?:{x:number;y:number};private pinch=0;
  private softwareRenderer=false;
  private lowQuality(){return this.settings.quality==='low'||(this.settings.quality==='auto'&&this.softwareRenderer);}
  get qualityMode(){return this.lowQuality()?'low':'full';}
  private detectSoftware(gl:WebGLRenderingContext|WebGL2RenderingContext){const info=gl.getExtension('WEBGL_debug_renderer_info');if(info)this.softwareRenderer=/swiftshader|llvmpipe|software|softpipe/i.test(String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)));}
  onPick:(pos:Pos)=>void=()=>{};onHover:(pos:Pos|null)=>void=()=>{};
  constructor(private host:HTMLElement,private labelHost:HTMLElement,settings:Campaign['settings']){this.settings=settings;}
  async init(){
    const requested=new URLSearchParams(location.search).get('renderer');
    // Avoid constructing a WebGL2 backend at all on WebGL1-only browsers.
    // Its internal extension initialization otherwise produces an unhandled error.
    const probe=document.createElement('canvas'),webgl2=probe.getContext('webgl2');
    const supportsWebGL2=!!webgl2;if(webgl2)this.detectSoftware(webgl2);webgl2?.getExtension('WEBGL_lose_context')?.loseContext();
    const modern=async(forceWebGL:boolean)=>{
      const module=await import('three/webgpu');const r=new module.WebGPURenderer({antialias:true,alpha:true,forceWebGL,powerPreference:'high-performance'});
      try{await r.init();}catch(e){r.dispose();throw e;}
      this.T=module as unknown as typeof Three;this.renderer=r;this.mode=(r.backend as unknown as {isWebGPUBackend?:boolean}).isWebGPUBackend?'WebGPU':'WebGL2';
    };
    try{if(requested==='webgl1'||(!navigator.gpu&&!supportsWebGL2)||(requested==='webgl2'&&!supportsWebGL2))throw new Error('Compatibility required');await modern(requested==='webgl2');}
    catch {
      try{if(requested==='webgl1'||!supportsWebGL2)throw new Error('Compatibility required');await modern(true);}
      catch{const T=await import('three-legacy');const canvas=document.createElement('canvas');const context=canvas.getContext('webgl',{alpha:true,antialias:true});if(!context)throw new Error('This browser could not start WebGPU or WebGL. Please enable hardware acceleration and reload.');this.detectSoftware(context);this.T=T;this.renderer=new T.WebGLRenderer({canvas,context,antialias:true,alpha:true});this.mode='WebGL1';}
    }
    const T=this.T;this.renderer.setClearColor(0x1c262d,0);this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
    this.renderer.shadowMap.enabled=!this.lowQuality();this.renderer.shadowMap.type=this.mode==='WebGL1'?T.PCFSoftShadowMap:T.PCFShadowMap;
    this.host.prepend(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','Interactive isometric battlefield. Select a tile to move or target.');
    this.scene=new T.Scene();this.camera=new T.OrthographicCamera(-9,9,7,-7,.1,100);
    this.environment=new T.Group();this.figures=new T.Group();this.overlays=new T.Group();this.scene.add(this.environment,this.figures,this.overlays);
    this.scene.add(new T.HemisphereLight(0xc5d8e6,0x534735,2.8));
    const sun=new T.DirectionalLight(0xffdfac,4);sun.position.set(-5,14,7);sun.castShadow=true;const shadowSize=innerWidth<800?1024:2048;sun.shadow.mapSize.set(shadowSize,shadowSize);sun.shadow.camera.left=-12;sun.shadow.camera.right=12;sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;sun.shadow.normalBias=.05;sun.shadow.bias=-.0002;this.scene.add(sun);
    const rim=new T.DirectionalLight(0x9cc8e4,1.4);rim.position.set(7,8,-7);this.scene.add(rim);
    this.marker=new T.Mesh(new T.RingGeometry(.42,.48,4),new T.MeshBasicMaterial({color:0xf2d69a,transparent:true,opacity:.9,side:T.DoubleSide,depthWrite:false}));this.marker.rotation.x=-Math.PI/2;this.marker.rotation.z=Math.PI/4;this.scene.add(this.marker);
    const positions=new Float32Array(70*3);for(let i=0;i<70;i++){positions[i*3]=Math.sin(i*137.5)*8;positions[i*3+1]=.5+(i%17)*.26;positions[i*3+2]=Math.cos(i*54.3)*8;}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));this.particles=new T.Points(g,new T.PointsMaterial({color:0xf8d49a,size:.026,transparent:true,opacity:.55,depthWrite:false}));this.scene.add(this.particles);
    if(this.mode==='WebGPU'&&!this.lowQuality()&&(innerWidth>=900||this.settings.quality==='high')){
      const [{RenderPipeline},{pass,vec4},{bloom}]=await Promise.all([import('three/webgpu'),import('three/tsl'),import('three/addons/tsl/display/BloomNode.js')]);
      const pipe=new RenderPipeline(this.renderer as WebGPURenderer),scenePass=pass(this.scene,this.camera),color=scenePass.getTextureNode('output');pipe.outputNode=vec4(color.rgb.add(bloom(color,.14,.3,1.4).rgb),color.a);this.renderScene=()=>pipe.render();
    }
    this.bind();this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.host);this.resize();this.ready=true;this.loop();
  }
  private mat(color:string,emissive=false){
    const key=color+(emissive?'e':'');let material=this.materials.get(key);if(!material){material=new this.T.MeshStandardMaterial({color,roughness:.9,metalness:0,flatShading:true,emissive:emissive?color:'#000000',emissiveIntensity:emissive?1.2:0});this.materials.set(key,material);}return material;
  }
  private mesh(geo:Three.BufferGeometry,color:string,parent:Three.Object3D,x:number,y:number,z:number,emissive=false){const m=new this.T.Mesh(geo,this.mat(color,emissive));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  private box(parent:Three.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,color:string){return this.mesh(new this.T.BoxGeometry(w,h,d),color,parent,x,y,z);}
  private cylinder(parent:Three.Object3D,x:number,y:number,z:number,rt:number,rb:number,h:number,color:string,n=8){return this.mesh(new this.T.CylinderGeometry(rt,rb,h,n),color,parent,x,y,z);}
  height(p:Pos){return .26+(this.battle?.tile(p)?.h??0)*.55;}
  async setBattle(battle:Battle){
    this.battle=battle;this.animations=[];this.clearGroup(this.environment);this.clearGroup(this.figures);this.clearGroup(this.overlays);this.tileMeshes=[];this.unitMeshes.clear();this.labels.forEach(l=>l.remove());this.labels.clear();
    const T=this.T,theme=MISSIONS[battle.state.mission].theme;
    this.box(this.environment,0,theme==='bridge'?-.75:-.5,0,10.2,theme==='bridge'?.65:.8,10.2,'#514b40');this.box(this.environment,0,theme==='bridge'?-.39:-.08,0,10.3,theme==='bridge'?.08:.14,10.3,'#b5a584');
    for(const tile of battle.state.tiles){
      const x=tile.x-4.5,z=tile.z-4.5,y=this.height(tile);
      const colors=tile.terrain==='roof'?['#b29479','#bda083','#af9076']:tile.terrain==='grass'?['#75856b','#899577','#7e8f73']:tile.terrain==='water'?['#45757c','#507e85']:['#a99f88','#b4aa93','#bcb19a','#a69d88','#b0a58d'];
      const color=colors[(tile.x*7+tile.z*13)%colors.length];
      const bottom=theme==='bridge'?-.38:-.25;
      const m=this.box(this.environment,x,(y+bottom)/2,z,.975,y-bottom,.975,color);m.userData.tile=tile;this.tileMeshes.push(m);
      if(tile.terrain==='water'){const water=this.mat(color);water.roughness=.3;water.metalness=.15;}
      if(tile.h>0&&tile.terrain!=='water'){
        // Terraced masonry: every raised tile remains a usable square.
        if(battle.tile({x:tile.x,z:tile.z+1})?.h!==tile.h){this.box(this.environment,x,y-.5,z+.49,.72,.07,.02,'#655e50');if(tile.h>1)this.box(this.environment,x,y-.68,z+.5,.3,.32,.025,'#514a40');}
        if(tile.terrain==='roof')this.box(this.environment,x,y+.025,z,.94,.04,.94,'#ba9b81');
      }
      if(tile.prop==='fountain')this.fountain(x,y,z);
      if(tile.prop==='tree')this.tree(x,y,z);
      if(tile.prop==='crate'){this.box(this.environment,x,y+.24,z,.58,.48,.56,'#927350');this.box(this.environment,x,y+.25,z,.62,.06,.59,'#544636');}
      if(tile.prop==='crystal'){this.cylinder(this.environment,x,y+.15,z,.4,.46,.3,'#77787c');const crystal=this.mesh(new T.OctahedronGeometry(.45),theme==='citadel'?'#d9a786':'#9bc9c6',this.environment,x,y+.75,z,true);crystal.scale.y=1.8;}
    }
    // Original miniature skyline, placed beyond the playable terrace.
    if(theme!=='bridge'){
      this.building(-3.65,-5.25,2.1,2.3,2.0,'#a48b73','#715459');
      this.building(3.6,-5.3,2.3,2.6,2.0,'#b2a085','#626f76');
      this.chapel(.1,-5.5,theme==='citadel'?1.2:1);
      this.building(-5.5,-1.2,1.5,1.9,2.0,'#b6a084','#77615a');
      this.tree(5.2,.26,-3.5);this.tree(-5.1,.26,3.2);
    }else{
      this.chapel(0,-5.8,.85);this.tree(-3,.26,3);this.tree(4,.26,-4);this.building(-4,-4,1.7,2,1.8,'#b2a085','#68727c');
      for(const x of [-1.85,1.85])for(let z=-1.5;z<=1.5;z++){this.box(this.environment,x,1.03,z,.13,.58,.15,'#b9af98');this.box(this.environment,x,1.3,z,.15,.13,1.05,'#b9af98');}
    }
    for(const [x,z] of [[-4.7,1.3],[4.7,1.3],[2.0,-4.7]])this.banner(x,.4,z);
    // Batch static environment geometry by material to reduce mobile draw calls.
    this.environment.updateMatrixWorld(true);this.tileMeshes.forEach(m=>{m.updateMatrixWorld(true);});
    const {mergeGeometries}=await import('three/addons/utils/BufferGeometryUtils.js');this.mergeGeometry=mergeGeometries;
    const grouped=new Map<Three.Material,Three.BufferGeometry[]>();this.environment.traverse(o=>{if(o instanceof T.Mesh){const m=o as Three.Mesh;const material=m.material as Three.Material;const list=grouped.get(material)??[];list.push(m.geometry.clone().applyMatrix4(m.matrixWorld));grouped.set(material,list);}});
    this.environment.clear();for(const [mat,geos]of grouped){const merged=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());if(merged){const mesh=new T.Mesh(merged,mat);mesh.castShadow=true;mesh.receiveShadow=true;this.environment.add(mesh);}}
    for(const unit of battle.state.units)this.makeUnit(unit);
    this.sync();this.resize();
  }
  private building(x:number,z:number,w:number,h:number,d:number,wall:string,roof:string){
    const e=this.environment;this.box(e,x,h/2+.25,z,w,h,d,wall);this.box(e,x,.55,z,w+.06,.12,d+.06,'#887962');this.box(e,x,h-.05,z,w+.12,.12,d+.12,'#655a4d');
    const g=new this.T.CylinderGeometry(0,1,1,4);g.rotateY(Math.PI/4);const r=this.mesh(g,roof,e,x,h+.82,z);r.scale.set(w*.82,1.1,d*.85);
    for(const dx of [-.28,.28]){this.box(e,x+w*dx,h*.62,z+d/2+.015,.28,.5,.04,'#4c4a42');this.box(e,x+w*dx,h*.62,z+d/2+.04,.22,.39,.02,'#dfbb76');this.box(e,x+w*dx,h*.62,z+d/2+.06,.035,.42,.02,'#75634c');}
    this.box(e,x,h+.9,z-.2,.28,.85,.3,'#a48f75');
  }
  private chapel(x:number,z:number,scale:number){
    const parent=new this.T.Group();this.environment.add(parent);parent.position.set(x,.22,z);parent.scale.setScalar(scale);
    this.box(parent,0,1.45,0,2.35,2.9,1.6,'#c1b193');this.box(parent,0,.18,1,2.6,.22,.8,'#a2947c');
    const roof=this.mesh(new this.T.CylinderGeometry(0,1,1,4),'#657782',parent,0,3.35,0);roof.rotation.y=Math.PI/4;roof.scale.set(1.8,1.1,1.2);
    for(const tx of [-1.35,1.35]){this.box(parent,tx,1.95,0,.65,3.9,.8,'#baab90');this.box(parent,tx,3.6,0,.8,.16,.95,'#877c68');this.cylinder(parent,tx,4.25,0,0,.58,1.2,'#627581',4);this.box(parent,tx,3.35,.415,.2,.45,.04,'#514c43');}
    this.box(parent,0,.65,.83,.65,1.15,.04,'#655749');const arch=this.mesh(new this.T.CircleGeometry(.33,12),'#655749',parent,0,1.22,.85);arch.rotation.z=0;
    const rose=this.mesh(new this.T.TorusGeometry(.4,.065,4,12),'#b09468',parent,0,2.18,.84);const glass=this.mesh(new this.T.CircleGeometry(.35,12),'#ddbd77',parent,0,2.18,.835,true);glass.castShadow=false;rose.castShadow=false;
    for(let i=0;i<6;i++){const spoke=this.box(parent,0,2.18,.875,.032,.74,.02,'#948062');spoke.rotation.z=i*Math.PI/3;}
    this.box(parent,0,3.99,0,.09,.5,.09,'#c8b68c');this.box(parent,0,4.08,0,.35,.07,.09,'#c8b68c');
  }
  private tree(x:number,y:number,z:number){this.cylinder(this.environment,x,y+.45,z,.09,.15,.9,'#796751',5);for(const [dx,dy,dz,r]of [[0,1.2,0,.7],[-.35,.9,.1,.48],[.3,1,.2,.53],[.05,1.7,0,.43]])this.mesh(new this.T.IcosahedronGeometry(r,0),'#718873',this.environment,x+dx,y+dy,z+dz);}
  private fountain(x:number,y:number,z:number){this.cylinder(this.environment,x,y+.1,z,.64,.64,.2,'#bcb197');this.cylinder(this.environment,x,y+.22,z,.55,.55,.15,'#657e7c');this.cylinder(this.environment,x,y+.45,z,.12,.2,.55,'#bbae8f');this.cylinder(this.environment,x,y+.72,z,.4,.26,.16,'#c7b99b');this.cylinder(this.environment,x,y+.85,z,.07,.11,.22,'#c7b99b');}
  private banner(x:number,y:number,z:number){this.cylinder(this.environment,x,y+.8,z,.035,.04,1.6,'#655b48');this.box(this.environment,x+.2,y+1.2,z,.4,.65,.035,'#537d90');this.box(this.environment,x+.2,y+1.2,z+.025,.08,.24,.03,'#d6bf84');this.cylinder(this.environment,x,y+1.65,z,0,.07,.15,'#d6bf84',4);}
  private makeUnit(u:Unit){
    const T=this.T,g=new T.Group(),j=JOBS[u.job],hero=NEW_HEROES.find(h=>h.id===u.id),skin=hero?.skin??'#c5a184',hair=hero?.hair??'#665547',cloth=u.team==='enemy'?'#995f55':j.color;
    this.figures.add(g);this.unitMeshes.set(u.id,g);
    const ring=this.mesh(new T.CylinderGeometry(.31,.34,.055,16),TEAM[u.team],g,0,.04,0);ring.castShadow=false;
    this.box(g,-.11,.17,0,.16,.26,.2,'#4d4942');this.box(g,.11,.17,0,.16,.26,.2,'#4d4942');
    const body=this.cylinder(g,0,.47,0,.2,.26,.39,cloth,6);body.rotation.y=Math.PI/6;
    this.box(g,0,.39,0,.43,.055,.31,'#635644');this.box(g,0,.4,.17,.065,.065,.03,'#c6b17d');
    this.box(g,0,.81,0,.35,.35,.32,skin);this.box(g,0,1.01,-.015,.38,.13,.35,hair);this.box(g,0,.87,-.17,.37,.29,.07,hair);
    this.box(g,-.085,.84,.166,.035,.045,.013,'#403c36');this.box(g,.085,.84,.166,.035,.045,.013,'#403c36');
    this.box(g,-.28,.54,0,.15,.29,.2,cloth);this.box(g,.28,.54,0,.15,.29,.2,cloth);this.box(g,-.28,.37,.02,.14,.12,.16,skin);this.box(g,.28,.37,.02,.14,.12,.16,skin);
    if(['mage','chronist'].includes(u.job)){
      this.cylinder(g,0,1.05,0,.34,.34,.07,'#555174',8);const hat=this.cylinder(g,0,1.29,0,.015,.25,.45,u.job==='mage'?'#6f5c7c':'#68769a',6);hat.rotation.z=-.13;
      this.cylinder(g,.34,.53,.11,.03,.035,1,'#7a654a',5);this.mesh(new T.OctahedronGeometry(.11),'#e4bf82',g,.34,1.1,.11,true);
    }else if(u.job==='cleric'){
      this.box(g,0,1.03,0,.42,.17,.4,'#d2c9ad');this.box(g,0,.79,-.18,.4,.34,.07,'#c5bba1');this.cylinder(g,.35,.58,.1,.025,.03,1,'#c1b384');this.box(g,.35,1,.1,.22,.05,.055,'#d6c68e');
    }else if(u.job==='knight'){
      this.box(g,0,1.015,0,.43,.19,.39,'#9fadb0');this.box(g,0,1.16,-.05,.09,.19,.23,u.team==='enemy'?'#915348':'#576f82');this.box(g,-.31,.48,.18,.31,.48,.08,'#acb6b5');this.box(g,-.31,.49,.228,.09,.32,.02,'#b59a62');this.sword(g);
    }else if(u.job==='ranger'){
      this.cylinder(g,0,1.04,0,.05,.28,.25,cloth,5);const bow=this.mesh(new T.TorusGeometry(.3,.027,4,12,Math.PI),'#ae8d5c',g,.36,.56,.15);bow.rotation.z=-Math.PI/2;this.box(g,.36,.56,.15,.015,.6,.015,'#d3c8aa');
    }else if(u.job==='monk'){this.box(g,0,1,0,.38,.06,.36,'#b2694d');}
    else{this.sword(g);const cape=this.box(g,0,.5,-.19,.36,.53,.05,cloth);cape.rotation.x=.12;}
    if(u.boss)this.cylinder(g,0,1.17,0,.24,.21,.16,'#c3a166',5);
    // Figurine parts share one vertex-colored draw call. The whole piece animates together.
    if(this.mergeGeometry){const geometries:Three.BufferGeometry[]=[];g.traverse(o=>{if(o instanceof T.Mesh){o.updateMatrix();const geometry=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrix);const color=(o.material as Three.MeshStandardMaterial).color;const colors=new Float32Array(geometry.getAttribute('position').count*3);for(let i=0;i<colors.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}geometry.setAttribute('color',new T.BufferAttribute(colors,3));geometries.push(geometry);o.geometry.dispose();}});const merged=this.mergeGeometry(geometries,false);geometries.forEach(geo=>geo.dispose());if(merged){g.clear();const model=new T.Mesh(merged,new T.MeshStandardMaterial({vertexColors:true,roughness:.85,flatShading:true}));model.castShadow=true;model.receiveShadow=true;g.add(model);}}
    const label=document.createElement('button');label.className=`unit-label ${u.team}`;label.setAttribute('aria-label',`${u.name}, ${j.name}, ${u.team}`);label.dataset.unit=u.id;label.innerHTML=`<span class="unit-name">${u.name}</span><span class="world-health"><i></i></span><span class="unit-condition"></span>`;label.addEventListener('click',()=>this.onPick({x:u.x,z:u.z}));this.labelHost.append(label);this.labels.set(u.id,label);
  }
  private sword(g:Three.Group){this.box(g,.33,.68,.12,.075,.59,.055,'#c5ceca');this.box(g,.33,.39,.12,.24,.055,.075,'#c4a971');this.box(g,.33,.29,.12,.055,.17,.065,'#64503e');}
  sync(){
    if(!this.battle)return;
    for(const u of this.battle.state.units){const mesh=this.unitMeshes.get(u.id);if(!mesh)continue;
      if(!this.animations.some(a=>a.id===u.id))mesh.position.set(u.x-4.5,this.height(u),u.z-4.5);
      mesh.rotation.y={south:0,east:Math.PI/2,north:Math.PI,west:-Math.PI/2}[u.facing];mesh.rotation.z=u.hp<=0?Math.PI/2:0;mesh.visible=!u.departed;
      const label=this.labels.get(u.id)!;label.classList.toggle('active',u.id===this.battle.state.active);label.classList.toggle('down',u.hp<=0);label.style.display=u.departed?'none':'';(label.querySelector('i') as HTMLElement).style.width=`${u.hp/u.maxHp*100}%`;label.querySelector('.unit-condition')!.textContent=this.battle.casting(u)?'✦ CHARGING':u.hp<=0?'✧ FALLEN':u.statuses.poison?'POISON':u.statuses.haste?'HASTE':u.statuses.guard?'GUARD':'';
    }
    const active=this.battle.active;this.marker.visible=!!active&&!this.battle.state.outcome;if(active)this.marker.position.set(active.x-4.5,this.height(active)+.065,active.z-4.5);
  }
  highlight(tiles:Pos[],color='move',selected?:Pos,aoe?:Pos[]){
    this.clearGroup(this.overlays);const T=this.T,colors:Record<string,string>={move:'#78c8d7',attack:'#d7836d',heal:'#92c6a7'};
    const material=new T.MeshBasicMaterial({color:colors[color]??color,transparent:true,opacity:.24,depthWrite:false,side:T.DoubleSide});
    for(const tile of tiles){const mesh=new T.Mesh(new T.PlaneGeometry(.9,.9),material);mesh.rotation.x=-Math.PI/2;mesh.position.set(tile.x-4.5,this.height(tile)+.035,tile.z-4.5);this.overlays.add(mesh);const edges=new T.LineSegments(new T.EdgesGeometry(mesh.geometry),new T.LineBasicMaterial({color:colors[color]??color,transparent:true,opacity:.65}));mesh.add(edges);}
    for(const tile of aoe??[]){const mesh=new T.Mesh(new T.PlaneGeometry(.9,.9),new T.MeshBasicMaterial({color:0xf8c99a,transparent:true,opacity:.35,depthWrite:false,side:T.DoubleSide}));mesh.rotation.x=-Math.PI/2;mesh.position.set(tile.x-4.5,this.height(tile)+.048,tile.z-4.5);this.overlays.add(mesh);}
    if(selected){const mesh=new T.Mesh(new T.RingGeometry(.39,.47,4),new T.MeshBasicMaterial({color:0xffe0a6,side:T.DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.rotation.z=Math.PI/4;mesh.position.set(selected.x-4.5,this.height(selected)+.065,selected.z-4.5);this.overlays.add(mesh);}
  }
  animate(events:BattleEvent[],speed=1){
    for(const event of events){if(event.type==='move'&&event.path)this.animations.push({id:event.unit!,path:event.path,start:performance.now(),duration:this.settings.reducedMotion?1:event.path.length*140/speed});
      if(['damage','heal','status','cast'].includes(event.type)&&event.unit){const label=this.labels.get(event.unit);if(!label)continue;const floating=document.createElement('span');floating.className=`floating ${event.type}`;floating.textContent=event.value!==undefined?`${event.type==='heal'?'+':'−'}${event.value}`:event.text??'CHARGING';label.append(floating);setTimeout(()=>floating.remove(),1400);
        if(!this.settings.reducedMotion){const unit=this.battle?.state.units.find(u=>u.id===event.unit);if(unit){const group=new this.T.Group(),color=event.type==='heal'?'#b0dfad':event.type==='cast'?'#bdb0df':'#f2ba88';group.position.set(unit.x-4.5,this.height(unit)+.55,unit.z-4.5);const material=new this.T.MeshBasicMaterial({color,transparent:true,opacity:1,depthWrite:false});for(let i=0;i<9;i++){const mesh=new this.T.Mesh(new this.T.OctahedronGeometry(.055),material);group.add(mesh);}this.scene.add(group);this.bursts.push({mesh:group,start:performance.now(),color,up:event.type!=='damage'});}}
      }
    }this.sync();
  }
  rotate(delta:number){this.targetAngle+=delta*Math.PI/2;}
  setZoom(delta:number){this.zoom=Math.max(.72,Math.min(1.6,this.zoom+delta));this.resize();}
  updateSettings(settings:Campaign['settings']){this.settings=settings;this.resize();}
  private resize(){if(!this.camera)return;const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;
    const dpr=this.lowQuality()?1:Math.min(devicePixelRatio,innerWidth<800?1.5:2);this.renderer.setPixelRatio(dpr);this.renderer.setSize(w,h);
    const aspect=w/h;const half=Math.max(6.7,8.5/aspect)/this.zoom;this.camera.left=-half*aspect;this.camera.right=half*aspect;this.camera.top=half;this.camera.bottom=-half;this.camera.updateProjectionMatrix();
  }
  project(p:Pos,height=1.4){const v=new this.T.Vector3(p.x-4.5,this.height(p)+height,p.z-4.5).project(this.camera);return{x:(v.x+1)*this.host.clientWidth/2,y:(1-v.y)*this.host.clientHeight/2};}
  private pick(x:number,y:number){const r=this.host.getBoundingClientRect();const pointer=new this.T.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);const ray=new this.T.Raycaster();ray.setFromCamera(pointer,this.camera);return ray.intersectObjects(this.tileMeshes,false)[0]?.object.userData.tile as Tile|undefined;}
  private bind(){
    const canvas=this.renderer.domElement;canvas.addEventListener('pointerdown',e=>{this.down={x:e.clientX,y:e.clientY};this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);if(this.pointers.size===2){const p=[...this.pointers.values()];this.pinch=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}});
    canvas.addEventListener('pointermove',e=>{
      if(this.pointers.has(e.pointerId)){const old=this.pointers.get(e.pointerId)!;this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(this.pointers.size===2){const p=[...this.pointers.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);this.setZoom((d-this.pinch)*.003);this.pinch=d;this.down=undefined;}else if(this.down&&Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)>9){this.targetAngle-=(e.clientX-old.x)*.007;}}
      else{const tile=this.pick(e.clientX,e.clientY),k=tile?`${tile.x},${tile.z}`:'';if(k!==this.hoverKey){this.hoverKey=k;this.onHover(tile??null);}}
    });
    canvas.addEventListener('pointerup',e=>{if(this.down&&Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)<9&&this.pointers.size===1){const tile=this.pick(e.clientX,e.clientY);if(tile)this.onPick(tile);}this.pointers.delete(e.pointerId);this.down=undefined;});
    canvas.addEventListener('pointercancel',e=>{this.pointers.delete(e.pointerId);this.down=undefined;});canvas.addEventListener('wheel',e=>{e.preventDefault();this.setZoom(-Math.sign(e.deltaY)*.08);},{passive:false});
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();document.dispatchEvent(new CustomEvent('renderer-lost'));});
  }
  private loop=()=>{
    this.frame=requestAnimationFrame(this.loop);if(document.hidden)return;
    const now=performance.now();if(this.lowQuality()&&now-this.frameTime<32)return;this.frameTime=now;
    this.angle+=(this.targetAngle-this.angle)*(this.settings.reducedMotion?1:.12);this.camera.position.set(Math.sin(this.angle)*16,14,Math.cos(this.angle)*16);this.camera.lookAt(0,.8,0);this.camera.updateMatrixWorld();
    for(const anim of this.animations){const f=Math.min(1,(now-anim.start)/anim.duration),part=f*(anim.path.length-1),idx=Math.min(anim.path.length-2,Math.floor(part)),a=anim.path[idx],b=anim.path[idx+1],t=part-idx;const m=this.unitMeshes.get(anim.id)!;m.position.set(a.x+(b.x-a.x)*t-4.5,this.height(a)+(this.height(b)-this.height(a))*t+Math.sin(t*Math.PI)*.12,a.z+(b.z-a.z)*t-4.5);}
    this.animations=this.animations.filter(a=>now-a.start<a.duration);
    if(!this.settings.reducedMotion){this.particles.rotation.y=now*.000015;this.marker.scale.setScalar(1+Math.sin(now*.003)*.035);}
    for(const burst of this.bursts){const f=(now-burst.start)/750;burst.mesh.children.forEach((o,i)=>{const a=i*Math.PI*2/9;o.position.set(Math.sin(a)*f*.75,(burst.up?f:-f*f)*.9+Math.sin(f*Math.PI)*.4,Math.cos(a)*f*.75);o.rotation.set(f*4+i,f*3,0);((o as Three.Mesh).material as Three.MeshBasicMaterial).opacity=Math.max(0,1-f);});if(f>=1){this.scene.remove(burst.mesh);this.clearGroup(burst.mesh);}}
    this.bursts=this.bursts.filter(b=>now-b.start<750);
    const width=this.host.clientWidth,height=this.host.clientHeight;
    const candidates=(this.battle?.state.units??[]).filter(u=>!u.departed).flatMap(u=>{const label=this.labels.get(u.id),mesh=this.unitMeshes.get(u.id);if(!label||!mesh)return[];const v=mesh.position.clone();v.y+=u.hp<=0?.45:1.55;v.project(this.camera);return [{label,x:(v.x+1)*width/2,y:(1-v.y)*height/2,w:label.offsetWidth,h:label.offsetHeight}];});
    const placed:{x:number;y:number;w:number;h:number}[]=[];
    for(const p of candidates){let y=p.y;for(let attempt=0;attempt<15&&placed.some(q=>Math.abs(p.x-q.x)<(p.w+q.w)/2+4&&y>q.y-q.h-5&&y-p.h<q.y+5);attempt++)y-=12;
      placed.push({...p,y});p.label.style.setProperty('--stem',`${Math.max(0,p.y-y)}px`);p.label.style.transform=`translate(${p.x}px,${y}px) translate(-50%,-100%)`;
    }
    if(this.renderScene)this.renderScene();else this.renderer.render(this.scene,this.camera);
  };
  private clearGroup(group:Three.Group){group.traverse(o=>{if((o as Three.Mesh).geometry){(o as Three.Mesh).geometry.dispose();const materials=(o as Three.Mesh).material;if(materials){for(const material of Array.isArray(materials)?materials:[materials])if(![...this.materials.values()].includes(material as Three.MeshStandardMaterial))material.dispose();}}});group.clear();}
  dispose(){cancelAnimationFrame(this.frame);this.resizeObserver?.disconnect();this.renderer.dispose();}
}
