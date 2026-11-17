/* v69 regression checks; no Firebase credentials or network required. */
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const docs=path.join(__dirname,'docs');
const manifest={};
const urls=[];const links=[];let imagesLoaded=0;
const base='https://school.github.io/rpg-typing-versus/';
class FakeImage{
  constructor(){this.decoding='async';this.naturalWidth=100;this.complete=false;}
  set src(value){this._src=value;urls.push(value);this.complete=true;imagesLoaded++;queueMicrotask(()=>this.onload?.());}
  get src(){return this._src;}
  decode(){return Promise.resolve();}
}
const sandbox={window:{},Image:FakeImage,URL,Promise,Map,Set,setTimeout,clearTimeout,console,requestIdleCallback:fn=>{fn();return 1;},cancelIdleCallback:()=>{},navigator:{connection:{saveData:false,effectiveType:'4g'}},document:{baseURI:base,head:{appendChild(el){links.push(el)}},createElement(tag){assert.equal(tag,'link');return {};}}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(docs,'asset-manifest.js'),'utf8'),sandbox);
vm.runInContext(fs.readFileSync(path.join(docs,'media-loader.js'),'utf8'),sandbox);
const media=sandbox.window.RPG_MEDIA;
assert.equal(media.has(''),false);
assert.equal(media.has('stage1_bg.webp'),false);
assert.equal(media.has('stage2_bgm.m4a'),false);
assert.equal(media.has('icon01.webp'),true);
assert.equal(media.has('assets/boss_hit.m4a'),true);
const version=media.url('icon01.webp');
assert.match(version,/\/icon01.webp\?v=[a-f0-9]{12}$/);
assert.equal(media.url('https://media.example.org/stage.webp'),'https://media.example.org/stage.webp');
assert.equal(media.url('stage1_bg.webp'),'');
assert.equal(sandbox.window.RPG_ASSET_MANIFEST['icon01.webp'].bytes>0,true);
(async()=>{
 await Promise.all([media.image('icon01.webp'),media.image('icon01.webp')]);
 assert.equal(imagesLoaded,1,'deduplicates same image preload');
 await media.stage({bgFile:'stage1_bg.webp',bossFile:'stage1_boss.webp',bossFile2:'stage1_boss2.webp',playBgmFile:'stage1_bgm.m4a'});
 assert.equal(imagesLoaded,1,'missing stage assets do not request');
 assert.equal(links.length,0,'missing soundtrack does not prefetch');
 media.next({bgFile:'icon02.webp',bossFile:'stage1_boss.webp',playBgmFile:'assets/boss_hit.m4a'});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(imagesLoaded,2,'next stage art preloads');
 assert.equal(links.length,1,'real audio prefetches exactly once');
 assert.match(links[0].href,/boss_hit.m4a\?v=/);
 const game=fs.readFileSync(path.join(docs,'adventure_engine.js'),'utf8');
 const boot=fs.readFileSync(path.join(docs,'online-boot-v66.js'),'utf8');
 const html=fs.readFileSync(path.join(docs,'adventure.html'),'utf8');
 assert(!game.includes('img.src = `${bgFile}?v=${Date.now()}`'),'removed always-changing cache buster');
 assert(!game.includes('bgImg.src = nextBgSrc'),'removed empty-background direct assignment');
 assert(!game.includes('stopBgm(); return;\n    bgm.loop'),'removed disabled BGM code');
 assert(game.includes('window.RPG_MEDIA?.next(STAGES[stageIndex+1])'),'preload next stage');
 assert(game.includes('window.RPG_MEDIA?.stage(STAGES[0],true)'),'overlap first stage prep');
 assert(/file\+'\?v=\d+'/.test(boot),'versioned game scripts load consistently');
 assert(html.includes('asset-manifest.js?v=69'),'manifest loaded');
 assert(html.includes('media-loader.js?v=69'),'loader loaded');
 for(const name of ['assets/characters/crimson_knight.webp','assets/characters/silver_knight.webp','icon01.webp','icon02.webp']){
    const bytes=fs.statSync(path.join(docs,name)).size;
    assert(bytes<160000,`${name} optimized`);
 }
 console.log('PASS: 18 asset/cache/preload/startup/static checks');
})().catch(e=>{console.error(e);process.exitCode=1});
