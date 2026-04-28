import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MUNROS } from './munros.js';

/**
 * MunroMap — The unified map. All 282 peaks + live animated wind field.
 * One MapLibre instance, one tile cache, one WebGL context.
 */

const STYLES = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
};

const PEAK_THEME = {
  dark: { dot: '#93c5fd', stroke: 'rgba(15,25,40,0.8)', halo: '#60a5fa', ring: '#ffffff', label: '#fff', labelHalo: 'rgba(15,25,40,0.9)' },
  light: { dot: '#2563eb', stroke: 'rgba(255,255,255,0.9)', halo: '#3b82f6', ring: '#1e3a5f', label: '#1e293b', labelHalo: 'rgba(255,255,255,0.9)' },
};

// Stronger colors for light map so arrows pop against pale tiles
const SPEED_COLORS = {
  dark:  ['step',['get','s'],'#22c55e',4.47,'#84cc16',8.94,'#eab308',13.41,'#f97316',17.88,'#ef4444'],
  light: ['step',['get','s'],'#15803d',4.47,'#4d7c0f',8.94,'#b45309',13.41,'#c2410c',17.88,'#b91c1c'],
};

const MUNRO_GEO = {
  type: 'FeatureCollection',
  features: MUNROS.map(m => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [m.lon, m.lat] },
    properties: { name: m.name, region: m.region, h: m.h },
  })),
};

// ── Wind grid ──────────────────────────────────────────────────────────
const BOUNDS = { west: -8.0, east: -1.2, south: 55.2, north: 59.2 };
const GW = 10, GH = 7;
const PARTICLES = 300, MAX_AGE = 80, SPEED_K = 0.002;

const WIND_LOCS = [
  { name:'Lerwick',lat:60.15,lon:-1.14,k:'town' },{ name:'Kirkwall',lat:58.98,lon:-2.96,k:'town' },
  { name:'Wick',lat:58.44,lon:-3.09,k:'town' },{ name:'Stornoway',lat:58.21,lon:-6.39,k:'town' },
  { name:'Durness',lat:58.40,lon:-4.75,k:'town' },{ name:'Ullapool',lat:57.90,lon:-5.16,k:'town' },
  { name:'Inverness',lat:57.48,lon:-4.22,k:'town' },{ name:'Portree',lat:57.41,lon:-6.19,k:'town' },
  { name:'Elgin',lat:57.65,lon:-3.32,k:'town' },{ name:'Aberdeen',lat:57.15,lon:-2.09,k:'town' },
  { name:'Fort William',lat:56.82,lon:-5.11,k:'town' },{ name:'Cairn Gorm',lat:57.12,lon:-3.64,k:'peak' },
  { name:'Ben Nevis',lat:56.80,lon:-5.00,k:'peak' },{ name:'Braemar',lat:57.01,lon:-3.40,k:'town' },
  { name:'Perth',lat:56.40,lon:-3.43,k:'town' },{ name:'Dundee',lat:56.46,lon:-2.97,k:'town' },
  { name:'Oban',lat:56.42,lon:-5.47,k:'town' },{ name:'Ben Lawers',lat:56.55,lon:-4.22,k:'peak' },
  { name:'Stirling',lat:56.12,lon:-3.94,k:'town' },{ name:'Glasgow',lat:55.86,lon:-4.25,k:'town' },
  { name:'Edinburgh',lat:55.95,lon:-3.19,k:'town' },{ name:'Islay',lat:55.77,lon:-6.20,k:'town' },
  { name:'Campbeltown',lat:55.43,lon:-5.60,k:'town' },{ name:'Dumfries',lat:55.07,lon:-3.61,k:'town' },
];

function windLabel(mph) { return mph<10?'Calm':mph<20?'Light':mph<30?'Breezy':mph<40?'Strong':'Dangerous'; }
function windColor(mph) { return mph<10?'#22c55e':mph<20?'#84cc16':mph<30?'#eab308':mph<40?'#f97316':'#ef4444'; }

async function fetchGrid() {
  const pts = [];
  for (let j=0;j<GH;j++) for (let i=0;i<GW;i++)
    pts.push({i,j,lat:BOUNDS.south+(j/(GH-1))*(BOUNDS.north-BOUNDS.south),lon:BOUNDS.west+(i/(GW-1))*(BOUNDS.east-BOUNDS.west)});
  const res = await Promise.all(pts.map(async p => {
    try {
      const d = await(await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=Europe%2FLondon`)).json();
      const spd=d.current?.wind_speed_10m??0, a=((d.current?.wind_direction_10m??0)+180)%360*Math.PI/180;
      return {...p,u:Math.sin(a)*spd,v:Math.cos(a)*spd,speed:spd};
    } catch { return {...p,u:0,v:0,speed:0}; }
  }));
  const grid=new Float32Array(GW*GH*3); let mx=0;
  for (const r of res){const idx=(r.j*GW+r.i)*3;grid[idx]=r.u;grid[idx+1]=r.v;grid[idx+2]=r.speed;if(r.speed>mx)mx=r.speed;}
  return {grid,maxSpeed:mx};
}

async function fetchLocs() {
  return(await Promise.all(WIND_LOCS.map(async loc=>{
    try{
      const d=await(await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=mph&timezone=Europe%2FLondon`)).json();
      return{type:'Feature',geometry:{type:'Point',coordinates:[loc.lon,loc.lat]},properties:{
        name:loc.name,k:loc.k,speed:Math.round(d.current?.wind_speed_10m??0),
        gust:Math.round(d.current?.wind_gusts_10m??0),bearing:d.current?.wind_direction_10m??0,
        color:windColor(d.current?.wind_speed_10m??0)}};
    }catch{return null;}
  }))).filter(Boolean);
}

function sample(grid,lon,lat){
  if(lon<BOUNDS.west||lon>BOUNDS.east||lat<BOUNDS.south||lat>BOUNDS.north)return{u:0,v:0,speed:0};
  const fx=(lon-BOUNDS.west)/(BOUNDS.east-BOUNDS.west)*(GW-1),fy=(lat-BOUNDS.south)/(BOUNDS.north-BOUNDS.south)*(GH-1);
  const i0=Math.floor(fx),j0=Math.floor(fy),i1=Math.min(i0+1,GW-1),j1=Math.min(j0+1,GH-1),dx=fx-i0,dy=fy-j0;
  const s=(i,j)=>{const x=(j*GW+i)*3;return[grid[x],grid[x+1],grid[x+2]];};
  const[au,av,as]=s(i0,j0),[bu,bv,bs]=s(i1,j0),[cu,cv,cs]=s(i0,j1),[du,dv,ds]=s(i1,j1);
  return{u:(au*(1-dx)+bu*dx)*(1-dy)+(cu*(1-dx)+du*dx)*dy,v:(av*(1-dx)+bv*dx)*(1-dy)+(cv*(1-dx)+dv*dx)*dy,
    speed:(as*(1-dx)+bs*dx)*(1-dy)+(cs*(1-dx)+ds*dx)*dy};
}

function mkParticle(){return{lon:BOUNDS.west+Math.random()*(BOUNDS.east-BOUNDS.west),lat:BOUNDS.south+Math.random()*(BOUNDS.north-BOUNDS.south),age:0,maxAge:30+Math.random()*MAX_AGE};}

function mkFlowIcon(){
  const s=24,c=document.createElement('canvas');c.width=s;c.height=s;
  const x=c.getContext('2d');x.fillStyle='#fff';
  x.beginPath();x.moveTo(12,2);x.lineTo(20,14);x.lineTo(15,12);x.lineTo(15,22);x.lineTo(9,22);x.lineTo(9,12);x.lineTo(4,14);x.closePath();x.fill();
  return x.getImageData(0,0,s,s);
}

// ════════════════════════════════════════════════════════════════════════

export default function MunroMap({ onSelectMunro, selectedMunro }) {
  const cRef = useRef(null);
  const mapRef = useRef(null);
  const gridRef = useRef(null);
  const partsRef = useRef(null);
  const animRef = useRef(null);
  const locsRef = useRef(null);
  const pulseRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState(null);
  const [disambig, setDisambig] = useState(null);
  const [isLight, setIsLight] = useState(false);
  const [ctrlOpen, setCtrlOpen] = useState(false);
  const [maxMph, setMaxMph] = useState(0);
  const [selected, setSelected] = useState(null);
  const [windReady, setWindReady] = useState(false);
  const [userPos, setUserPos] = useState(null);
  const [geoErr, setGeoErr] = useState(null);

  // ── Build all layers (idempotent) ────────────────────────────────────
  function buildLayers(map, theme, selName, locFeats) {
    const p = PEAK_THEME[theme];
    const txtCol = theme==='light'?'#1e293b':'#ffffff';
    const haloCol = theme==='light'?'rgba(255,255,255,0.9)':'rgba(10,13,20,0.85)';

    // Tear down
    ['peak-label','peak-hit','peak-selected','peak-pulse','peak-dot','peak-halo',
     'flow-arrows','wind-names','wind-badges','wind-hit'].forEach(id=>{try{map.removeLayer(id)}catch{}});
    ['peaks','flow-src','wind-pts'].forEach(id=>{try{map.removeSource(id)}catch{}});

    // 1. Flow particles (bottom)
    map.addSource('flow-src',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    map.addLayer({id:'flow-arrows',type:'symbol',source:'flow-src',
      layout:{'icon-image':'flow-arrow','icon-size':0.55,'icon-rotate':['get','r'],
        'icon-rotation-alignment':'map','icon-allow-overlap':true,'icon-ignore-placement':true,'icon-padding':0},
      paint:{'icon-color':SPEED_COLORS[theme],'icon-opacity':['get','o']},
    });

    // 2. Peaks
    map.addSource('peaks',{type:'geojson',data:MUNRO_GEO});
    map.addLayer({id:'peak-halo',type:'circle',source:'peaks',paint:{
      'circle-radius':['interpolate',['linear'],['zoom'],5,5,8,8,11,11,14,15],
      'circle-color':p.halo,'circle-opacity':0.22,'circle-blur':0.9}});
    map.addLayer({id:'peak-dot',type:'circle',source:'peaks',paint:{
      'circle-radius':['interpolate',['linear'],['zoom'],5,2.5,8,3.5,11,5,14,7],
      'circle-color':p.dot,'circle-stroke-color':p.stroke,'circle-stroke-width':0.8}});
    map.addLayer({id:'peak-pulse',type:'circle',source:'peaks',
      filter:['==',['get','name'],''],paint:{
      'circle-radius':['interpolate',['linear'],['zoom'],5,12,8,16,11,20,14,24],
      'circle-color':'transparent','circle-stroke-color':p.ring,'circle-stroke-width':2,'circle-stroke-opacity':0}});
    map.addLayer({id:'peak-selected',type:'circle',source:'peaks',
      filter:['==',['get','name'],selName||''],paint:{
      'circle-radius':['interpolate',['linear'],['zoom'],5,7,8,10,11,13,14,17],
      'circle-color':'transparent','circle-stroke-color':p.ring,'circle-stroke-width':2,'circle-stroke-opacity':0.92}});

    // 3. Wind speed labels
    if (locFeats) {
      map.addSource('wind-pts',{type:'geojson',data:{type:'FeatureCollection',features:locFeats}});
      map.addLayer({id:'wind-hit',type:'circle',source:'wind-pts',paint:{'circle-radius':20,'circle-color':'transparent','circle-opacity':0}});
      map.addLayer({id:'wind-badges',type:'symbol',source:'wind-pts',
        layout:{'text-field':['to-string',['get','speed']],'text-font':['Open Sans Bold','Arial Unicode MS Bold'],
          'text-size':['interpolate',['linear'],['zoom'],5,11,8,14,11,16],'text-anchor':'center','text-allow-overlap':true},
        paint:{'text-color':txtCol,'text-halo-color':haloCol,'text-halo-width':2.2}});
      map.addLayer({id:'wind-names',type:'symbol',source:'wind-pts',
        layout:{'text-field':['get','name'],'text-font':['Open Sans Semibold','Arial Unicode MS Bold'],
          'text-size':['interpolate',['linear'],['zoom'],5,8,8,10,11,11],
          'text-anchor':'top','text-offset':[0,0.8],'text-allow-overlap':false},
        paint:{'text-color':theme==='light'?'rgba(30,41,59,0.55)':'rgba(255,255,255,0.45)',
          'text-halo-color':haloCol,'text-halo-width':1}});
    }

    // 4. Peak labels + hit (on top)
    map.addLayer({id:'peak-hit',type:'circle',source:'peaks',paint:{
      'circle-radius':['interpolate',['linear'],['zoom'],5,12,8,16,11,20,14,24],
      'circle-color':'transparent','circle-opacity':0}});
    map.addLayer({id:'peak-label',type:'symbol',source:'peaks',minzoom:9,
      layout:{'text-field':['get','name'],'text-font':['Open Sans Semibold','Arial Unicode MS Bold'],
        'text-size':['interpolate',['linear'],['zoom'],9,10,12,12],
        'text-offset':[0,1.2],'text-anchor':'top','text-allow-overlap':false,'text-optional':true},
      paint:{'text-color':p.label,'text-halo-color':p.labelHalo,'text-halo-width':1.3}});

    // Clicks
    map.on('click','peak-hit',e=>{
      const tol=22,bbox=[[e.point.x-tol,e.point.y-tol],[e.point.x+tol,e.point.y+tol]];
      const hits=map.queryRenderedFeatures(bbox,{layers:['peak-hit']});
      if(!hits.length){setPreview(null);setDisambig(null);return;}
      const seen=new Set(),pks=[];
      for(const f of hits){const n=f.properties?.name;if(!n||seen.has(n))continue;seen.add(n);const m=MUNROS.find(x=>x.name===n);if(m)pks.push(m);if(pks.length>=6)break;}
      if(pks.length===1){map.easeTo({center:[pks[0].lon,pks[0].lat],duration:400});setDisambig(null);setPreview(pks[0]);}
      else{setPreview(null);setDisambig(pks);}
    });
    map.on('click','wind-hit',e=>{
      const f=e.features?.[0];if(!f)return;
      setSelected({name:f.properties.name,k:f.properties.k,speed:f.properties.speed,gust:f.properties.gust,color:f.properties.color});
    });
    map.on('mouseenter','peak-hit',()=>{map.getCanvas().style.cursor='pointer';});
    map.on('mouseleave','peak-hit',()=>{map.getCanvas().style.cursor='';});
    map.on('click',e=>{
      const ph=map.queryRenderedFeatures(e.point,{layers:['peak-hit']});
      const wh=map.queryRenderedFeatures(e.point,{layers:['wind-hit']});
      if(!ph.length&&!wh.length){setPreview(null);setDisambig(null);setSelected(null);}
    });
  }

  // ── Animation loop ───────────────────────────────────────────────────
  function runParticles(map){
    const grid=gridRef.current,parts=partsRef.current;
    if(!grid||!parts)return;
    let fc=0;
    function tick(){
      fc++;
      if(fc%3!==0){animRef.current=requestAnimationFrame(tick);return;}
      const feats=[];
      for(let i=0;i<parts.length;i++){
        const p=parts[i];p.age++;
        if(p.age>=p.maxAge){parts[i]=mkParticle();continue;}
        const w=sample(grid,p.lon,p.lat);
        if(w.speed<0.3){parts[i]=mkParticle();continue;}
        p.lon+=w.u*SPEED_K;p.lat+=w.v*SPEED_K;
        if(p.lon<BOUNDS.west-0.3||p.lon>BOUNDS.east+0.3||p.lat<BOUNDS.south-0.3||p.lat>BOUNDS.north+0.3){parts[i]=mkParticle();continue;}
        const deg=(Math.atan2(w.u,w.v)*180/Math.PI+360)%360;
        const life=p.age/p.maxAge;
        const fade=life<0.12?life/0.12:life>0.8?(1-life)/0.2:1;
        const o=fade*(0.35+Math.min(1,w.speed/10)*0.5);
        feats.push({type:'Feature',geometry:{type:'Point',coordinates:[p.lon,p.lat]},properties:{r:Math.round(deg),o:Math.round(o*100)/100,s:Math.round(w.speed*100)/100}});
      }
      try{map.getSource('flow-src')?.setData({type:'FeatureCollection',features:feats});}catch{}
      animRef.current=requestAnimationFrame(tick);
    }
    animRef.current=requestAnimationFrame(tick);
  }

  // ── Pulse ────────────────────────────────────────────────────────────
  useEffect(()=>{
    const map=mapRef.current;if(!map||!ready)return;
    if(pulseRef.current){clearInterval(pulseRef.current);pulseRef.current=null;}
    if(preview){
      try{map.setFilter('peak-pulse',['==',['get','name'],preview.name]);}catch{}
      let ph=0;
      pulseRef.current=setInterval(()=>{
        ph=(ph+1)%40;const t=ph/40,e=0.5-0.5*Math.cos(t*Math.PI*2);
        try{map.setPaintProperty('peak-pulse','circle-stroke-opacity',0.2+e*0.5);
          map.setPaintProperty('peak-pulse','circle-stroke-width',1.5+e*1.5);}catch{}
      },50);
    } else {try{map.setFilter('peak-pulse',['==',['get','name'],'']);}catch{}}
    return()=>{if(pulseRef.current)clearInterval(pulseRef.current);};
  },[preview,ready]);

  // ── Init ─────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!cRef.current||mapRef.current)return;
    const map=new maplibregl.Map({
      container:cRef.current,style:STYLES.dark,center:[-4.2,57.0],zoom:6.2,
      minZoom:5,maxZoom:14,attributionControl:{compact:true},pitchWithRotate:false,dragRotate:false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');

    map.on('load',async()=>{
      map.addImage('flow-arrow',mkFlowIcon(),{sdf:true});
      const[gd,lf]=await Promise.all([fetchGrid(),fetchLocs()]);
      gridRef.current=gd.grid;locsRef.current=lf;
      setMaxMph(Math.round(gd.maxSpeed*2.237));
      buildLayers(map,'dark',selectedMunro?.name,lf);
      partsRef.current=Array.from({length:PARTICLES},()=>{const p=mkParticle();p.age=Math.floor(Math.random()*p.maxAge*0.6);return p;});
      setWindReady(true);setReady(true);
      runParticles(map);
    });
    mapRef.current=map;
    return()=>{cancelAnimationFrame(animRef.current);map.remove();mapRef.current=null;};
  },[]);

  // ── Theme toggle ─────────────────────────────────────────────────────
  const toggleTheme=useCallback(()=>{
    const map=mapRef.current;if(!map)return;
    cancelAnimationFrame(animRef.current);
    const next=isLight?'dark':'light';
    const center=map.getCenter(),zoom=map.getZoom();
    map.setStyle(STYLES[next]);
    const go=()=>{
      try{map.addImage('flow-arrow',mkFlowIcon(),{sdf:true});}catch{}
      buildLayers(map,next,selectedMunro?.name,locsRef.current);
      map.jumpTo({center,zoom});
      runParticles(map);
    };
    map.once('idle',go);
    setTimeout(()=>{try{if(!map.getSource('peaks'))go();}catch{}},2000);
    setIsLight(!isLight);setCtrlOpen(false);
  },[isLight,selectedMunro]);

  useEffect(()=>{
    if(!ready||!mapRef.current)return;
    try{mapRef.current.setFilter('peak-selected',['==',['get','name'],selectedMunro?.name||'']);}catch{}
    if(selectedMunro)mapRef.current.flyTo({center:[selectedMunro.lon,selectedMunro.lat],zoom:Math.max(8,mapRef.current.getZoom()),duration:800,essential:true});
  },[ready,selectedMunro]);

  const resetView=()=>{mapRef.current?.flyTo({center:[-4.2,57.0],zoom:6.2,duration:700,essential:true});setCtrlOpen(false);setPreview(null);};

  const reqLoc=()=>{
    setGeoErr(null);setCtrlOpen(false);
    if(!navigator.geolocation){setGeoErr('Not supported');setTimeout(()=>setGeoErr(null),3000);return;}
    navigator.geolocation.getCurrentPosition(
      pos=>{const p={lat:pos.coords.latitude,lon:pos.coords.longitude};setUserPos(p);mapRef.current?.flyTo({center:[p.lon,p.lat],zoom:Math.max(9,mapRef.current.getZoom()),duration:900,essential:true});},
      ()=>{setGeoErr('Location denied');setTimeout(()=>setGeoErr(null),3000);},
      {enableHighAccuracy:false,timeout:8000,maximumAge:60000}
    );
  };

  useEffect(()=>{
    if(!ready||!mapRef.current||!userPos)return;
    const el=document.createElement('div');el.className='tile-map-userpos';
    el.innerHTML='<span class="tile-map-userpos-dot"></span><span class="tile-map-userpos-pulse"></span>';
    const m=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([userPos.lon,userPos.lat]).addTo(mapRef.current);
    return()=>m.remove();
  },[ready,userPos]);

  return(
    <div className="map-overlay">
      <div className="map-header">
        <div className="map-title">
          <div className="map-eyebrow">Munro Map</div>
          <div className="map-subtitle">
            {!windReady?'Loading wind data…':`${MUNROS.length} peaks · peak wind ${maxMph} mph`}
          </div>
        </div>
      </div>
      <div ref={cRef} className="tile-map-viewport">
        <div className="map-ctrl-wrap">
          <button className="map-ctrl-toggle" onClick={()=>setCtrlOpen(!ctrlOpen)} aria-label="Map controls">
            <svg viewBox="0 0 20 20" width="16" height="16"><circle cx="4" cy="10" r="1.5" fill="currentColor"/><circle cx="10" cy="10" r="1.5" fill="currentColor"/><circle cx="16" cy="10" r="1.5" fill="currentColor"/></svg>
          </button>
          {ctrlOpen&&(
            <div className="map-ctrl-menu">
              <button className="map-ctrl-item" onClick={resetView}>
                <svg viewBox="0 0 20 20" width="14" height="14"><path d="M10 3 L10 7 M3 10 L7 10 M10 13 L10 17 M13 10 L17 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><circle cx="10" cy="10" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.6"/></svg>
                Reset view
              </button>
              <button className="map-ctrl-item" onClick={reqLoc}>
                <svg viewBox="0 0 20 20" width="14" height="14"><circle cx="10" cy="10" r="3" fill="currentColor"/><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.5"/></svg>
                My location
              </button>
              <button className="map-ctrl-item" onClick={toggleTheme}>
                <svg viewBox="0 0 20 20" width="14" height="14">
                  {isLight?<path d="M10 3a7 7 0 1 0 0 14 5 5 0 0 1 0-14z" fill="currentColor"/>
                    :<><circle cx="10" cy="10" r="3.5" fill="currentColor"/>{[0,45,90,135,180,225,270,315].map(a=>{const r=a*Math.PI/180;return<line key={a} x1={10+Math.cos(r)*5.5} y1={10+Math.sin(r)*5.5} x2={10+Math.cos(r)*7} y2={10+Math.sin(r)*7} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>})}</>}
                </svg>
                {isLight?'Dark map':'Light map'}
              </button>
            </div>
          )}
        </div>

        <div className="wind-field-legend">
          <div className="wind-field-legend-title">Wind (mph)</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{background:'#22c55e'}}/> &lt;10</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{background:'#84cc16'}}/> 10–20</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{background:'#eab308'}}/> 20–30</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{background:'#f97316'}}/> 30–40</div>
          <div className="wind-legend-row"><span className="wind-legend-dot" style={{background:'#ef4444'}}/> 40+</div>
        </div>

        {geoErr&&<div className="tile-map-toast" role="status">{geoErr}</div>}

        {selected&&(
          <div className="wind-popup" role="dialog">
            <div className="wind-popup-head">
              <div><div className="wind-popup-eyebrow">{selected.k==='peak'?'Summit':'Location'}</div><div className="wind-popup-name">{selected.name}</div></div>
              <button className="wind-popup-close" onClick={()=>setSelected(null)}>✕</button>
            </div>
            <div className="wind-popup-body">
              <div className="wind-popup-speed" style={{color:selected.color}}>{selected.speed}<span>mph</span></div>
              <div className="wind-popup-detail">
                <div className="wind-popup-label-line">{windLabel(selected.speed)}</div>
                {selected.gust>selected.speed+3&&<div className="wind-popup-gust">Gusting {selected.gust} mph</div>}
              </div>
            </div>
          </div>
        )}

        {preview&&(
          <div className="tile-map-preview" role="dialog">
            <div className="tile-map-preview-eyebrow">{preview.region}</div>
            <div className="tile-map-preview-name">{preview.name}</div>
            <div className="tile-map-preview-meta"><span>{preview.h.toLocaleString()}m</span><span className="tile-map-preview-sep">·</span><span>Munro</span></div>
            <div className="tile-map-preview-actions">
              <button className="tile-map-preview-cancel" onClick={()=>setPreview(null)}>Close</button>
              <button className="tile-map-preview-confirm" onClick={()=>{const p=preview;setPreview(null);onSelectMunro(p);}}>View forecast →</button>
            </div>
          </div>
        )}

        {disambig&&(
          <div className="tile-map-disambig" role="dialog">
            <div className="tile-map-disambig-head">
              <div className="tile-map-disambig-eyebrow">{disambig.length} peaks here</div>
              <button className="tile-map-disambig-close" onClick={()=>setDisambig(null)}>✕</button>
            </div>
            <div className="tile-map-disambig-list">
              {disambig.sort((a,b)=>b.h-a.h).map(m=>(
                <button key={m.name} className="tile-map-disambig-item" onClick={()=>{mapRef.current?.easeTo({center:[m.lon,m.lat],duration:400});setDisambig(null);setPreview(m);}}>
                  <div className="tile-map-disambig-item-name">{m.name}</div>
                  <div className="tile-map-disambig-item-meta">{m.region} · {m.h.toLocaleString()}m</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
