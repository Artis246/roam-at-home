'use strict';
(() => {
const $=id=>document.getElementById(id);
let city,cityId,key;
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
function explore(setFocus=false){shell('explore');$('content').append(el('h1',city.visitTitle),el('p','Pick a place to look around - just for fun, or to plan a real trip.','intro'));const chips=el('div',null,'filters');chips.setAttribute('aria-label','Filter places by category');for(const category of ['All',...new Set(places.map(p=>p.category))]){const b=button(category,()=>{filter=category;explore();$('content').querySelector(`[data-category="${category}"]`).focus();},'chip');b.dataset.category=category;b.setAttribute('aria-pressed',String(filter===category));chips.append(b);}$('content').append(chips);const shown=places.filter(p=>(p.neighborhood_id||city.neighborhoods[0].id)===$('neighborhood').value).filter(p=>filter==='All'||p.category===filter);$('content').append(el('p',`${shown.length} places to visit`,'result-count'));shown.forEach((p,i)=>{const b=button('',()=>showPlace(p,true),'place');const label=el('span',null,'row-label');label.append(el('strong',p.name),el('small',p.category));if(directions&&i<shown.length-1){const w=el('small',null,'walk');label.append(w);walk(p,shown[i+1],w);}const arrow=el('span','›','chevron');arrow.setAttribute('aria-hidden','true');b.append(el('span',String(places.indexOf(p)+1).padStart(2,'0'),'number'),label,arrow);$('content').append(b);});if(setFocus)focus();}
function placeHeader(p,view){$('content').append(button('Back up to the sky',()=>showPlace(p,true),'back'),el('p',p.category,'category'),el('h2',p.name));const toggle=el('div',null,'view-toggle');toggle.setAttribute('aria-label','Place view');for(const name of ['Map','Street']){const b=button(name,()=>name==='Map'?showPlace(p,true):street(p),'');b.setAttribute('aria-pressed',String(view===name));toggle.append(b);}$('content').append(toggle);}
function openSheet(){ $('panel').hidden=false;$('browse').setAttribute('aria-expanded','true'); }
function closeSheet(){if(mode!=='story')dispose();$('panel').hidden=true;$('browse').setAttribute('aria-expanded','false');$('browse').focus();}
const viewerRoots=[];const nativeAttachShadow=Element.prototype.attachShadow;
Element.prototype.attachShadow=function(options){const root=nativeAttachShadow.call(this,options);viewerRoots.push(root);return root;};
window.driveWalk=async(action,pointerType=matchMedia('(pointer:coarse)').matches?'touch':'mouse',fraction=.28,height=.64)=>{
 const canvas=viewerCanvas();if(!canvas)return false;
 const r=canvas.getBoundingClientRect(),x=r.width*.5,y=r.height*height;
 const send=(type,px,py,pressed=true)=>canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,composed:true,clientX:r.left+px,clientY:r.top+py,pointerId:91,pointerType,isPrimary:true,button:type==='pointermove'?-1:0,buttons:type==='pointerup'||!pressed?0:1,pressure:type==='pointerup'||!pressed?0:.5}));
 if(action==='forward'){send('pointermove',x,y,false);await new Promise(r=>setTimeout(r,120));send('pointerdown',x,y);await new Promise(r=>setTimeout(r,60));send('pointerup',x,y);for(const type of ['mousedown','mouseup','click'])canvas.dispatchEvent(new MouseEvent(type,{bubbles:true,composed:true,clientX:r.left+x,clientY:r.top+y,button:0,detail:1}));}
 else {const dx=(action==='left'?1:-1)*r.width*fraction;send('pointerdown',x,y);for(let i=1;i<=16;i++){send('pointermove',x+dx*i/16,y);await new Promise(r=>setTimeout(r,16));}await new Promise(r=>setTimeout(r,180));send('pointermove',x+dx,y);send('pointerup',x+dx,y);}
 return true;
};

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const angleDiff=(a,b)=>((a-b+540)%360)-180;
function liveRoots(){return viewerRoots.filter(r=>{let host=r.host;while(host){if(currentFrame?.contains(host))return host.isConnected;host=host.getRootNode()?.host;}return false;});}
function viewerCanvas(){return liveRoots().map(r=>r.querySelector('canvas.mk-look-around-view')).find(Boolean);}
function compassHeading(){const n=liveRoots().map(r=>r.querySelector('.mk-compass-wrapper')).find(Boolean);const v=n?.style.transform.match(/rotate\(([-.0-9]+)deg/);return v?(360-Number(v[1]))%360:null;}
function livePosition(){const href=window.roamViewerLocation?.();if(!href)return null;try{const c=new URL(href).searchParams.get('coordinate').split(',').map(Number);return {lat:c[0],lon:c[1]};}catch{return null;}}
function distance(a,b){return !a||!b?0:Math.hypot((a.lat-b.lat)*111320,(a.lon-b.lon)*111320*Math.cos(a.lat*Math.PI/180));}
function bearing(a,b){return (Math.atan2((b.lon-a.lon)*Math.cos(a.lat*Math.PI/180),b.lat-a.lat)*180/Math.PI+360)%360;}
let road=null,alignment=null;
async function streetGeometry(p){
 if(!directions)return null;
 const route=axis=>new Promise(resolve=>{let done=false;const finish=v=>{if(done)return;done=true;clearTimeout(t);resolve(v);};const t=setTimeout(()=>finish(null),5000);try{directions.route({origin:coord(offset(p,100,axis)),destination:coord(offset(p,100,axis+180)),transportType:mapkit.Directions.Transport.Walking},(error,data)=>finish(error?null:data?.routes?.[0]));}catch{finish(null);}});
 const results=await Promise.all([route(0),route(90)]);let best=null;
 for(const r of results){const points=r?.polyline?.points||[];for(let i=1;i<points.length;i++){
 const a={lat:points[i-1].latitude,lon:points[i-1].longitude},b={lat:points[i].latitude,lon:points[i].longitude};const scale=Math.cos(p.lat*Math.PI/180),dx=(b.lon-a.lon)*scale,dy=b.lat-a.lat;
 const t=Math.max(0,Math.min(1,((p.lon-a.lon)*scale*dx+(p.lat-a.lat)*dy)/(dx*dx+dy*dy||1)));
 const snap={lat:a.lat+t*dy,lon:a.lon+t*(b.lon-a.lon)},d=distance(p,snap);
 if(distance(a,b)>4&&(!best||d<best.distance))best={a,b,point:snap,heading:bearing(a,b),distance:d};
 }}return best&&best.distance<80?best:null;
}
async function alignTo(target){
 for(let i=0;i<12;i++){const h=compassHeading();if(h===null)return false;const error=angleDiff(target,h);if(Math.abs(error)<5){await pause(350);if(Math.abs(angleDiff(target,compassHeading()))<5)return true;continue;}
 const before=h;await window.driveWalk('right',undefined,.12);await pause(100);const delta=angleDiff(compassHeading(),before);if(Math.abs(delta)<.2)return false;
 const remaining=angleDiff(target,compassHeading());if(Math.abs(remaining)<5)return true;
 await window.driveWalk(remaining*delta>0?'right':'left',undefined,Math.min(.45,.12*Math.abs(remaining/delta)));await pause(120);
 }await pause(350);return Math.abs(angleDiff(target,compassHeading()))<8;
}
async function widestView(){const c=viewerCanvas();if(!c)return;const r=c.getBoundingClientRect();for(let i=0;i<8;i++){c.dispatchEvent(new WheelEvent('wheel',{bubbles:true,composed:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2,deltaY:120,deltaMode:0,ctrlKey:true}));await pause(30);}}
// One retained viewer per walk; native navigation preserves its camera.
let walkPosition=null, travelHeading=120, walkingBusy=false, miniMap=null, miniDot=null;
let walkEpoch=0, toastTimer, lastSkyCancel=0,lastMapTap=-Infinity;

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
 $('walk-heading').textContent='Walk where you look · Drag to turn';
 $('walk-direction').hidden=true; // Public camera telemetry is unavailable; DOM feedback is best-effort, so keep this map at entry.
 if(!miniMap){miniMap=new mapkit.Map('walk-mini-map',{mapType:mapkit.Map.MapTypes.Satellite,showsCompass:mapkit.FeatureVisibility.Hidden,showsMapTypeControl:false,showsZoomControl:false,showsUserLocationControl:false,isScrollEnabled:false,isZoomEnabled:false,isRotationEnabled:false});
 miniDot=new mapkit.Annotation(coord(walkPosition),()=>{const n=el('span','○','walk-position');return n;},{enabled:false,calloutEnabled:false});miniMap.addAnnotation(miniDot);}
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
// The interactive viewer itself performs the public coordinate coverage request.
// No parallel preview renderer or copied preview texture is needed.
async function nearestScene(p,epoch){
 const started=performance.now(),frame=el('div',null,'scene-probe');frame.title='Street panorama';frame.tabIndex=-1;document.body.append(frame);
 let view;const loaded=await new Promise(resolve=>{let done=false;const finish=ok=>{if(done)return;done=true;clearTimeout(timeout);resolve(ok);};const timeout=setTimeout(()=>finish(false),15000);try{view=new mapkit.LookAround(frame,coord(p),{isNavigationEnabled:true,isScrollEnabled:true,isZoomEnabled:true,showsDialogControl:false,showsCloseControl:false,showsPointsOfInterest:false});view.addEventListener('load',()=>finish(true));view.addEventListener('error',()=>finish(false));if(view.readyState==='complete')finish(true);}catch{finish(false);}});
 frame.viewer=view;sceneRequests.push({position:p,ok:loaded,stage:'interactive-coordinate',ms:Math.round(performance.now()-started)});
 if(!loaded||epoch!==walkEpoch){view?.destroy();frame.remove();return null;}
 for(let i=viewerRoots.length-1;i>=0;i--)if(!viewerRoots[i].host.isConnected)viewerRoots.splice(i,1);
 metrics.push({action:'entry',ms:Math.round(performance.now()-started)});return {scene:frame,position:p};
}
async function showScene(frame,epoch){
 if(epoch!==walkEpoch||!frame?.isConnected)return false;
 currentFrame=frame;
 // Keep the panorama transparent until street alignment is verified.
 frame.className='street-layer';frame.removeAttribute('aria-hidden');frame.tabIndex=0;
 // Keep this viewer alive across every native walking and turning action.
 look={destroy:()=>{if(currentFrame===frame)currentFrame=null;frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;frame.viewer?.destroy();frame.remove();}};
 return true;
}
async function enterWalk(position,p=null){
 backToSky(false);const epoch=++walkEpoch;selected=p;mode='descending';setBusy(true);
 $('panel').hidden=true;$('place-card').hidden=true;
 $('map-status').hidden=false;$('map-status').textContent='Finding a street…';
 // Search before opening the full-screen viewer: failed clicks stay in the sky.
 road=await streetGeometry(position);if(epoch!==walkEpoch)return;
 const result=await nearestScene(road?.point||position,epoch);if(epoch!==walkEpoch)return;
 if(!result){mode='explore';setBusy(false);$('map-status').textContent='No street view here – try a street';setTimeout(()=>{if(epoch===walkEpoch)$('map-status').hidden=true;},4000);return;}
 walkPosition=result.position;travelHeading=road?.heading??null;alignment=null;
 map.setRegionAnimated(new mapkit.CoordinateRegion(coord(walkPosition),new mapkit.CoordinateSpan(.0012,.0015)));
 if(map.setCameraDistanceAnimated)map.setCameraDistanceAnimated(150);
 if(epoch!==walkEpoch)return;
 controls(p);$('map-status').hidden=true;$('walk-view').hidden=false;document.body.classList.add('walking');
 $('street-status').hidden=false;$('street-status').textContent='Opening the street…';
 if(!await showScene(result.scene,epoch)){if(epoch===walkEpoch){backToSky();notice('Street view could not load. Try again.');}return;}
 await widestView();if(road){const h=compassHeading();travelHeading=Math.abs(angleDiff(road.heading,h))<=90?road.heading:(road.heading+180)%360;alignment={target:travelHeading,ok:await alignTo(travelHeading)};if(!alignment.ok)notice('Drag to face the road before walking.');}else notice('Street direction unavailable. Drag to face the road.');
 for(let i=0;i<15&&!livePosition();i++)await pause(100);
 if(epoch!==walkEpoch)return;if(!road||!alignment?.ok){backToSky(false);notice('Could not line up this street. Try another street.');return;}currentFrame.classList.add('visible');mode='street';$('street-status').hidden=true;setBusy(false);updateMini();$('walk-pad').querySelector('button').focus({preventScroll:true});
}
async function rotateView(action,degrees){
 const heading=()=>{const node=liveRoots().map(r=>r.querySelector('.mk-compass-wrapper')).find(Boolean);return Number(node?.style.transform.match(/rotate\(([-.0-9]+)deg/)?.[1]);};
 const difference=(a,b)=>((a-b+540)%360)-180,initial=heading();
 await window.driveWalk(action);await new Promise(r=>setTimeout(r,180));
 const delta=difference(heading(),initial),target=(initial+Math.sign(delta)*degrees+360)%360;
 if(!Number.isFinite(delta)||Math.abs(delta)<1)return;
 for(let i=0;i<8;i++){
  const error=difference(target,heading());if(Math.abs(error)<2)break;
  await window.driveWalk(error*delta>0?action:action==='right'?'left':'right',undefined,Math.min(.42,.28*Math.abs(error/delta)));
  await new Promise(r=>setTimeout(r,180));
 }
}
async function nativeAction(action){
 if(mode!=='street'||walkingBusy||!currentFrame)return;
 const epoch=walkEpoch,start=performance.now();setBusy(true);
 try{
  if(action==='left'||action==='right'){await rotateView(action,37);return;}
  const before=livePosition(),initialHeading=compassHeading();let moved=false,retries=0;
  if(!before){notice('Street position is not ready yet. Please try again.');return;}
  if(action==='back')await alignTo((initialHeading+180)%360);
  const waitForStep=async()=>{for(let i=0;i<30;i++){if(epoch!==walkEpoch)return false;await pause(100);if(distance(before,livePosition())>1){await pause(500);return true;}}return false;};
  await window.driveWalk('forward');moved=await waitForStep();
  if(!moved&&road&&epoch===walkEpoch){
   const h=compassHeading(),target=Math.abs(angleDiff(road.heading,h))<90?road.heading:(road.heading+180)%360;
   await alignTo(target);
   // Apple's ground hotspot changes with viewport and street geometry.
   // Retry bounded screen depths within the SAME viewer, preserving its camera.
   for(const height of [.54,.74]){retries++;await window.driveWalk('forward',undefined,.28,height);if(await waitForStep()){moved=true;break;}}
  }
  if(epoch===walkEpoch){
   moved=moved||distance(before,livePosition())>1;
   if(!moved)notice('No step available here. Turn toward the road or try another street.');
   metrics.push({action,ms:Math.round(performance.now()-start),moved,retries,before,after:livePosition(),heading:compassHeading()});
  }
 }catch{if(epoch===walkEpoch)notice('That step could not load. Please try again.');}
 finally{if(epoch===walkEpoch)setBusy(false);}
}
function step(sign){return nativeAction(sign>0?'forward':'back');}
function turn(delta){return nativeAction(delta<0?'left':'right');}
const actions={forward:()=>step(1),back:()=>step(-1),left:()=>turn(-30),right:()=>turn(30)};
for(const b of $('walk-pad').querySelectorAll('button'))b.onclick=()=>actions[b.dataset.action]();
$('walk-mini').onclick=backToSky;
window.roamWalkAction=action=>{if(action==='sky')backToSky();else actions[action]?.();};
document.addEventListener('keydown',e=>{
 if(mode!=='street'||!$('panel').hidden||e.altKey||e.metaKey||e.ctrlKey)return;
 const action={ArrowUp:'forward',w:'forward',ArrowDown:'back',s:'back',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'}[e.key.length===1?e.key.toLowerCase():e.key];
 if(action){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)actions[action]();}
},true);
// Read-only diagnostics use rendered compass/report-link feedback; the mini-map marks entry.
window.roamViewerLocation=()=>liveRoots().flatMap(r=>[...r.querySelectorAll('a')]).find(a=>a.href.includes('report-a-problem')&&new URL(a.href).searchParams.has('coordinate'))?.href;
window.roamViewerDOM=()=>viewerRoots.filter(r=>r.host.isConnected).flatMap(r=>[...r.querySelectorAll('[class*=compass]')]).map(n=>({cls:n.getAttribute('class'),style:n.getAttribute('style'),transform:n.getAttribute('transform')}));
window.roamWalkDiagnostics=()=>({mode,busy:walkingBusy,position:walkPosition&&{...walkPosition},heading:compassHeading(),road,alignment,livePosition:livePosition(),selectedId:selected?.id||null,metrics:metrics.map(m=>({...m})),viewerCount:currentFrame?1:0,sceneRequests:sceneRequests.map(r=>({...r}))});
function story(p){openSheet();mode='story';$('content').replaceChildren(button('← Return to walk',()=>{$('panel').hidden=true;mode='street';}));$('content').append(el('h2',p.name),el('p',p.why_go),el('p',p.story),el('p',p.best_time_tip),official(p),directionsLink(p));focus();}
async function shareLink(kind,value){const url=new URL(location.origin+location.pathname);url.searchParams.set('city',cityId);url.searchParams.set(kind,value);try{if(navigator.share)await navigator.share({title:city.shareTitle,url:url.href});else{await navigator.clipboard.writeText(url.href);announce('Link copied.');}}catch(e){if(e.name!=='AbortError'){openSheet();const input=el('input');input.value=url.href;input.readOnly=true;input.setAttribute('aria-label','Copy share link');$('content').replaceChildren(input);input.select();}}}
function shareTrip(){return shareLink('trip',trip.join(','));}
function renderTrip(setFocus=false){shell('trip');$('content').append(el('h2','My Trip'),el('p','Your places, in your order. Save a few for fun or a future visit.','intro'));if(!trip.length){$('content').append(el('p','Choose a place and tap “Save to My Trip”.'),button('Explore places',()=>explore(true),'primary'));}else{const share=button('Share',shareTrip,'primary'),status=el('p');status.id='share-status';status.setAttribute('role','status');$('content').append(share,status);const list=el('ol',null,'trip-list');trip.forEach((id,i)=>{const p=places.find(p=>p.id===id),li=el('li',null,'trip-stop');li.append(el('h3',`${i+1}. ${p.name}`));const tools=el('div',null,'trip-tools');const view=button('View place',()=>showPlace(p,true));view.setAttribute('aria-label',`View ${p.name}`);tools.append(view);for(const [delta,text] of [[-1,'↑'],[1,'↓']]){const b=button(text,()=>{[trip[i],trip[i+delta]]=[trip[i+delta],trip[i]];save();renderTrip();$('content').querySelectorAll('.trip-stop')[i+delta].querySelector('button').focus();});b.disabled=i+delta<0||i+delta>=trip.length;b.setAttribute('aria-label',`Move ${p.name} ${delta<0?'up':'down'}`);tools.append(b);}const remove=button('Remove',()=>{trip.splice(i,1);save();renderTrip(true);});remove.setAttribute('aria-label',`Remove ${p.name}`);tools.append(remove);li.append(tools);if(directions&&i<trip.length-1){const w=el('p',null,'walk');w.setAttribute('role','status');li.append(w);walk(p,places.find(p=>p.id===trip[i+1]),w);}list.append(li);});$('content').append(list);}if(setFocus)focus();}
function setupMap(){const token=typeof window.ROAM_MAPKIT_TOKEN==='string'?window.ROAM_MAPKIT_TOKEN.trim():'';let timeout;const fail=()=>{clearTimeout(timeout);mapState='unavailable';dispose();if(map){try{map.destroy();}catch{}map=null;}directions=null;$('map-status').hidden=false;$('map-status').textContent='The map is unavailable right now. Choose a place below to keep visiting.';console.warn('Roam: MapKit unavailable; check authorization, allowed origin and connectivity.');if(mode==='explore')explore();else if(mode==='trip')renderTrip();else if(selected)showPlace(selected);};if(!token){fail();return;}timeout=setTimeout(fail,25000);window.roamMapReady=()=>{try{mapkit.addEventListener('error',fail);mapkit.addEventListener('configuration-change',event=>{if(event.status!=='Initialized'||mapState!=='loading')return;try{map=new mapkit.Map('map',{region:new mapkit.CoordinateRegion(new mapkit.Coordinate(...city.center),new mapkit.CoordinateSpan(...city.span)),mapType:mapkit.Map.MapTypes.Satellite,showsUserLocationControl:false});mapTheme();for(const p of places){const marker=new mapkit.Annotation(new mapkit.Coordinate(point(p).lat,point(p).lon),()=>{const dot=el('button',null,'map-dot');dot.setAttribute('aria-label',p.name);dot.dataset.placeId=p.id;dot.onclick=e=>{e.stopPropagation();if(performance.now()-lastMapTap>500)showPlace(p);};return dot;},{title:p.name,calloutEnabled:false,displayPriority:1000,collisionMode:'none'});map.addAnnotation(marker);dots.push(marker);}
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
directions=new mapkit.Directions();mapState='ready';clearTimeout(timeout);$('map-status').hidden=true;if(selected)showPlace(selected);else if(new URL(location.href).searchParams.has('trip'))renderTrip();else $('panel').hidden=true;}catch{fail();}});mapkit.init({authorizationCallback:done=>done(token)});}catch{fail();}};const script=document.createElement('script');script.src='https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.core.js';script.crossOrigin='anonymous';script.dataset.libraries='map,annotations,overlays,services,look-around';script.dataset.callback='roamMapReady';script.onerror=fail;document.head.append(script);}
window.roamMapPoint=p=>{const v=map.convertCoordinateToPointOnPage(coord(p));return {x:v.x-scrollX,y:v.y-scrollY};};
function updateTags(){if(!map)return;const r=map.region,span=r.span.latitudeDelta;const level=span<.015?3:span<.045?2:1;let count=0;const occupied=[];for(const tag of [...tags].sort((a,b)=>a.importance-b.importance)){const c=tag.coordinate;const x=(c.longitude-r.center.longitude)/r.span.longitudeDelta*innerWidth,y=(c.latitude-r.center.latitude)/span*innerHeight,w=tag.landmark.label.length*6.5;let visible=tag.importance<=level&&Math.abs(y)<innerHeight*.42&&Math.abs(x)<innerWidth*.44&&count<18;if(visible&&occupied.some(o=>Math.abs(y-o.y)<23&&Math.abs(x-o.x)<(w+o.w)/2+8))visible=false;if(visible){count++;occupied.push({x,y,w});}if(tag.landmark.element)tag.landmark.element.style.display=visible?'':'none';}}
$('browse').onclick=()=>city&&places.length?explore(true):openSheet();$('close-panel').onclick=closeSheet;document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('panel').hidden)closeSheet();else backToSky();}});
$('neighborhood').onchange=()=>{const c=city.neighborhoods.find(n=>n.id===$('neighborhood').value).center;if(map)map.region=new mapkit.CoordinateRegion(new mapkit.Coordinate(...c),new mapkit.CoordinateSpan(.019,.023));$('place-card').hidden=true;if(!$('panel').hidden)explore();};
$('explore-tab').onclick=()=>explore(true);$('trip-tab').onclick=()=>renderTrip(true);
async function json(url){const r=await fetch(url);if(!r.ok)throw Error('City data unavailable');return r.json();}
(async()=>{const index=await json('cities/index.json');const requested=new URL(location.href).searchParams.get('city')||index.default;const entry=index.cities.find(c=>c.id===requested);if(!entry)throw Error('Unknown city');cityId=entry.id;const base='cities/'+entry.path.slice(0,entry.path.lastIndexOf('/')+1);city=await json('cities/'+entry.path);key=cityId===index.default?'roam-at-home.trip.v1':'roam-at-home.trip.v1.'+cityId;document.title=city.pageTitle;$('map-status').textContent=city.loadingText;document.querySelector('.map-area').setAttribute('aria-label',city.mapLabel);$('neighborhood').replaceChildren(...city.neighborhoods.map(n=>{const o=el('option',n.name);o.value=n.id;return o;}));[landmarks,places]=await Promise.all([json(base+city.landmarks),json(base+city.places)]);return places;})().then(data=>{places=data;const shared=new URL(location.href).searchParams.get('trip');let saved=[];try{saved=JSON.parse(localStorage.getItem(key)||'[]');}catch{}trip=[...new Set(shared!==null?shared.split(','):Array.isArray(saved)?saved:[])].filter(id=>places.some(p=>p.id===id));save();const placeId=new URL(location.href).searchParams.get('place');selected=places.find(p=>p.id===placeId);if(selected)$('neighborhood').value=selected.neighborhood_id||city.neighborhoods[0].id;if(shared!==null)renderTrip();setupMap();}).catch(()=>{openSheet();document.querySelector('#panel nav').hidden=true;$('map-status').textContent='City data could not load. Please refresh or check the city link.';$('content').append(el('h2','Places could not load'),el('p','Please refresh and try again.'));console.warn('Roam: unable to load place data.');});
})();
// Phone fix: stop Safari pinch/double-tap from zooming the whole page (it hid the street behind giant buttons)
["gesturestart","gesturechange"].forEach(t=>document.addEventListener(t,e=>e.preventDefault(),{passive:false}));

// Browser page zoom (e.g. Safari aA 200%) made controls cover the street on Art's iPhone: undo it for our controls only
function fitControls(){try{const sw=innerWidth>innerHeight?Math.max(screen.width,screen.height):Math.min(screen.width,screen.height);const r=sw/innerWidth;document.documentElement.style.setProperty('--ui',r>1.1?String(Math.max(.4,1/r)):'1');}catch{}}
fitControls();addEventListener('resize',fitControls);addEventListener('orientationchange',fitControls);
