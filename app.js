'use strict';
(() => {
const $=id=>document.getElementById(id), key='roam-at-home.trip.v1';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,fn,cls)=>{const n=el('button',text,cls);n.type='button';n.onclick=fn;return n;};
let landmarks=[],tags=[],dots=[],places=[],trip=[],map,directions,look,timer,mode='explore',selected,filter='All',generation=0,mapState='loading';
const walks=new Map();
const point=p=>p.map_point||p;
const theme=matchMedia('(prefers-color-scheme: dark)');
function mapTheme(){if(map)map.colorScheme=theme.matches?mapkit.Map.ColorSchemes.Dark:mapkit.Map.ColorSchemes.Light;}
theme.addEventListener('change',mapTheme);
const announce=text=>$('announcement').textContent=text;
function save(){try{localStorage.setItem(key,JSON.stringify(trip));}catch{announce('Your trip is saved for this visit.');}$('count').textContent=trip.length;}
function dispose(){generation++;clearTimeout(timer);if(look){look.destroy();look=null;}}
function shell(next){openSheet();dispose();mode=next;$('content').replaceChildren();$('panel').scrollTop=0;for(const name of ['explore','trip']){const active=name==='trip'?next==='trip':next!=='trip';$(name+'-tab').classList.toggle('active',active);$(name+'-tab').setAttribute('aria-pressed',String(active));}}
function focus(){const h=$('content').querySelector('h1,h2');if(h){h.tabIndex=-1;h.focus({preventScroll:true});}}
function directionsLink(p){const a=el('a','Directions','button');a.href=`https://maps.apple.com/?daddr=${point(p).lat},${point(p).lon}&dirflg=w`;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label',`Directions to ${p.name} (opens in a new tab)`);return a;}
function official(p){const a=el('a','Official website','text-link');a.href=p.official_website_url;a.target='_blank';a.rel='noopener noreferrer';return a;}
function saveButton(p){const b=button(trip.includes(p.id)?'Saved to My Trip ✓':'Save to My Trip',()=>{trip.push(p.id);save();b.textContent='Saved to My Trip ✓';b.disabled=true;announce(`${p.name} saved to My Trip.`);});b.disabled=trip.includes(p.id);return b;}
function walk(a,b,node){const cacheKey=a.id+':'+b.id;node.textContent=walks.get(cacheKey)||`Walking time to ${b.name}…`;if(!directions||walks.has(cacheKey))return;let done=false;const finish=text=>{if(done)return;done=true;clearTimeout(timeout);walks.set(cacheKey,text);node.textContent=text;};const timeout=setTimeout(()=>finish('Walking time unavailable'),15000);try{directions.route({origin:new mapkit.Coordinate(point(a).lat,point(a).lon),destination:new mapkit.Coordinate(point(b).lat,point(b).lon),transportType:mapkit.Directions.Transport.Walking},(error,data)=>{const seconds=data?.routes?.[0]?.expectedTravelTime;finish(!error&&Number.isFinite(seconds)?`${Math.max(1,Math.round(seconds/60))} min walk to ${b.name}`:'Walking time unavailable');});}catch{finish('Walking time unavailable');}}
function explore(setFocus=false){shell('explore');$('content').append(el('h1','Visit Nashville from home.'),el('p','Pick a place to look around - just for fun, or to plan a real trip.','intro'));const chips=el('div',null,'filters');chips.setAttribute('aria-label','Filter places by category');for(const category of ['All',...new Set(places.map(p=>p.category))]){const b=button(category,()=>{filter=category;explore();$('content').querySelector(`[data-category="${category}"]`).focus();},'chip');b.dataset.category=category;b.setAttribute('aria-pressed',String(filter===category));chips.append(b);}$('content').append(chips);const shown=places.filter(p=>(p.neighborhood_id||'downtown')===$('neighborhood').value).filter(p=>filter==='All'||p.category===filter);$('content').append(el('p',`${shown.length} places to visit`,'result-count'));shown.forEach((p,i)=>{const b=button('',()=>showPlace(p,true),'place');const label=el('span',null,'row-label');label.append(el('strong',p.name),el('small',p.category));if(directions&&i<shown.length-1){const w=el('small',null,'walk');label.append(w);walk(p,shown[i+1],w);}const arrow=el('span','›','chevron');arrow.setAttribute('aria-hidden','true');b.append(el('span',String(places.indexOf(p)+1).padStart(2,'0'),'number'),label,arrow);$('content').append(b);});if(setFocus)focus();}
function placeHeader(p,view){$('content').append(button('Back up to the sky',()=>showPlace(p,true),'back'),el('p',p.category,'category'),el('h2',p.name));const toggle=el('div',null,'view-toggle');toggle.setAttribute('aria-label','Place view');for(const name of ['Map','Street']){const b=button(name,()=>name==='Map'?showPlace(p,true):street(p),'');b.setAttribute('aria-pressed',String(view===name));toggle.append(b);}$('content').append(toggle);}
function openSheet(){ $('panel').hidden=false;$('browse').setAttribute('aria-expanded','true'); }
function closeSheet(){if(mode!=='story')dispose();$('panel').hidden=true;$('browse').setAttribute('aria-expanded','false');$('browse').focus();}
// Walking uses only public MapKit APIs. Scenes have no public camera/coordinate API.
let walkPosition=null, travelHeading=120, walkingBusy=false, miniMap=null, miniDot=null;
let walkEpoch=0, toastTimer, lastSkyCancel=0,lastMapTap=-Infinity;
const sceneCache=new Map();
let currentFrame=null;
const metrics=[],sceneRequests=[];
const coord=p=>new mapkit.Coordinate(p.lat,p.lon);
function offset(p,metres,heading){
 const angle=heading*Math.PI/180;
 return {lat:p.lat+metres*Math.cos(angle)/111320,lon:p.lon+metres*Math.sin(angle)/(111320*Math.cos(p.lat*Math.PI/180))};
}
function notice(text){
 announce(text);const n=$('walk-notice');n.textContent=text;n.hidden=false;
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.hidden=true,4000);
}
function controls(p){
 const bar=$('walk-bar');bar.replaceChildren(button('↑ Back up to the sky',backToSky));bar.hidden=false;
 if(p?.id)bar.append(button('♡ Save',()=>{if(!trip.includes(p.id)){trip.push(p.id);save();}notice('Saved to My Trip');}));
}
function setBusy(value){walkingBusy=value;$('walk-pad').setAttribute('aria-busy',String(value));for(const b of $('walk-pad').querySelectorAll('button'))b.disabled=value;}
function updateMini(){
 if(!walkPosition)return;
 $('walk-heading').textContent=`Travel ${Math.round(travelHeading)}° · Drag to look`;
 $('walk-direction').style.transform=`rotate(${travelHeading}deg)`;
 if(!miniMap){miniMap=new mapkit.Map('walk-mini-map',{mapType:mapkit.Map.MapTypes.Satellite,showsCompass:mapkit.FeatureVisibility.Hidden,showsMapTypeControl:false,showsZoomControl:false,showsUserLocationControl:false,isScrollEnabled:false,isZoomEnabled:false,isRotationEnabled:false});
 miniDot=new mapkit.Annotation(coord(walkPosition),()=>{const n=el('span','●','walk-position');return n;},{enabled:false,calloutEnabled:false});miniMap.addAnnotation(miniDot);}
 miniDot.coordinate=coord(walkPosition);
 miniMap.region=new mapkit.CoordinateRegion(coord(walkPosition),new mapkit.CoordinateSpan(.0025,.003));
}
function backToSky(recenter=true){
 walkEpoch++;if(recenter!==false)lastSkyCancel=performance.now();setBusy(false);dispose();
 for(const dot of dots)dot.selected=false;
 $('walk-view').hidden=true;$('walk-bar').hidden=true;$('place-card').hidden=true;$('panel').hidden=true;
 document.body.classList.remove('walking');mode='explore';
 if(recenter!==false&&map&&walkPosition)map.setRegionAnimated(new mapkit.CoordinateRegion(coord(walkPosition),new mapkit.CoordinateSpan(.009,.011)));
 if(miniMap){miniMap.destroy();miniMap=null;miniDot=null;}
 $('browse').focus();
}
function showPlace(p){selected=p;enterWalk(p.street_point||point(p),p);}
function street(p){showPlace(p);}
const cacheKey=p=>`${p.lat.toFixed(7)},${p.lon.toFixed(7)}`;
function parkFrame(frame){if(frame?.isConnected)frame.className='scene-probe';}
let coverageQueue=Promise.resolve();
function hasImagery(position){
 const job=coverageQueue.then(()=>new Promise(resolve=>{
  const host=el('div',null,'coverage-probe');document.body.append(host);let view,done=false,timeout;
  const finish=ok=>{if(done)return;done=true;clearTimeout(timeout);sceneRequests.push({position:{...position},ok,stage:'coverage'});if(sceneRequests.length>60)sceneRequests.shift();const release=()=>{try{view?.destroy();}catch{}host.remove();resolve(ok);};if(ok)setTimeout(release,650);else release();};
  try{view=new mapkit.LookAroundPreview(host,coord(position),{showsPointsOfInterest:false,showsDialogControl:false});view.addEventListener('load',()=>finish(!!view.scene));view.addEventListener('error',()=>finish(false));timeout=setTimeout(()=>finish(false),7000);if(view.readyState==='complete')finish(!!view.scene);}catch{finish(false);}
 }));coverageQueue=job.then(()=>{});return job;
}
function requestScene(p){
 const key=cacheKey(p);
 if(sceneCache.has(key)){const job=sceneCache.get(key);sceneCache.delete(key);sceneCache.set(key,job);return job;}
 const started=performance.now();
 const job=hasImagery(p).then(available=>available?new Promise(resolve=>{
  const frame=el('iframe',null,'scene-probe');frame.title='Street panorama';frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
  let done=false,timeout;
  const finish=(ok,reason)=>{if(done)return;done=true;clearTimeout(timeout);sceneRequests.push({position:{...p},ok,reason,ms:Math.round(performance.now()-started)});if(sceneRequests.length>60)sceneRequests.shift();if(!ok)frame.remove();resolve(ok?frame:null);};
  frame.onload=async()=>{try{finish(await frame.contentWindow.loadWalkScene(p),'imagery');}catch{finish(false,'error');}};
  frame.onerror=()=>finish(false,'frame');frame.src='walk-frame.html';document.body.append(frame);
  timeout=setTimeout(()=>finish(false,'timeout'),15000);
 }):null);
 sceneCache.set(key,job);job.then(frame=>{if(!frame)sceneCache.delete(key);});
 // Keep a bounded set of live, preloaded panoramas. Protect the visible frame.
 if(sceneCache.size>6){for(const [oldKey,oldJob] of sceneCache){if(oldKey===key)continue;if(oldJob.frame===currentFrame)continue;sceneCache.delete(oldKey);oldJob.then(frame=>{if(frame!==currentFrame)frame?.remove();});break;}}
 job.then(frame=>job.frame=frame);
 return job;
}
async function nearestScene(p,epoch){
 let scene=await requestScene(p);if(scene||epoch!==walkEpoch)return scene&&{scene,position:p};
 // Sample a ring before moving outward. Coordinate loads are serialized.
 for(const radius of [15,30,60,100,150]){
  if(epoch!==walkEpoch)return null;
  for(let i=0;i<8;i++){
   if(epoch!==walkEpoch)return null;
   const position=offset(p,radius,i*45),scene=await requestScene(position);
   if(scene)return {scene,position};
  }
 }
 return null;
}
async function showScene(frame,epoch){
 if(epoch!==walkEpoch||!frame?.isConnected)return false;
 const old=currentFrame;currentFrame=frame;
 frame.className='street-layer visible';frame.removeAttribute('aria-hidden');frame.tabIndex=0;
 // The iframe keeps its own viewer alive, including drag state and keyboard focus.
 look={destroy:()=>{if(currentFrame===frame)currentFrame=null;frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;parkFrame(frame);}};
 if(old&&old!==frame){old.setAttribute('aria-hidden','true');old.tabIndex=-1;parkFrame(old);}
 return true;
}
async function enterWalk(position,p=null){
 backToSky(false);const epoch=++walkEpoch;selected=p;mode='descending';setBusy(true);
 $('panel').hidden=true;$('place-card').hidden=true;
 $('map-status').hidden=false;$('map-status').textContent='Finding a street…';
 // Search before opening the full-screen viewer: failed clicks stay in the sky.
 const result=await nearestScene(position,epoch);if(epoch!==walkEpoch)return;
 if(!result){mode='explore';setBusy(false);$('map-status').textContent='No street view here – try a street';setTimeout(()=>{if(epoch===walkEpoch)$('map-status').hidden=true;},4000);return;}
 walkPosition=result.position;travelHeading=120;
 map.setRegionAnimated(new mapkit.CoordinateRegion(coord(walkPosition),new mapkit.CoordinateSpan(.0012,.0015)));
 if(map.setCameraDistanceAnimated)map.setCameraDistanceAnimated(150);
 await new Promise(r=>setTimeout(r,650));if(epoch!==walkEpoch)return;
 controls(p);$('map-status').hidden=true;$('walk-view').hidden=false;document.body.classList.add('walking');
 $('street-status').hidden=false;$('street-status').textContent='Opening the street…';
 if(!await showScene(result.scene,epoch)){if(epoch===walkEpoch){backToSky();notice('Street view could not load. Try again.');}return;}
 if(epoch!==walkEpoch)return;mode='street';$('street-status').hidden=true;setBusy(false);updateMini();preload(walkPosition);$('walk-pad').querySelector('button').focus({preventScroll:true});
}
function preload(position){
 if(!position||mode!=='street')return;
 for(const sign of [1,-1])requestScene(offset(position,10*sign,travelHeading));
}
async function step(sign){
 if(mode!=='street'||walkingBusy)return;
 const epoch=walkEpoch,start=performance.now(),origin={...walkPosition};setBusy(true);
 $('street-status').hidden=false;$('street-status').textContent='Walking…';
 
 for(const metres of [10,5,15]){
  const target=offset(origin,metres*sign,travelHeading),scene=await requestScene(target);
  if(epoch!==walkEpoch)return;
  if(scene&&await showScene(scene,epoch)){
   if(epoch!==walkEpoch)return;walkPosition=target;setBusy(false);$('street-status').hidden=true;updateMini();preload(walkPosition);
   const duration=Math.round(performance.now()-start);metrics.push({action:sign>0?'forward':'back',metres,ms:duration,position:{...walkPosition}});
   document.dispatchEvent(new CustomEvent('roam-step',{detail:metrics.at(-1)}));return;
  }
 }
 if(epoch!==walkEpoch)return;setBusy(false);$('street-status').hidden=true;notice('No street ahead. Try another direction.');$('walk-pad').animate([{transform:'translateX(-50%)'},{transform:'translateX(calc(-50% + 5px))'},{transform:'translateX(-50%)'}],{duration:220});
}
function turn(delta){if(mode!=='street'||walkingBusy)return;travelHeading=(travelHeading+delta+360)%360;updateMini();preload(walkPosition);notice('Walking direction changed. Drag the view to face that way.');}
const actions={forward:()=>step(1),back:()=>step(-1),left:()=>turn(-30),right:()=>turn(30)};
for(const b of $('walk-pad').querySelectorAll('button'))b.onclick=()=>actions[b.dataset.action]();
$('walk-mini').onclick=backToSky;
window.roamWalkAction=action=>{if(action==='sky')backToSky();else actions[action]?.();};
document.addEventListener('keydown',e=>{
 if(mode!=='street'||!$('panel').hidden||e.altKey||e.metaKey||e.ctrlKey)return;
 const action={ArrowUp:'forward',w:'forward',ArrowDown:'back',s:'back',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'}[e.key.length===1?e.key.toLowerCase():e.key];
 if(action){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)actions[action]();}
},true);
// Read-only diagnostics for reproducible timing and requested-coordinate evidence.
window.roamWalkDiagnostics=()=>({mode,busy:walkingBusy,position:walkPosition&&{...walkPosition},heading:travelHeading,selectedId:selected?.id||null,metrics:metrics.map(m=>({...m})),cacheSize:sceneCache.size,sceneRequests:sceneRequests.map(r=>({...r}))});
function story(p){openSheet();mode='story';$('content').replaceChildren(button('← Return to walk',()=>{$('panel').hidden=true;mode='street';}));$('content').append(el('h2',p.name),el('p',p.why_go),el('p',p.story),el('p',p.best_time_tip),official(p),directionsLink(p));focus();}
async function shareLink(kind,value){const url=new URL(location.origin+location.pathname);url.searchParams.set(kind,value);try{if(navigator.share)await navigator.share({title:'Visit Nashville',url:url.href});else{await navigator.clipboard.writeText(url.href);announce('Link copied.');}}catch(e){if(e.name!=='AbortError'){openSheet();const input=el('input');input.value=url.href;input.readOnly=true;input.setAttribute('aria-label','Copy share link');$('content').replaceChildren(input);input.select();}}}
function shareTrip(){return shareLink('trip',trip.join(','));}
function renderTrip(setFocus=false){shell('trip');$('content').append(el('h2','My Trip'),el('p','Your places, in your order. Save a few for fun or a future visit.','intro'));if(!trip.length){$('content').append(el('p','Choose a place and tap “Save to My Trip”.'),button('Explore places',()=>explore(true),'primary'));}else{const share=button('Share',shareTrip,'primary'),status=el('p');status.id='share-status';status.setAttribute('role','status');$('content').append(share,status);const list=el('ol',null,'trip-list');trip.forEach((id,i)=>{const p=places.find(p=>p.id===id),li=el('li',null,'trip-stop');li.append(el('h3',`${i+1}. ${p.name}`));const tools=el('div',null,'trip-tools');const view=button('View place',()=>showPlace(p,true));view.setAttribute('aria-label',`View ${p.name}`);tools.append(view);for(const [delta,text] of [[-1,'↑'],[1,'↓']]){const b=button(text,()=>{[trip[i],trip[i+delta]]=[trip[i+delta],trip[i]];save();renderTrip();$('content').querySelectorAll('.trip-stop')[i+delta].querySelector('button').focus();});b.disabled=i+delta<0||i+delta>=trip.length;b.setAttribute('aria-label',`Move ${p.name} ${delta<0?'up':'down'}`);tools.append(b);}const remove=button('Remove',()=>{trip.splice(i,1);save();renderTrip(true);});remove.setAttribute('aria-label',`Remove ${p.name}`);tools.append(remove);li.append(tools);if(directions&&i<trip.length-1){const w=el('p',null,'walk');w.setAttribute('role','status');li.append(w);walk(p,places.find(p=>p.id===trip[i+1]),w);}list.append(li);});$('content').append(list);}if(setFocus)focus();}
function setupMap(){const token=typeof window.ROAM_MAPKIT_TOKEN==='string'?window.ROAM_MAPKIT_TOKEN.trim():'';let timeout;const fail=()=>{clearTimeout(timeout);mapState='unavailable';dispose();if(map){try{map.destroy();}catch{}map=null;}directions=null;$('map-status').hidden=false;$('map-status').textContent='The map is unavailable right now. Choose a place below to keep visiting.';console.warn('Roam: MapKit unavailable; check authorization, allowed origin and connectivity.');if(mode==='explore')explore();else if(mode==='trip')renderTrip();else if(selected)showPlace(selected);};if(!token){fail();return;}timeout=setTimeout(fail,25000);window.roamMapReady=()=>{try{mapkit.addEventListener('error',fail);mapkit.addEventListener('configuration-change',event=>{if(event.status!=='Initialized'||mapState!=='loading')return;try{map=new mapkit.Map('map',{region:new mapkit.CoordinateRegion(new mapkit.Coordinate(36.162,-86.781),new mapkit.CoordinateSpan(.027,.029)),mapType:mapkit.Map.MapTypes.Satellite,showsUserLocationControl:false});mapTheme();for(const p of places){const marker=new mapkit.Annotation(new mapkit.Coordinate(point(p).lat,point(p).lon),()=>{const dot=el('button',null,'map-dot');dot.setAttribute('aria-label',p.name);dot.dataset.placeId=p.id;dot.onclick=e=>{e.stopPropagation();if(performance.now()-lastMapTap>500)showPlace(p);};return dot;},{title:p.name,calloutEnabled:false,displayPriority:1000,collisionMode:'none'});map.addAnnotation(marker);dots.push(marker);}
for(const p of landmarks){const tag=new mapkit.Annotation(new mapkit.Coordinate(+p.latitude,+p.longitude),()=>{const label=el('span',p.label,'landmark-tag');p.element=label;return label;},{enabled:false,calloutEnabled:false});tag.landmark=p;tag.importance=+p.importance;map.addAnnotation(tag);tags.push(tag);}
map.addEventListener('region-change-end',updateTags);updateTags();
let press=null;
const mapElement=$('map');
mapElement.addEventListener('pointerdown',event=>{
 if(!event.isPrimary){if(press)press.canceled=true;return;}
 press={x:event.pageX,y:event.pageY,id:event.pointerId,time:performance.now(),canceled:false};
},true);
mapElement.addEventListener('pointermove',event=>{if(press&&event.pointerId===press.id&&Math.hypot(event.pageX-press.x,event.pageY-press.y)>8)press.canceled=true;},true);
mapElement.addEventListener('pointercancel',()=>press=null,true);
mapElement.addEventListener('pointerup',event=>{
 const start=press;press=null;
 if(!start||start.id!==event.pointerId||start.canceled||event.button>0||performance.now()-start.time>1000)return;
 if(mode==='descending'||document.body.classList.contains('walking')||event.timeStamp<lastSkyCancel)return;
 if(event.target.closest('a,input,select,.mk-control')||(event.target.closest('button')&&!event.target.closest('.map-dot')))return;
 lastMapTap=performance.now();
 // Use the finger's actual point, avoiding Chrome's nearby-button tap adjustment.
 const hit=[...mapElement.querySelectorAll('.map-dot')].find(dot=>{const r=dot.getBoundingClientRect();return Math.hypot(event.clientX-r.left-r.width/2,event.clientY-r.top-r.height/2)<=16;});
 if(hit){const place=places.find(p=>p.id===hit.dataset.placeId);if(place)showPlace(place);return;}
 const c=map.convertPointOnPageToCoordinate(new DOMPoint(event.pageX,event.pageY));
 if(c)enterWalk({lat:c.latitude,lon:c.longitude});
},true);
directions=new mapkit.Directions();mapState='ready';clearTimeout(timeout);$('map-status').hidden=true;if(selected)showPlace(selected);else if(new URL(location.href).searchParams.has('trip'))renderTrip();else $('panel').hidden=true;}catch{fail();}});mapkit.init({authorizationCallback:done=>done(token)});}catch{fail();}};const script=document.createElement('script');script.src='https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.core.js';script.crossOrigin='anonymous';script.dataset.libraries='map,annotations,services,look-around';script.dataset.callback='roamMapReady';script.onerror=fail;document.head.append(script);}
function updateTags(){if(!map)return;const r=map.region,span=r.span.latitudeDelta;const level=span<.015?3:span<.045?2:1;let count=0;const occupied=[];for(const tag of [...tags].sort((a,b)=>a.importance-b.importance)){const c=tag.coordinate;const x=(c.longitude-r.center.longitude)/r.span.longitudeDelta*innerWidth,y=(c.latitude-r.center.latitude)/span*innerHeight,w=tag.landmark.label.length*6.5;let visible=tag.importance<=level&&Math.abs(y)<innerHeight*.42&&Math.abs(x)<innerWidth*.44&&count<18;if(visible&&occupied.some(o=>Math.abs(y-o.y)<23&&Math.abs(x-o.x)<(w+o.w)/2+8))visible=false;if(visible){count++;occupied.push({x,y,w});}if(tag.landmark.element)tag.landmark.element.style.display=visible?'':'none';}}
$('browse').onclick=()=>explore(true);$('close-panel').onclick=closeSheet;document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('panel').hidden)closeSheet();else backToSky();}});
$('neighborhood').onchange=()=>{const centers={downtown:[36.161,-86.778], '12south':[36.1255,-86.789],midtown:[36.151,-86.797],fivepoints:[36.177,-86.751]};const c=centers[$('neighborhood').value];if(map)map.setRegionAnimated(new mapkit.CoordinateRegion(new mapkit.Coordinate(...c),new mapkit.CoordinateSpan(.019,.023)));$('place-card').hidden=true;if(!$('panel').hidden)explore();};
$('explore-tab').onclick=()=>explore(true);$('trip-tab').onclick=()=>renderTrip(true);
fetch('landmarks.json').then(r=>r.json()).then(data=>{landmarks=data;return fetch('places/places_all.json');}).then(r=>{if(!r.ok)throw Error('places');return r.json();}).then(data=>{places=data;const shared=new URL(location.href).searchParams.get('trip');let saved=[];try{saved=JSON.parse(localStorage.getItem(key)||'[]');}catch{}trip=[...new Set(shared!==null?shared.split(','):Array.isArray(saved)?saved:[])].filter(id=>places.some(p=>p.id===id));save();const placeId=new URL(location.href).searchParams.get('place');selected=places.find(p=>p.id===placeId);if(selected)$('neighborhood').value=selected.neighborhood_id||'downtown';if(shared!==null)renderTrip();setupMap();}).catch(()=>{$('content').append(el('h2','Places could not load'),el('p','Please refresh and try again.'));console.warn('Roam: unable to load place data.');});
})();

// Phone fix: stop Safari pinch/double-tap from zooming the whole page (it hid the street behind giant buttons)
["gesturestart","gesturechange"].forEach(t=>document.addEventListener(t,e=>e.preventDefault(),{passive:false}));let lastTouchEnd=0;document.addEventListener("touchend",e=>{const n=Date.now();if(n-lastTouchEnd<350&&e.target.closest("#walk-pad,#walk-bar,#walk-mini"))e.preventDefault();lastTouchEnd=n;},{passive:false});
