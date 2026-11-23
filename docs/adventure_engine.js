
(() => {
  "use strict";
  // Browser-scoped renderer cache; Firebase remains authoritative for online play.
  const ADVENTURE_CONTEXT = window.ADVENTURE_PLAYER || {};
  const ADVENTURE_SCOPE = String(ADVENTURE_CONTEXT.public_id || "guest").replace(/[^A-Z0-9_-]/gi, "").slice(0,32);
  const adventureKey = (k) => `${k}__${ADVENTURE_SCOPE}`;


  const clamp = (v,a,b)=> Math.max(a, Math.min(b,v));
  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }
  async function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

function fitAnswerToRight(wordEl){
    try{
      const el = wordEl && (wordEl.el || wordEl);
      if(!el) return;

      const ans = el.querySelector(".answer");
      const right = el.querySelector(".right");
      if(!ans || !right) return;

      // Reset any previous fitting
      ans.style.fontSize = "";
      ans.style.transform = "";

      // Available width inside the right block
      const maxW = Math.max(60, right.clientWidth - 6);

      // Measure once; avoid repeated reflow loops
      const sw = ans.scrollWidth;

      if(sw > maxW){
        const scale = maxW / Math.max(1, sw);
        const clamped = Math.max(0.72, Math.min(1, scale));
        ans.style.transformOrigin = "right center";
        ans.style.transform = `scaleX(${clamped.toFixed(3)})`;
      }
    }catch(_){}
  }

  // ✅ VOCAB SETS BY CLASS YEAR
  // Built-in lists are now fallbacks only.
  // Firebase Vocabulary Manager is authoritative for online play.
  // Group B is one shared list for 1B, 2B and 3B.
  // Built-in vocabulary is for rendering initialization only; it may NEVER authorize a new run.
  // Firebase vocabulary is required before each run.
  const DEFAULT_CLASS_YEAR = "1";
  const LS_KEY_VOCAB_CACHE_PREFIX = "bossTyping_vocabCache_v1_";

  const YEAR_1_WORDS = [

    { prompt:"(...を)勉強する", answer:"study" },
    { prompt:"読む", answer:"read" },
    { prompt:"来る", answer:"come" },
    { prompt:"を持っている", answer:"have" },
    { prompt:"...を教える", answer:"teach" },
    { prompt:"泳ぐ", answer:"swim" },
    { prompt:"知っている", answer:"know" },
    { prompt:"...がわかる", answer:"see" },
    { prompt:"を書く", answer:"write" },
    { prompt:"...をする", answer:"do" },
    { prompt:"行く", answer:"go" },
    { prompt:"(ことば)を話す", answer:"speak" },
    { prompt:"...を得る", answer:"get" },
    { prompt:"大きい", answer:"big" },
    { prompt:"広い", answer:"large" },
    { prompt:"小さい", answer:"small" },
    { prompt:"高い", answer:"high" },
    { prompt:"背の高い", answer:"tall" },
    { prompt:"長い", answer:"long" },
    { prompt:"短い", answer:"short" },
    { prompt:"英語", answer:"English" },
    { prompt:"日本語", answer:"Japanese" },
    { prompt:"晴れた", answer:"sunny" },
    { prompt:"くもった", answer:"cloudy" },
    { prompt:"正しい、右", answer:"right" },
    { prompt:"左(に、へ)", answer:"left" },
    { prompt:"忙しい", answer:"busy" },
    { prompt:"ひまな", answer:"free" },
    { prompt:"よい", answer:"good" },
    { prompt:"すてきな", answer:"nice" },
    { prompt:"おもしろい", answer:"interesting" },
    { prompt:"美しい", answer:"beautiful" },
    { prompt:"遅く", answer:"late" },
    { prompt:"だれ", answer:"who" },
    { prompt:"何", answer:"what" },
    { prompt:"いつ", answer:"when" },
    { prompt:"どこ", answer:"where" },
    { prompt:"なぜ", answer:"why" },
    { prompt:"どちら", answer:"which" },
    { prompt:"だれの", answer:"whose" },
    { prompt:"どうやって", answer:"how" },
    { prompt:"すぐに", answer:"soon" },
    { prompt:"すべて", answer:"all" },
    { prompt:"ここで[に]", answer:"here" },
    { prompt:"そこに[で、へ]", answer:"there" },
    { prompt:"家へ", answer:"home" },
    { prompt:"速く", answer:"fast" },
    { prompt:"お願いします", answer:"please" },
    { prompt:"上手に", answer:"well" },
    { prompt:"確信している", answer:"sure" },
  ];

  const YEAR_2_WORDS = [
    // Add 2nd-year vocab here, for example:
    // { prompt:"例文", answer:"example" },
  ];

  const YEAR_3_WORDS = [
    // Add 3rd-year vocab here, for example:
    // { prompt:"卒業", answer:"graduation" },
  ];

  let assignedVocabPool = null;
  let assignedVocabGrade = null;
  let assignedVocabRevision = 0;
  let assignedRankGrade = null;
  let vocabLastServerSuccess = !!window.RPG_VERIFIED_VOCAB_SYNC_AT;
  let vocabLastError = '';
  let vocabServerRejected = false;
  // v86.8: fetched-and-verified vocabulary, scoped to the signed-in Adventure Card.
  // Built-in words and legacy unscoped caches are NOT trusted for a playable run.
  const OFFLINE_VOCAB_KEY = adventureKey('bossTyping_verifiedVocab_v3');
  const VOCAB_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
  let vocabRefreshedAt = Number(window.RPG_VERIFIED_VOCAB_SYNC_AT)||0;
  let vocabRefreshInFlight = null;
  let vocabRefreshMode = null;
  let verifiedSessionVocab = null;
  let vocabRefreshedForMode = window.RPG_VERIFIED_VOCAB_SYNC_AT?'normal':null;
  let runLocalOnly = false; // Never save cloud progress, unlocks, coins or rankings from cached runs.
  let offlineBadge = null;
  function unverifiedRun(){return runLocalOnly||!ADVENTURE_CONTEXT.online||Boolean(window.RPG_V66_DISCONNECTED)||!navigator.onLine;}
  function verifiedCache(){
    try{
      const data=verifiedSessionVocab||JSON.parse(localStorage.getItem(OFFLINE_VOCAB_KEY)||'null');
      if(!data || data.v!==3 || data.publicId!==ADVENTURE_SCOPE ||
        !['1','2','3','b'].includes(data.pool) ||
        !/^[123]b?$/.test(String(data.rankGrade||'')) ||
        !['1','2','3'].includes(String(data.grade||'')) ||
        (data.pool==='b')!==String(data.rankGrade).endsWith('b') ||
        String(data.rankGrade)[0]!==String(data.grade) ||
        !Number.isInteger(data.revision) || data.revision<1 ||
        !Number.isFinite(data.updatedAt) || data.updatedAt>Date.now()+60_000 ||
        !Array.isArray(data.words) || data.words.length>1000)return null;
      const words=uniqueWordsByAnswer(data.words);
      if(words.length!==data.words.length)return null;
      return {...data,words};
    }catch(_){return null;}
  }
  function cacheVerifiedVocab(data,words){
    try{
      if(!ADVENTURE_SCOPE || ADVENTURE_SCOPE==='guest')return;
      verifiedSessionVocab={v:3,publicId:ADVENTURE_SCOPE,pool:data.pool,grade:data.grade,rankGrade:data.rank_grade,
        revision:Number(data.revision),updatedAt:Date.now(),words};
      localStorage.setItem(OFFLINE_VOCAB_KEY,JSON.stringify(verifiedSessionVocab));
    }catch(_){/* Cache may be unavailable on restricted devices. */}
  }
  function restoreVerifiedVocab(){
    const cached=verifiedCache();
    if(!cached)return false;
    assignedVocabPool=cached.pool;
    assignedVocabGrade=cached.grade;
    assignedRankGrade=cached.rankGrade;
    assignedVocabRevision=cached.revision;
    activeClassYear=cleanClassYear(cached.grade);
    WORDS=cached.words;
    vocabSourceLabel='saved vocabulary';
    applyWordsToStageLists();
    if(currentMode==='story'&&storyBattleStage)storyBattleStage.words=WORDS;
    return true;
  }
  function updateOfflineBadge(){
    if(!offlineBadge){
      offlineBadge=document.createElement('div');
      offlineBadge.id='offlineRunBadge';
      offlineBadge.setAttribute('role','status');
      offlineBadge.textContent='CACHED VOCAB · UNRANKED · NOT SAVED';
      offlineBadge.style.cssText='position:fixed;z-index:6000;top:5px;left:50%;transform:translateX(-50%);max-width:94vw;padding:6px 12px;background:#fff4b3;color:#171717;border:3px solid #ffe100;font:800 12px/1.3 system-ui;text-align:center;pointer-events:none;box-shadow:0 2px 12px #0007';
      document.body.appendChild(offlineBadge);
    }
    offlineBadge.hidden=!runLocalOnly;
  }
  function setLocalOnlyRun(value){
    runLocalOnly=Boolean(value);
    if(runLocalOnly){
      try{clearTimeout(soloSyncTimer);clearTimeout(profileCloudSaveTimer);}catch(_){}
    }
    updateOfflineBadge();
  }
  let activeClassYear = DEFAULT_CLASS_YEAR;
  let vocabSourceLabel = "fallback";
  let WORDS = getWordsForClassYear(activeClassYear);

  function cleanClassYear(value){
    const raw = String(value ?? "").trim().toLowerCase();
    if(raw === "1" || raw === "1st" || raw === "year1" || raw === "year_1" || raw === "first") return "1";
    if(raw === "2" || raw === "2nd" || raw === "year2" || raw === "year_2" || raw === "second") return "2";
    if(raw === "3" || raw === "3rd" || raw === "year3" || raw === "year_3" || raw === "third") return "3";
    return DEFAULT_CLASS_YEAR;
  }

  function getClassYearLabel(value){
    const y = cleanClassYear(value);
    if(assignedRankGrade === y+'b')return y.toUpperCase()+'B';
    if(y === "1") return "1st Year";
    if(y === "2") return "2nd Year";
    if(y === "3") return "3rd Year";
    return "1st Year";
  }

  function cleanVocabWord(w){
    if(!w || typeof w !== "object") return null;
    const prompt = String(w.prompt ?? w.japanese ?? w.jp ?? "").trim();
    const answer = String(w.answer ?? w.english ?? w.en ?? "").trim();
    if(!prompt || !answer) return null;
    return { prompt, answer };
  }

  function uniqueWordsByAnswer(list){
    const seen = new Set();
    const out = [];
    for(const raw of Array.isArray(list) ? list : []){
      const w = cleanVocabWord(raw);
      if(!w) continue;
      const key = String(w.answer || "").trim().toLowerCase();
      if(!key || seen.has(key)) continue;
      seen.add(key);
      out.push(w);
    }
    return out;
  }

  function getFallbackWordsForClassYear(value){
    const y = cleanClassYear(value);
    if(y === "3") return uniqueWordsByAnswer([...YEAR_1_WORDS, ...YEAR_2_WORDS, ...YEAR_3_WORDS]);
    if(y === "2") return uniqueWordsByAnswer([...YEAR_1_WORDS, ...YEAR_2_WORDS]);
    return uniqueWordsByAnswer(YEAR_1_WORDS);
  }

  function getVocabCacheKey(value){
    return LS_KEY_VOCAB_CACHE_PREFIX + (value === 'b' ? 'b' : cleanClassYear(value));
  }

  function loadCachedWordsForClassYear(value){
    try{
      const raw = localStorage.getItem(getVocabCacheKey(value));
      if(!raw) return [];
      const data = JSON.parse(raw);
      const words = uniqueWordsByAnswer(data && data.words);
      return words.length ? words : [];
    }catch(_){
      return [];
    }
  }

  function saveCachedWordsForClassYear(value, words){
    try{
      const cleanWords = uniqueWordsByAnswer(words);
      if(!cleanWords.length) return false;
      localStorage.setItem(getVocabCacheKey(value), JSON.stringify({
        v: 1,
        classYear: cleanClassYear(value),
        words: cleanWords,
        updatedAt: Date.now()
      }));
      return true;
    }catch(_){
      return false;
    }
  }

  function getWordsForClassYear(value){
    const verified=verifiedCache();
    // Never substitute a previous student's or different class's word list.
    if(verified && (assignedVocabPool===verified.pool ||
       (!assignedVocabPool && verified.pool!=='b' && cleanClassYear(value)===verified.grade))){
      vocabSourceLabel='verified cache';
      return verified.words;
    }
    const cached = loadCachedWordsForClassYear(value);
    if(cached.length){
      vocabSourceLabel = "cache";
      return cached;
    }
    vocabSourceLabel = "fallback";
    return getFallbackWordsForClassYear(value);
  }

  function applyWordsToStageLists(){
    try{
      const groups = [
        (typeof STAGES_NORMAL !== "undefined" ? STAGES_NORMAL : null),
        (typeof STAGES_EXTRA !== "undefined" ? STAGES_EXTRA : null),
        (typeof STAGES_PRACTICE !== "undefined" ? STAGES_PRACTICE : null),
        (typeof STAGES_CHALLENGE !== "undefined" ? STAGES_CHALLENGE : null),
      ];
      for(const group of groups){
        if(!Array.isArray(group)) continue;
        for(const st of group){ if(st) st.words = WORDS; }
      }
    }catch(_){/* stage arrays may not exist yet during early startup */}
  }

  function applyClassYearToVocab(value, sourceWords=null, sourceLabel=""){
    activeClassYear = cleanClassYear(value);
    const cleanSourceWords = uniqueWordsByAnswer(sourceWords);
    if(cleanSourceWords.length){
      WORDS = cleanSourceWords;
      vocabSourceLabel = sourceLabel || "sheets";
    }else{
      WORDS = getWordsForClassYear(assignedVocabGrade===activeClassYear && assignedVocabPool ? assignedVocabPool : activeClassYear);
    }
    applyWordsToStageLists();
    return activeClassYear;
  }

  async function refreshVocabFromServer(mode='normal', options={}){
    if(!ADVENTURE_CONTEXT.card_code || !ADVENTURE_CONTEXT.online || window.RPG_V66_DISCONNECTED || !navigator.onLine){
      vocabLastServerSuccess=false;return false;
    }
    // Never replace a word pool under a playing battle.
    if(typeof gameState!=='undefined'&&gameState==='playing')return false;
    if(vocabRefreshInFlight){
      if(vocabRefreshMode===mode)return vocabRefreshInFlight;
      await vocabRefreshInFlight; // Different pool; never reuse its response.
    }
    vocabRefreshMode=mode;
    vocabRefreshInFlight=(async()=>{
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),11000);
      try{
        const response=await fetch('/api/vocab/load',{
          method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
          body:JSON.stringify({card_code:ADVENTURE_CONTEXT.card_code,mode:mode==='shared'?'shared':'normal'}),
          signal:controller.signal
        });
        const data=await response.json();
        if(!response.ok||!data.ok)throw Error(data.error||'Vocabulary unavailable.');
        vocabLastError='';vocabServerRejected=false;
        const nextWords=uniqueWordsByAnswer(data.words);
        // An empty active list is authoritative: never resurrect removed teacher words.
        if(mode==='shared'){
          SHARED_WORDS=nextWords;SHARED_STAGE[0].words=SHARED_WORDS;
          SHARED_RULESET=data.ruleset;resetSharedBuckets();
        }else{
          assignedVocabPool=data.pool;
          assignedVocabGrade=data.grade;
          assignedVocabRevision=data.revision;
          assignedRankGrade=data.rank_grade;
          activeClassYear=cleanClassYear(data.grade);
          WORDS=nextWords;
          vocabSourceLabel='Firebase';
          cacheVerifiedVocab(data,nextWords);
          applyWordsToStageLists();
          if(profile&&profile.classYear!==activeClassYear){profile.classYear=activeClassYear;saveProfile(profile);}
        }
        vocabRefreshedAt=Date.now();vocabRefreshedForMode=mode==='shared'?'shared':'normal';vocabLastServerSuccess=true;
        return true;
      }catch(e){
        console.warn('Classroom vocabulary not loaded:',e);
        const message=String(e?.message||e).slice(0,230);
        vocabLastError=e?.name==='AbortError'?'Vocabulary download timed out. Try again when connected.':message;
        // Missing assignment, revoked cards, and missing pools must not bypass teacher controls.
        vocabServerRejected=/assign your class|not registered|disabled|expired|card.*missing|card.*match|session|vocabulary pool not installed|Firebase setup incomplete|missing or insufficient permissions/i.test(message);
        vocabLastServerSuccess=false;
        return false;
      }finally{clearTimeout(timer);}
    })();
    try{return await vocabRefreshInFlight;}
    finally{vocabRefreshInFlight=null;vocabRefreshMode=null;}
  }

  async function refreshVocabFromCloud(value, options={}){
    // Server is the primary source. Google Sheets does not silently overwrite
    // teacher-managed word lists; CSV import is available in Vocabulary Manager.
    return refreshVocabFromServer('normal',options);
  }

  // ---- Google Sheets StageConfig cache ----
  // StageConfig lets you edit difficulty in Google Sheets without editing this HTML.
  // The game uses cached settings immediately and refreshes from Sheets in the background.
  // Updated values are applied at the next stage/mode start, not mid-battle.
  const LS_KEY_STAGE_CONFIG_CACHE = "bossTyping_stageConfigCache_v1";
  const STAGE_CONFIG_FIELDS = ["bossMaxHp", "hitDamage", "spawnEveryMs", "fallSpeedPxPerSec"];
  let stageConfigSourceLabel = "built-in";

  function cleanStageConfigMode(value){
    const raw = String(value || "").trim().toLowerCase();
    if(raw === "ex" || raw === "extra" || raw === "extra mode") return "extra";
    if(raw === "practice" || raw === "practice mode") return "practice";
    if(raw === "challenge" || raw === "challenge mode") return "challenge";
    return "normal";
  }

  function cleanStageConfigRow(raw){
    if(!raw || typeof raw !== "object") return null;
    const mode = cleanStageConfigMode(raw.mode || raw.gameMode || raw.stageMode);
    const stage = Math.trunc(Number(raw.stage || raw.stageNumber || raw.stageIndex || 0));
    if(!stage || stage < 1 || stage > 50) return null;

    const out = { mode, stage };
    for(const key of STAGE_CONFIG_FIELDS){
      const n = Number(raw[key]);
      if(Number.isFinite(n) && n > 0) out[key] = Math.round(n);
    }
    return Object.keys(out).length > 2 ? out : null;
  }

  function uniqueStageConfigs(list){
    const map = new Map();
    for(const raw of Array.isArray(list) ? list : []){
      const cfg = cleanStageConfigRow(raw);
      if(!cfg) continue;
      map.set(`${cfg.mode}:${cfg.stage}`, cfg);
    }
    return [...map.values()];
  }

  function saveCachedStageConfig(configs){
    try{
      const cleanConfigs = uniqueStageConfigs(configs);
      localStorage.setItem(LS_KEY_STAGE_CONFIG_CACHE, JSON.stringify({
        v: 1,
        configs: cleanConfigs,
        updatedAt: Date.now()
      }));
      return true;
    }catch(_){
      return false;
    }
  }

  function loadCachedStageConfig(){
    try{
      const raw = localStorage.getItem(LS_KEY_STAGE_CONFIG_CACHE);
      if(!raw) return [];
      const data = JSON.parse(raw);
      return uniqueStageConfigs(data && data.configs);
    }catch(_){
      return [];
    }
  }

  function stageGroupsForConfig(){
    return {
      normal: (typeof STAGES_NORMAL !== "undefined" ? STAGES_NORMAL : []),
      extra: (typeof STAGES_EXTRA !== "undefined" ? STAGES_EXTRA : []),
      practice: (typeof STAGES_PRACTICE !== "undefined" ? STAGES_PRACTICE : []),
      challenge: (typeof STAGES_CHALLENGE !== "undefined" ? STAGES_CHALLENGE : [])
    };
  }

  function rememberStageBaseConfigs(){
    const groups = stageGroupsForConfig();
    Object.keys(groups).forEach(mode => {
      const arr = groups[mode];
      if(!Array.isArray(arr)) return;
      arr.forEach(stage => {
        if(!stage || stage.__baseStageConfig) return;
        Object.defineProperty(stage, "__baseStageConfig", {
          value: {
            bossMaxHp: stage.bossMaxHp,
            hitDamage: stage.hitDamage,
            spawnEveryMs: stage.spawnEveryMs,
            fallSpeedPxPerSec: stage.fallSpeedPxPerSec
          },
          enumerable: false,
          configurable: true
        });
      });
    });
  }

  function resetStagesToBaseConfigs(){
    const groups = stageGroupsForConfig();
    Object.keys(groups).forEach(mode => {
      const arr = groups[mode];
      if(!Array.isArray(arr)) return;
      arr.forEach(stage => {
        if(stage && stage.__baseStageConfig) Object.assign(stage, stage.__baseStageConfig);
      });
    });
  }

  function applyStageConfigsToStageLists(configs, sourceLabel="cache"){
    rememberStageBaseConfigs();
    resetStagesToBaseConfigs();

    const cleanConfigs = uniqueStageConfigs(configs);
    if(!cleanConfigs.length){
      stageConfigSourceLabel = "built-in";
      return 0;
    }

    const groups = stageGroupsForConfig();
    let applied = 0;
    for(const cfg of cleanConfigs){
      const arr = groups[cfg.mode];
      if(!Array.isArray(arr)) continue;
      const stage = arr[cfg.stage - 1];
      if(!stage) continue;
      for(const key of STAGE_CONFIG_FIELDS){
        if(Number.isFinite(Number(cfg[key])) && Number(cfg[key]) > 0){
          stage[key] = Math.round(Number(cfg[key]));
        }
      }
      applied++;
    }
    stageConfigSourceLabel = applied ? sourceLabel : "built-in";
    return applied;
  }

  function applyCachedStageConfigToStageLists(){
    return applyStageConfigsToStageLists(loadCachedStageConfig(), "cache");
  }

  async function refreshStageConfigFromCloud(options={}){
    const quiet = !!(options && options.quiet);
    try{
      if(typeof cloudSyncEnabled !== "function" || !cloudSyncEnabled()) return false;
      const url = String(PROFILE_CLOUD_WEB_APP_URL || "").trim();
      const qs = new URLSearchParams();
      qs.set("action", "stageConfig");
      const res = await fetch(`${url}?${qs.toString()}`, { method:"GET", cache:"no-store" });
      const text = await res.text();
      let json = null;
      try{ json = JSON.parse(text); }catch(_){ throw new Error("StageConfig returned a non-JSON response."); }
      if(!json.ok) throw new Error(json.error || "Could not load StageConfig from Google Sheets.");

      const configs = uniqueStageConfigs(json.configs || []);
      saveCachedStageConfig(configs);

      // Safe rule: do not mutate the active battle's current stage in the middle of gameplay.
      // Cached settings will be applied by startStage() before the next stage begins.
      let stageConfigIsPlaying = false;
      try{ stageConfigIsPlaying = (gameState === "playing"); }catch(_){ stageConfigIsPlaying = false; }
      if(!stageConfigIsPlaying) applyStageConfigsToStageLists(configs, "Google Sheets");

      if(!quiet && typeof setCloudStatus === "function"){
        setCloudStatus(configs.length
          ? `Stage settings loaded from Google Sheets (${configs.length} rows). They apply from the next stage start.`
          : "No active StageConfig rows found. Using built-in stage settings.");
      }
      return true;
    }catch(err){
      console.warn("StageConfig refresh failed:", err);
      if(!quiet && typeof setCloudStatus === "function") setCloudStatus("Could not refresh StageConfig. Using cached/built-in settings.", true);
      return false;
    }
  }

  const AUDIO = {
    victoryBgm: "",
    deathBgm: "",
    bossHitSfx: "assets/boss_hit.m4a",
    playerHitSfx: "assets/player_hit.m4a",
    dialogueBgm: "",
    extraDialogueBgm: "",
    extraVictoryBgm: "",
  };

  let STAGES = [
    {
      stageName: "Stage 1",
      bossName: "Luna",
      bossDialogue: "You look strong！",
      midFightDialogue: "I won't give up!",
      bossMaxHp: 22,
      hitDamage: 1,
      spawnEveryMs: 2950,
      fallSpeedPxPerSec: 41,
      bgFile: "",
      bossFile: "",
      dialogueBgmFile: "",
      playBgmFile: "",
      playBgmLoop: true,
      words: WORDS
    },
    {
      stageName: "Stage 2",
      bossName: "Syntax",
      bossDialogue: "Beep, boop, beep.",
      midFightDialogue: "Missed a space…",
      bossMaxHp: 25,
      hitDamage: 1,
      spawnEveryMs: 2850,
      fallSpeedPxPerSec: 44,
      bgFile: "",
      bossFile: "",
      dialogueBgmFile: "",
      playBgmFile: "",
      playBgmLoop: true,
      words: WORDS
    },
    {
      stageName: "Stage 3",
      bossName: "Spook",
      bossDialogue: "Ghosts aren’t scary…",
      midFightDialogue: "Boo!",
      bossMaxHp: 30,
      hitDamage: 1,
      spawnEveryMs: 2750,
      fallSpeedPxPerSec: 49,
      bgFile: "",
      bossFile: "",
      dialogueBgmFile: "",
      playBgmFile: "",
      playBgmLoop: true,
      words: WORDS
    },
    {
      stageName: "Stage 4",
      bossName: "Pesty",
      bossDialogue: "It's alive!",
      midFightDialogue: "Oh no...",
      bossMaxHp: 34,
      hitDamage: 1,
      spawnEveryMs: 2850,
      fallSpeedPxPerSec: 51,
      bgFile: "",
      bossFile: "",
      dialogueBgmFile: "",
      playBgmFile: "",
      playBgmLoop: true,
      words: WORDS
    },
    {
      stageName: "Stage 5",
      bossName: "Stella",
      bossDialogue: "Are you looking for me?",
      midFightDialogue: "Brighter!",
      bossMaxHp: 28,
      hitDamage: 1,
      spawnEveryMs: 2550,
      fallSpeedPxPerSec: 58,
      bgFile: "",
      bossFile: "",
      dialogueBgmFile: "",
      playBgmFile: "",
      playBgmLoop: true,
      words: WORDS
    }
  ];
// ---- Mode select (Normal / Extra) ----
const LS_KEY_NORMAL_CLEARED = adventureKey("bossTyping_normalCleared_v1");
function loadNormalCleared(){
  try{ return localStorage.getItem(LS_KEY_NORMAL_CLEARED) === "1"; }catch(_){ return false; }
}
function saveNormalCleared(){
  if(unverifiedRun())return;
  try{ localStorage.setItem(LS_KEY_NORMAL_CLEARED, "1"); queueAdventureSync(); }catch(_){}
}



// Extra mode cleared (final extra stage beaten) -> unlock Master intro visuals/audio
const LS_KEY_EXTRA_CLEARED = adventureKey("bossTyping_extraCleared_v1");
function loadExtraCleared(){
  try{ return localStorage.getItem(LS_KEY_EXTRA_CLEARED) === "1"; }catch(_){ return false; }
}
function saveExtraCleared(){
  if(unverifiedRun())return;
  try{ localStorage.setItem(LS_KEY_EXTRA_CLEARED, "1"); queueAdventureSync(); }catch(_){}
}


  // ---- Memory wipe cheat (persistent data reset) ----
function wipeGameMemory(){
  // Remove only this game's stored keys (do not touch other sites' data).
  try{
    const rm = [];
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      // Only clear progress for the current Player Card, not other students on this Chromebook.
      if(k && k.startsWith("bossTyping_") && k.endsWith("__" + ADVENTURE_SCOPE)) rm.push(k);
    }
    rm.forEach(k => localStorage.removeItem(k));
  }catch(_){/* ignore */}
  try{
    const rm = [];
    for(let i=0;i<sessionStorage.length;i++){
      const k = sessionStorage.key(i);
      // Only clear progress for the current Player Card, not other students on this Chromebook.
      if(k && k.startsWith("bossTyping_") && k.endsWith("__" + ADVENTURE_SCOPE)) rm.push(k);
    }
    rm.forEach(k => sessionStorage.removeItem(k));
  }catch(_){/* ignore */}

  // Reset in-memory mirrors (safe even if not yet initialized).
  try{ normalCleared = false; }catch(_){/* ignore */}
  try{ introIsUnlocked = false; }catch(_){/* ignore */}
  try{ debugMode = false; }catch(_){/* ignore */}
  try{ scoreNormal = 0; scoreExtra = 0; }catch(_){/* ignore */}
  try{ hiScoreNormal = 0; hiScoreExtra = 0; }catch(_){/* ignore */}
  try{ continuesUsedThisRun = 0; }catch(_){/* ignore */}
  try{ profile = null; }catch(_){/* ignore */}
  try{ renderProfileHeader(); }catch(_){/* ignore */}
}

// ---- Debug mode (playtesting) ----
const SS_KEY_DEBUG_MODE = "bossTyping_debugMode_v1";
function loadDebugMode(){
  try{ return sessionStorage.getItem(SS_KEY_DEBUG_MODE) === "1"; }catch(_){ return false; }
}
function saveDebugMode(on){
  try{ sessionStorage.setItem(SS_KEY_DEBUG_MODE, on ? "1" : "0"); }catch(_){}
}

// ---- High score (persistent) ----
// Separate best scores for Normal / Extra. (Current run score resets on restart.)
const LS_KEY_HISCORE_NORMAL = adventureKey("bossTyping_hiScore_normal_v1");
const LS_KEY_HISCORE_EXTRA  = adventureKey("bossTyping_hiScore_extra_v1");

function loadHighScore(mode){
  try{
    const k = (mode === "extra") ? LS_KEY_HISCORE_EXTRA : LS_KEY_HISCORE_NORMAL;
    const v = parseInt(localStorage.getItem(k) || "0", 10);
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  }catch(_){ return 0; }
}
function saveHighScore(mode, val){
  if(unverifiedRun())return;
  try{
    const k = (mode === "extra") ? LS_KEY_HISCORE_EXTRA : LS_KEY_HISCORE_NORMAL;
    const n = Math.max(0, Math.floor(Number(val) || 0));
    localStorage.setItem(k, String(n)); queueAdventureSync();
  }catch(_){ /* ignore */ }
}




const STAGES_NORMAL = STAGES;
// Extra mode: plain copies of Normal Stage 1–5.
const STAGES_EXTRA = STAGES_NORMAL.map((s, i) => ({
  ...s,
  stageName: `EX Stage ${i + 1}`,
  bossName: i === 0 ? "Luna" : (i === 1 ? "Syntax" : (i === 2 ? "Spook" : (i === 3 ? "Pesty" : s.bossName))),
  bgFile: `stage${i + 1}_bg.webp`,
  dialogueBgmFile: AUDIO.extraDialogueBgm,
  playBgmFile: `stage${i + 1}_bgm.m4a`,
  bossFile: `stage${i + 1}_boss.webp`,
  bossFile2: `stage${i + 1}_boss2.webp`,
}));
// Keep Extra base pacing on the original copied values.
[
  { spawnEveryMs: 2143, fallSpeedPxPerSec: 46 },
  { spawnEveryMs: 2041, fallSpeedPxPerSec: 49 },
  { spawnEveryMs: 1993, fallSpeedPxPerSec: 51 },
  { spawnEveryMs: 2143, fallSpeedPxPerSec: 55 },
  { spawnEveryMs: 1643, fallSpeedPxPerSec: 65 },
].forEach((cfg, i) => Object.assign(STAGES_EXTRA[i], cfg));

// Extra Stage 1 now has the shooting-star mechanic; other legacy Extra gimmicks remain disabled.
const EXTRA_SPECIAL_MECHANICS_ENABLED = false;
// Clean base: disable all Normal / Extra / Challenge special gameplay mechanics.
// Stage balance still comes from HTML/Google Sheets StageConfig.
const SPECIAL_STAGE_MECHANICS_ENABLED = false;


// Practice mode: Stage 1 baseline at 85% speed, boss invulnerable, infinite continues.
// Drop-in assets you can add later (same folder as index.html):
// - practice_bg.webp
// - practice_boss.gif (optional: practice_boss2.gif)
// - practice_bgm.m4a
const STAGES_PRACTICE = [
  (() => {
    const base = STAGES_NORMAL[0] || {};
    const baseSpawn = Number(base.spawnEveryMs) || 1500;
    const baseFall  = Number(base.fallSpeedPxPerSec) || 40;
    return {
      ...base,
      stageName: "Practice",
      bossName: "W",
      bossDialogue: "Let's practice！",
      midFightDialogue: "",
      // 85% fall speed; spawn rate reduced by an additional 50% (interval x2 vs prior practice):
      spawnEveryMs: Math.round((baseSpawn / 0.85) * 2),
      fallSpeedPxPerSec: baseFall * 0.85,

      // Practice-specific behavior flags:
      bossInvulnerable: true,
      infiniteContinues: true,

      // Customizable drop-in assets:
      bgFile: "",
      bossFile: "",
      bossFile2: "",
      playBgmFile: "",
      playBgmLoop: true,

      words: base.words
    };
  })()
];


// Challenge mode: single-stage survival run.
// Drop-in assets you can add later (same folder as index.html):
// - challenge_bg.webp
// - challenge_boss.webp
// - challenge_bgm.m4a
const STAGES_CHALLENGE = [
  (() => {
    const base = STAGES_NORMAL[0] || {};
    return {
      ...base,
      stageName: "Challenge",
      bossName: "Luna & Stella",
      bossDialogue: "Good Luck!",
      midFightDialogue: "",
      bossMaxHp: 999,
      hitDamage: 1,
      spawnEveryMs: 1600,
      fallSpeedPxPerSec: 65,
      bossInvulnerable: true,
      endStageOnBgmEnd: false,
      bgFile: "",
      bossFile: "",
      playBgmFile: "",
      playBgmLoop: false,
      words: base.words
    };
  })()
];

// v65 All Grades: the classroom server supplies the active shared vocabulary.
// This bundled list cannot be used for online competitive runs; Firebase supplies active words.
let SHARED_RULESET = 'v65-shared-r1-fixed-120s';
let SHARED_WORDS = [
 {prompt:'ねこ',answer:'cat'},{prompt:'いぬ',answer:'dog'},{prompt:'本',answer:'book'},
 {prompt:'魚',answer:'fish'},{prompt:'鳥',answer:'bird'},{prompt:'木',answer:'tree'},
 {prompt:'雨',answer:'rain'},{prompt:'泳ぐ',answer:'swim'},{prompt:'歩く',answer:'walk'},
 {prompt:'歌う',answer:'sing'},{prompt:'見る',answer:'look'},{prompt:'食べる',answer:'eat'},
 {prompt:'りんご',answer:'apple'},{prompt:'いす',answer:'chair'},{prompt:'学校',answer:'school'},
 {prompt:'家族',answer:'family'},{prompt:'友だち',answer:'friend'},{prompt:'動物',answer:'animal'},
 {prompt:'読むこと',answer:'reading'},{prompt:'書くこと',answer:'writing'},{prompt:'はなすこと',answer:'talking'},
 {prompt:'晴れた',answer:'sunny'},{prompt:'食べ物',answer:'food'},{prompt:'料理する',answer:'cooking'},
 {prompt:'美しい',answer:'beautiful'},{prompt:'サッカー',answer:'soccer'},
 {prompt:'バスケットボール',answer:'basketball'},{prompt:'おもしろい',answer:'interesting'},
 {prompt:'土曜日',answer:'Saturday'},{prompt:'日曜日',answer:'Sunday'},
 {prompt:'いちご',answer:'strawberry'},{prompt:'チョコレート',answer:'chocolate'},
 {prompt:'自転車',answer:'bicycle'},{prompt:'ふくしゅう',answer:'review'},
 {prompt:'じしょ',answer:'dictionary'},{prompt:'図書館',answer:'library'},
 {prompt:'すばらしい',answer:'wonderful'},{prompt:'しゅくだい',answer:'homework'},
 {prompt:'運動する',answer:'exercise'},{prompt:'きのう',answer:'yesterday'},
 {prompt:'明日',answer:'tomorrow'},{prompt:'先生',answer:'teacher'},
 {prompt:'しつもん',answer:'question'},{prompt:'まちがい',answer:'mistake'},
 {prompt:'かんたんな',answer:'easy'},{prompt:'むずかしい',answer:'difficult'}
];
const SHARED_STAGE = [{
  ...STAGES_NORMAL[0],stageName:'All Grades',bossName:'Training Dummy',
  bossDialogue:'Ready?',midFightDialogue:'',bossInvulnerable:true,
  bossMaxHp:999,hitDamage:1,spawnEveryMs:1600,fallSpeedPxPerSec:53,
  bgFile:'',bossFile:'',bossFile2:'',playBgmFile:'',playBgmLoop:false,
  words:SHARED_WORDS
}];
// Cycle through short/medium/long *answer* lengths equally regardless of grade.
let sharedSpawnCount=0;
const sharedPools=[[],[],[]];
function resetSharedBuckets(){sharedSpawnCount=0;for(let i=0;i<3;i++)sharedPools[i]=[];}
function sharedWordForSpawn(){
  const buckets=[SHARED_WORDS.filter(w=>w.answer.length<=5),SHARED_WORDS.filter(w=>w.answer.length>=6&&w.answer.length<=8),SHARED_WORDS.filter(w=>w.answer.length>=9)];
  const available=[0,1,2].filter(i=>buckets[i].length);
  if(!available.length)return null;
  const bucketIndex=available[sharedSpawnCount++%available.length];
  let pool=sharedPools[bucketIndex];
  if(!pool.length){pool=buckets[bucketIndex].map((_,i)=>i);for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}sharedPools[bucketIndex]=pool;}
  const item=buckets[bucketIndex][pool.pop()];
  return {prompt:item.prompt,answer:item.answer};
}

// Initial vocab assignment. This is updated again after a cloud profile is loaded.
applyClassYearToVocab(activeClassYear);
rememberStageBaseConfigs();
applyCachedStageConfigToStageLists();


let storySelectedStage = null;
let storyBattleStage = null;
let currentMode = "normal"; // "normal" | "extra" | "practice" | "challenge"
// Dev shortcuts are never active in the student-facing game. A teacher can
// explicitly opt in on the laptop at http://localhost:8765/adventure.html?dev=1.
const DEV_CHEATS_ENABLED = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  && new URLSearchParams(location.search).get('dev') === '1';
let debugMode = DEV_CHEATS_ENABLED && loadDebugMode();
let normalCleared = loadNormalCleared();
let extraCleared = loadExtraCleared();

function setMode(mode){

  currentMode = ["normal","extra","practice","challenge","story","shared"].includes(mode) ? mode : "normal";
  STAGES = currentMode === "story" ? (storyBattleStage ? [storyBattleStage] : [STAGES_NORMAL[0]])
    : currentMode === "extra" ? STAGES_EXTRA
    : currentMode === "practice" ? STAGES_PRACTICE
    : currentMode === "challenge" ? STAGES_CHALLENGE
    : currentMode === "shared" ? SHARED_STAGE : STAGES_NORMAL;
  applyClassYearToVocab(profile && profile.classYear ? profile.classYear : activeClassYear);
  if(currentMode === "story" && STAGES[0]) STAGES[0].words = WORDS;
  if(currentMode !== "story" && currentMode !== "shared") applyCachedStageConfigToStageLists();
  if(currentMode !== "shared") try{window.RPG_BALANCE?.setActive(currentMode,currentMode==='story'?String(storySelectedStage?.id||'1-1'):String(stageIndex+1),currentMode==='story'?String(storySelectedStage?.id||'1').split('-')[0]:null);}catch(_){}
  document.body.classList.toggle('story-squad-layout',currentMode==='story'&&/^[12]-/.test(String(storySelectedStage?.id||'')));
  updateUI();
}


  const BASE_PLAYER_MAX_HP = 10;
  const CHEAT_SKIP_STAGE5 = "657810";
  const DEBUG_MODE_CODE = "debugmode1";

  const CHEAT_MEMORY_WIPE = "memorywipe1";

  const CHEAT_MONEY = "moneymoneymoney";
  const CHEAT_MONEY_AMOUNT = 100000;
  const MAX_CONTINUES = 3;
  const CONTINUE_HP = 3;
  const CONTINUE_DECISION_SEC = 10;

  const wordLane = document.getElementById("wordLane");
  const overflowBadge = document.getElementById("overflowBadge");

  const bgImg = document.getElementById("bgImg");
  const bgFallback = document.getElementById("bgFallback");

  const bossImg = document.getElementById("bossImg");
  const bossFallback = document.getElementById("bossFallback");
  const bossBubble = document.getElementById("bossBubble");
  const stage5Timer = document.getElementById("stage5Timer");
const ex2Timer = document.getElementById("ex2Timer");
  const ex2EndTimer = document.getElementById("ex2EndTimer");
  const ex4Timer = document.getElementById("ex4Timer");
  const ex4ResetScare = document.getElementById("ex4ResetScare");
  const bossMeter = document.getElementById("bossMeter");

  const damageFlash = document.getElementById("damageFlash");

  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayDesc = document.getElementById("overlayDesc");
  const overlayChoices = document.getElementById("overlayChoices");
  const overlayBox = overlay.querySelector(".overlayBox");
const overlayHint = document.getElementById("overlayHint");
  const countdownText = document.getElementById("countdownText");

  // ---- Profile / Achievements DOM ----
  const playerLabel = document.getElementById("playerLabel");
  const playerIconEl = document.getElementById("playerIcon");
  const playerLevelText = document.getElementById("playerLevelText");
  const playerExpText = document.getElementById("playerExpText");

  const profileOverlay = document.getElementById("profileOverlay");
  const profileTitle = document.getElementById("profileTitle");
  const profileDesc = document.getElementById("profileDesc");
  const profileNameInput = document.getElementById("profileNameInput");
  const profileIconGrid = document.getElementById("profileIconGrid");
  const profileAccountStep = document.getElementById("profileAccountStep");
  const profileIconStep = document.getElementById("profileIconStep");
  const profileNextBtn = document.getElementById("profileNextBtn");
  const profileBackBtn = document.getElementById("profileBackBtn");
  const profileSaveBtn = document.getElementById("profileSaveBtn");
  const profileCancelBtn = document.getElementById("profileCancelBtn");
  const profileHint = document.getElementById("profileHint");

  const profileCloudIdInput = null; // classroom version: Username is the cloud key
  const profileCloudPinInput = document.getElementById("profileCloudPinInput");
  const profileCloudNewBtn = null;
  const profileCloudLoadBtn = document.getElementById("profileCloudLoadBtn");
  const profileCloudSaveBtn = document.getElementById("profileCloudSaveBtn");
  const profileCloudStatus = document.getElementById("profileCloudStatus");


  const profileCoinsValue = document.getElementById("profileCoinsValue");
const achOverlay = document.getElementById("achOverlay");
  const achTitle = document.getElementById("achTitle");
  const achDesc = document.getElementById("achDesc");
  const achList = document.getElementById("achList");
  const achCloseBtn = document.getElementById("achCloseBtn");

// ---- Profile / Level / Achievements (local, persistent; wiped by memorywipe1) ----
  const LS_KEY_PROFILE = adventureKey("bossTyping_profile_v1");

  // Put your preset icon PNGs in the same folder as index.html (or change these paths).
  // Example files: icon01.webp, icon02.webp, ...
    const ICON_PRICE = 0;

  // Put your preset icon PNGs in the same folder as index.html (or change these paths).
  // Example files: icon01.webp, icon02.webp, ...
  //  - icon01–03 are unlocked by default
  //  - all other icons cost ICON_PRICE coins (currency uses the same points you earn as score)
  const ICON_MAX = 2; // icon01.webp ... icon14.webp
  const BASE_PROFILE_ICON_PRESETS = Array.from({ length: ICON_MAX }, (_, idx) => {
    const n = idx + 1;
    const short = String(n).padStart(2, "0");
    const id = `icon${short}`;
    const starter = n <= 2; // auto-unlocked
    return { id, file: `${id}.webp`, short, price: starter ? 0 : ICON_PRICE, starter, limitedEvent:false };
  });

  // Limited-event reward icons.
  // Put these .webp files in the same folder as index.html.
  // They stay hidden in the Profile icon list until the student earns them.
  const EVENT_REWARD_ICON_PRESETS = [
    { id:"event_wave_participant", file:"event_wave_participant.webp", short:"EV", price:0, starter:false, limitedEvent:true, hiddenUntilOwned:true, eventId:"wave_event_2026_04", rewardType:"participation" },
    { id:"event_wave_bronze",      file:"event_wave_bronze.webp",      short:"3rd", price:0, starter:false, limitedEvent:true, hiddenUntilOwned:true, eventId:"wave_event_2026_04", rewardType:"third" },
    { id:"event_wave_silver",      file:"event_wave_silver.webp",      short:"2nd", price:0, starter:false, limitedEvent:true, hiddenUntilOwned:true, eventId:"wave_event_2026_04", rewardType:"second" },
    { id:"event_wave_gold",        file:"event_wave_gold.webp",        short:"1st", price:0, starter:false, limitedEvent:true, hiddenUntilOwned:true, eventId:"wave_event_2026_04", rewardType:"first" },
  ];

  const PROFILE_ICON_PRESETS = [
    ...BASE_PROFILE_ICON_PRESETS,
    ...EVENT_REWARD_ICON_PRESETS,
  ];

  // ---- Image loading helper ----
  function setImageSource(imgEl, src, callbacks={}){
    if(!imgEl) return;
    const source = String(src || "");
    imgEl.dataset.sourceSrc = source;

    const onload = typeof callbacks.onload === "function" ? callbacks.onload : null;
    const onerror = typeof callbacks.onerror === "function" ? callbacks.onerror : null;
    const requestToken = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    imgEl.dataset.loadToken = requestToken;

    imgEl.onload = () => {
      if(imgEl.dataset.loadToken !== requestToken) return;
      if(onload) onload();
    };
    imgEl.onerror = () => {
      if(imgEl.dataset.loadToken !== requestToken) return;
      if(onerror) onerror();
    };

    if(!source){
      imgEl.removeAttribute("src");
      if(onerror) onerror();
      return;
    }

    const asset=window.RPG_MEDIA?.classify(source);
    if(asset && !asset.present){
      imgEl.removeAttribute("src");
      if(onerror)onerror();
      return;
    }
    const url=asset?.url||source;
    if(imgEl.getAttribute('src')!==url) imgEl.src=url;
    else if(imgEl.complete){
      if(imgEl.naturalWidth>0 && onload)onload();
      else if(onerror)onerror();
    }
  }

  // You said you'll add achievements later — these are safe placeholders and also useful defaults.
  // You can freely edit/replace this list.
  const ACHIEVEMENT_DEFS = [
    { id:"normal_clear", title:"Normal Clear", desc:"Normal Mode をクリアする", icon:"N", unlockIcons:["icon05"] },
    { id:"extra_clear",  title:"Extra Clear",  desc:"Extra Mode をクリアする",  icon:"E", unlockIcons:["icon06"] },
    { id:"master_clear", title:"Master Clear", desc:"Normal + Extra を両方クリアする", icon:"M", unlockIcons:["icon07","icon08"] },
    { id:"all_achievements", title:"A perfect day", desc:"すべての実績を達成する。", icon:"✔" },
  ];

  // Level curve:
  // - You gain 1 XP per correct word.
  // - To level up from Lv.L -> Lv.(L+1), you need (20 + (L-1)) XP.
  //   Lv1->2:20, Lv2->3:21, Lv3->4:22, ...
  const XP_BASE = 20; // XP needed for Lv1->2

  // ---- Shared Google Sheets Classroom Account Sync ----
  // 1) Paste the shared Apps Script Web App URL here after deployment.
  // 2) Students use Username + Password for this RPG game and the limited event.
  // 3) Teacher controls classYear in the Google Sheet: 1, 2, or 3. It refreshes after reload/startup.
  // 4) This game saves only bossTyping/main-game fields, preserving all limited-event event-ID fields.
  const PROFILE_CLOUD_WEB_APP_URL = "";
  const CLOUD_SYNC_DEBOUNCE_MS = 900;
  let profileCloudSaveTimer = null;
  let profileCloudBusy = false;

  function cleanCloudProfileId(v){
    // Student-facing cloud key: the Username on the player card.
    // Keep it simple: 2–16 characters, no spaces, letters/numbers/_/- allowed.
    // NFKC helps full-width classroom input like ＴＡＲＯ１２ become TARO12.
    let out = String(v || "").trim();
    try{ out = out.normalize("NFKC"); }catch(_){}
    out = out.replace(/\s+/g, "").replace(/[^\p{L}\p{N}_-]/gu, "").toUpperCase().slice(0, 16);
    return out;
  }
  function getCloudUsernameFromProfileOrInput(){
    const typed = String(profileNameInput ? profileNameInput.value : "").trim();
    const saved = profile ? String(profile.name || "").trim() : "";
    return cleanCloudProfileId(typed || saved);
  }
  function cleanCloudPin(v){
    let out = String(v || "");
    try{ out = out.normalize("NFKC"); }catch(_){}
    return out.trim().slice(0, 32);
  }
  function cloudSyncEnabled(){
    const url = String(PROFILE_CLOUD_WEB_APP_URL || "").trim();
    return !!url && !url.includes("PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE");
  }
  function setCloudStatus(msg, isError=false){
    if(!profileCloudStatus) return;
    profileCloudStatus.textContent = msg || "";
    profileCloudStatus.style.color = isError ? "rgba(255,150,150,.95)" : "var(--muted)";
  }
  function renderCloudProfileControls(){
    if(profileCloudPinInput && profile){
      const pin = cleanCloudPin(profile.cloudPin || "");
      if(profileCloudPinInput.value !== pin) profileCloudPinInput.value = pin;
    }
  }
  function syncCloudFieldsIntoProfile(){
    if(!profile) profile = createDefaultProfile();
    profile.cloudId = getCloudUsernameFromProfileOrInput();
    if(profileCloudPinInput && profileCloudPinInput.value) profile.cloudPin = cleanCloudPin(profileCloudPinInput.value);
  }
  function collectCloudSaveData(){
    const p = normalizeProfile(profile || createDefaultProfile());
    return {
      v: 1,
      classYear: cleanClassYear(p.classYear || activeClassYear || DEFAULT_CLASS_YEAR),
      profile: p,
      normalCleared: loadNormalCleared(),
      extraCleared: loadExtraCleared(),
      hiScoreNormal: loadHighScore("normal"),
      hiScoreExtra: loadHighScore("extra"),
      hiScoreChallenge: hiScoreChallenge,
      updatedAt: Date.now()
    };
  }
  function applyCloudSaveData(data, cloudId, cloudPin){
    const incoming = data && data.profile ? data.profile : null;
    if(!incoming) throw new Error("Cloud profile data was empty.");

    profile = normalizeProfile(incoming);
    profile.cloudId = cleanCloudProfileId(cloudId || profile.cloudId || "");
    profile.cloudPin = cleanCloudPin(cloudPin || profile.cloudPin || "");
    profile.classYear = applyClassYearToVocab(data.classYear || profile.classYear || DEFAULT_CLASS_YEAR);

    if(data.normalCleared === true) localStorage.setItem(LS_KEY_NORMAL_CLEARED, "1");
    else if(data.normalCleared === false) localStorage.removeItem(LS_KEY_NORMAL_CLEARED);

    if(data.extraCleared === true) localStorage.setItem(LS_KEY_EXTRA_CLEARED, "1");
    else if(data.extraCleared === false) localStorage.removeItem(LS_KEY_EXTRA_CLEARED);

    if(Number.isFinite(Number(data.hiScoreNormal))) saveHighScore("normal", Number(data.hiScoreNormal));
    if(Number.isFinite(Number(data.hiScoreExtra))) saveHighScore("extra", Number(data.hiScoreExtra));
    if(Number.isFinite(Number(data.hiScoreChallenge))) hiScoreChallenge = Math.max(hiScoreChallenge || 0, Number(data.hiScoreChallenge));

    saveProfile(profile);
    normalCleared = loadNormalCleared();
    extraCleared = loadExtraCleared();
    hiScoreNormal = loadHighScore("normal");
    hiScoreExtra = loadHighScore("extra");
    if(Number.isFinite(Number(data.hiScoreChallenge))) hiScoreChallenge = Math.max(hiScoreChallenge || 0, Number(data.hiScoreChallenge));

    renderProfileHeader();
    renderIconGrid();
    renderCloudProfileControls();
    updateUI();
  }
  async function callCloudProfileApi(payload){
    if(!cloudSyncEnabled()){
      throw new Error("Online profiles will be enabled with Firebase later.");
    }

    const url = String(PROFILE_CLOUD_WEB_APP_URL).trim();

    if(payload && payload.action === "load"){
      const qs = new URLSearchParams();
      qs.set("action", "load");
      qs.set("profileId", payload.profileId || "");
      qs.set("pin", payload.pin || "");
      const res = await fetch(`${url}?${qs.toString()}`, { method:"GET", cache:"no-store" });
      const text = await res.text();
      let json = null;
      try{ json = JSON.parse(text); }catch(_){ throw new Error("Cloud returned a non-JSON response. Check your Apps Script deployment."); }
      if(!json.ok) throw new Error(json.error || "Cloud load failed.");
      return json;
    }

    const res = await fetch(url, {
      method:"POST",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify(payload || {}),
      cache:"no-store"
    });
    const text = await res.text();
    let json = null;
    try{ json = JSON.parse(text); }catch(_){ throw new Error("Cloud returned a non-JSON response. Check your Apps Script deployment."); }
    if(!json.ok) throw new Error(json.error || "Cloud save failed.");
    return json;
  }
  function validateCloudIdAndPin(id, pin){
    if(!id) return "Username is missing.";
    if(id.length < 2 || id.length > 16) return "Username must be 2–16 characters.";
    if(!/^[\p{L}\p{N}_-]{2,16}$/u.test(id)) return "Username can use letters, numbers, _ or -.";
    if(pin.length < 4 || pin.length > 32) return "Password must be 4–32 characters.";
    return "";
  }
  function syncProfileFromModalInputsForCloud(){
    if(!profile) profile = createDefaultProfile();

    const name = String(profileNameInput ? profileNameInput.value : profile.name || "").trim();
    if(name.length <= 0){
      setCloudStatus("Username is required before saving to cloud.", true);
      return false;
    }
    if(name.length > 16){
      setCloudStatus("Username must be 16 characters or fewer.", true);
      return false;
    }

    const iconId = String(selectedIconId || profile.iconId || "icon01");
    const owned = new Set(profile.unlockedIcons || []);
    const iconDef = PROFILE_ICON_PRESETS.find(x=>x.id===iconId);
    const isOwned = owned.has(iconId) || (iconDef && iconDef.starter);
    if(!isOwned){
      setCloudStatus("Buy/select that icon before saving to cloud.", true);
      return false;
    }

    profile.name = name;
    profile.iconId = iconId;
    profile.classYear = applyClassYearToVocab(profile.classYear || activeClassYear || DEFAULT_CLASS_YEAR);
    ensureIconUnlocked(iconId);
    syncCloudFieldsIntoProfile();
    profile.updatedAt = Date.now();
    saveProfile(profile);
    renderProfileHeader();
    return true;
  }
  function requestCloudCheckpointSave(reason="checkpoint"){
    if(runLocalOnly||window.RPG_V66_DISCONNECTED||!navigator.onLine)return;
    // Cloud autosave should only happen at important checkpoints.
    // Do NOT call this from normal saveProfile(), correct-word XP, or regular coin gains.
    try{
      if(!profile) return;
      const id = cleanCloudProfileId(profile.cloudId || "");
      const pin = cleanCloudPin(profile.cloudPin || "");
      if(!cloudSyncEnabled() || !id || !pin) return;

      if(profileCloudSaveTimer) clearTimeout(profileCloudSaveTimer);
      profileCloudSaveTimer = setTimeout(() => {
        profileCloudSaveTimer = null;
        if(!unverifiedRun())saveProfileToCloud(false, reason);
      }, CLOUD_SYNC_DEBOUNCE_MS);
    }catch(_){/* ignore */}
  }
  function scheduleCloudProfileSave(reason="checkpoint"){
    // Backward-safe alias, but keep calls limited to checkpoint moments only.
    requestCloudCheckpointSave(reason);
  }
  async function saveProfileToCloud(manual=false, reason="manual"){
    if(profileCloudBusy) return;
    if(manual && !syncProfileFromModalInputsForCloud()) return;

    syncCloudFieldsIntoProfile();
    const id = getCloudUsernameFromProfileOrInput();
    const pin = cleanCloudPin((profileCloudPinInput && profileCloudPinInput.value) || (profile && profile.cloudPin) || "");
    const validation = validateCloudIdAndPin(id, pin);
    if(validation){
      if(manual) setCloudStatus(validation, true);
      return;
    }

    profile.cloudId = id;
    profile.cloudPin = pin;

    profileCloudBusy = true;
    if(manual) setCloudStatus("Saving cloud profile…");
    try{
      const data = collectCloudSaveData();
      await callCloudProfileApi({
        action: "save",
        game: "bossTyping",
        profileId: id,
        pin,
        data,
        reason
      });
      if(manual) setCloudStatus(`Profile saved for ${profile.name || id}. Class: ${getClassYearLabel(profile.classYear)}.`);
      renderCloudProfileControls();
    }catch(err){
      if(manual) setCloudStatus(err && err.message ? err.message : "Cloud save failed.", true);
      else console.warn("Cloud profile autosave failed:", err);
    }finally{
      profileCloudBusy = false;
    }
  }
  async function loadProfileFromCloud(){
    if(profileCloudBusy) return;
    syncCloudFieldsIntoProfile();
    const id = getCloudUsernameFromProfileOrInput();
    const pin = cleanCloudPin((profileCloudPinInput && profileCloudPinInput.value) || (profile && profile.cloudPin) || "");
    const validation = validateCloudIdAndPin(id, pin);
    if(validation){
      setCloudStatus(validation, true);
      return;
    }

    profileCloudBusy = true;
    setCloudStatus("Loading cloud profile…");
    try{
      const json = await callCloudProfileApi({ action:"load", profileId:id, pin });
      applyCloudSaveData(json.data, id, pin);
      const loadedSheetVocab = await refreshVocabFromCloud(profile.classYear, { quiet:false });
      await refreshStageConfigFromCloud({ quiet:true });
      setCloudStatus(`Profile loaded. ${getClassYearLabel(profile.classYear)} vocab active (${WORDS.length} words${loadedSheetVocab ? " from Google Sheets" : ""}).`);
      try{ closeProfileModal(); }catch(_){}
      try{ showModeSelectScreen(); }catch(_){/* ignore */}
    }catch(err){
      setCloudStatus(err && err.message ? err.message : "Cloud load failed.", true);
    }finally{
      profileCloudBusy = false;
    }
  }

  async function refreshSavedCloudProfileFromSheet(options={}){
    // Used at startup/reload so teacher changes in Google Sheets, especially classYear,
    // can update this browser without the student manually pressing Load Profile.
    const quiet = !!(options && options.quiet);
    try{
      if(!profile || !cloudSyncEnabled()) return false;
      const id = cleanCloudProfileId(profile.cloudId || profile.name || "");
      const pin = cleanCloudPin(profile.cloudPin || "");
      if(!id || !pin || validateCloudIdAndPin(id, pin)) return false;

      const json = await callCloudProfileApi({ action:"load", profileId:id, pin });
      applyCloudSaveData(json.data, id, pin);
      const loadedSheetVocab = await refreshVocabFromCloud(profile.classYear, { quiet:true });
      await refreshStageConfigFromCloud({ quiet:true });
      if(!quiet && typeof setCloudStatus === "function"){
        setCloudStatus(`Cloud profile refreshed. ${getClassYearLabel(profile.classYear)} vocab active (${WORDS.length} words${loadedSheetVocab ? " from Google Sheets" : ""}).`);
      }
      return true;
    }catch(err){
      console.warn("Saved cloud profile refresh failed:", err);
      if(!quiet && typeof setCloudStatus === "function"){
        setCloudStatus(err && err.message ? err.message : "Could not refresh cloud profile.", true);
      }
      return false;
    }
  }

  // Total XP needed to *reach* a given level.
  // xpNeededToReachLevel(1)=0, xpNeededToReachLevel(2)=20, xpNeededToReachLevel(3)=41, ...
  const xpNeededToReachLevel = (level) => {
    const L = Math.max(1, Math.trunc(Number(level) || 1));
    if(L <= 1) return 0;
    const n = L - 1; // number of completed level-ups
    // Sum_{i=0..n-1} (XP_BASE + i)  = n*(2*XP_BASE + (n-1))/2
    return Math.trunc(n * (2*XP_BASE + (n - 1)) / 2);
  };

  // Inverse: find level from total XP.
  const levelFromXp = (xp) => {
    const T = Math.max(0, Math.trunc(Number(xp) || 0));
    // Solve T >= n*(2*XP_BASE + (n-1))/2  for n (where n=L-1).
    const b = 2*XP_BASE - 1;
    const n = Math.floor((-b + Math.sqrt(b*b + 8*T)) / 2);
    return Math.max(1, n + 1);
  };

  // XP needed to go from this level to the next.
  const xpToNextLevel = (level) => XP_BASE + (Math.max(1, Math.trunc(Number(level) || 1)) - 1);


  function createDefaultProfile(){
    return {
      v: 1,
      name: "",
      iconId: "icon01",
      xp: 0,
      achievements: [],
      coins: 0,
      unlockedIcons: ["icon01","icon02"],
      classYear: DEFAULT_CLASS_YEAR,
      
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
  function normalizeProfile(p){
    const d = createDefaultProfile();
    const o = (p && typeof p === "object") ? p : {};
    const out = {
      v: 1,
      name: String(o.name ?? d.name).slice(0,16),
      iconId: String(o.iconId ?? d.iconId),
      xp: Math.max(0, Math.trunc(Number(o.xp ?? d.xp) || 0)),
      coins: Math.max(0, Math.trunc(Number(o.coins ?? d.coins) || 0)),
      achievements: Array.isArray(o.achievements) ? o.achievements.filter(x => typeof x === "string") : [],
      unlockedIcons: Array.isArray(o.unlockedIcons) ? o.unlockedIcons.filter(x => typeof x === "string") : [...d.unlockedIcons],
      classYear: cleanClassYear(o.classYear ?? d.classYear),
      cloudId: cleanCloudProfileId(String(o.cloudId ?? d.cloudId)),
      cloudPin: cleanCloudPin(String(o.cloudPin ?? d.cloudPin)),
      createdAt: Math.trunc(Number(o.createdAt ?? d.createdAt) || Date.now()),
      updatedAt: Math.trunc(Number(o.updatedAt ?? d.updatedAt) || Date.now()),
    };
    for(const _id of ["icon01","icon02"]){ if(!out.unlockedIcons.includes(_id)) out.unlockedIcons.push(_id); }
    if(!PROFILE_ICON_PRESETS.some(x=>x.id===out.iconId)) out.iconId = "icon01";
    if(!(out.unlockedIcons || []).includes(out.iconId)) out.iconId = "icon01";
    return out;
  }
  function loadProfile(){
    try{
      const raw = localStorage.getItem(LS_KEY_PROFILE);
      if(!raw) return null;
      return normalizeProfile(JSON.parse(raw));
    }catch(_){
      return null;
    }
  }
  let soloSyncTimer = null;
  function queueAdventureSync(){
    if(runLocalOnly||window.RPG_V66_DISCONNECTED||!navigator.onLine)return;
    const card = ADVENTURE_CONTEXT.card_code;
    if(!card || !ADVENTURE_CONTEXT.online) return;
    clearTimeout(soloSyncTimer);
    soloSyncTimer = setTimeout(async()=>{
      if(!profile||unverifiedRun())return;
      const payload = {
        card_code:card,action:"save",xp:Math.max(0,Math.floor(Number(profile.xp)||0)),
        achievements:profile.achievements||[],
        best_normal:loadHighScore("normal"),best_extra:loadHighScore("extra"),
        normal_clear:loadNormalCleared(),extra_clear:loadExtraCleared()
      };
      try{const res=await fetch("/api/adventure/progress",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
        if(res.ok&&!unverifiedRun())void window.RPG_LOCAL_PRACTICE?.confirmedProgress?.(payload);
      }catch(_){}
    },12000);
  }
  // v66: never use unload beacon to submit cloud progress; authenticated callable only.
  function saveProfile(p){
    try{
      localStorage.setItem(LS_KEY_PROFILE, JSON.stringify(p));
      queueAdventureSync();
      queueRankIconSync();
      return true;
    }catch(_){
      return false;
    }
  }

  // A pre-upgrade browser profile may already have a selected icon.
  // Keep that selection on the first server migration; later the server
  // is the authority when using the Adventure Card on a different device.
  const hadStoredRankIcon = !!loadProfile();
  let rankIconInitialized = false;
  let rankIconServerValue = null;
  let rankIconSyncTimer = null;
  let rankIconFetchInProgress = false;
  function knownRankIcon(id){
    return PROFILE_ICON_PRESETS.some(icon=>icon.id===id) ? id : 'icon01';
  }
  async function sendSelectedRankIcon(id){
    if(!ADVENTURE_CONTEXT.card_code || !ADVENTURE_CONTEXT.online)return false;
    const iconId=knownRankIcon(id);
    const r=await fetch('/api/rankings/icon',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({card_code:ADVENTURE_CONTEXT.card_code,action:'set',icon_id:iconId})});
    if(!r.ok)throw Error('Profile icon sync failed.');
    const result=await r.json();
    if(!result.ok)throw Error('Profile icon sync failed.');
    rankIconServerValue=result.icon_id;
    return true;
  }
  function queueRankIconSync(){
    if(!rankIconInitialized || !profile || !ADVENTURE_CONTEXT.online || !ADVENTURE_CONTEXT.card_code)return;
    const desired=knownRankIcon(profile.iconId);
    if(desired===rankIconServerValue)return;
    clearTimeout(rankIconSyncTimer);
    rankIconSyncTimer=setTimeout(async()=>{
      rankIconSyncTimer=null;
      if(!rankIconInitialized || !profile)return;
      const latest=knownRankIcon(profile.iconId);
      if(latest===rankIconServerValue)return;
      try{await sendSelectedRankIcon(latest);}catch(_){/* retry on next profile save or ranking open */}
    },250);
  }
  async function initializeRankIcon(){
    if(rankIconFetchInProgress || rankIconInitialized || !ADVENTURE_CONTEXT.card_code || !ADVENTURE_CONTEXT.online)return;
    rankIconFetchInProgress=true;
    try{
      const startedWith=knownRankIcon(profile?.iconId);
      const r=await fetch('/api/rankings/icon',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({card_code:ADVENTURE_CONTEXT.card_code,action:'get'})});
      if(!r.ok)throw Error('Profile icon unavailable.');
      const result=await r.json();
      if(!result.ok)throw Error('Profile icon unavailable.');
      rankIconServerValue=knownRankIcon(result.icon_id);
      // Do not override an icon the student edited while the request was in flight.
      if(profile && knownRankIcon(profile.iconId)!==startedWith){
        rankIconInitialized=true;
        queueRankIconSync();
      }else if(!result.updated_at && hadStoredRankIcon && startedWith!=='icon01'){
        rankIconInitialized=true;
        queueRankIconSync();
      }else{
        rankIconInitialized=true;
        if(profile && profile.iconId!==rankIconServerValue){
          profile.iconId=rankIconServerValue;
          if(!profile.unlockedIcons.includes(rankIconServerValue))profile.unlockedIcons.push(rankIconServerValue);
          saveProfile(profile);renderProfileHeader();renderIntroProfileCard();
        }
      }
    }catch(_){/* server temporarily unavailable: keep the student's local icon */}
    finally{rankIconFetchInProgress=false;}
  }
  let profile = loadProfile();
  // Use the Adventure Card's name. The ID is resolved by the bridge before loading the engine.
  if(ADVENTURE_CONTEXT.name){
    if(!profile) profile = createDefaultProfile();
    profile.name = String(ADVENTURE_CONTEXT.name).slice(0,16);
    profile.cloudId = "";
    profile.cloudPin = "";
    saveProfile(profile);
  }
  applyClassYearToVocab(profile && profile.classYear ? profile.classYear : DEFAULT_CLASS_YEAR);
  // Cached vocab is available instantly; the classroom server supplies the
  // teacher-assigned class and authoritative words before the next ranked run.
  (async () => {
    const cloudProfileUpdated = await refreshSavedCloudProfileFromSheet({ quiet:true });
    if(!cloudProfileUpdated) await refreshVocabFromCloud(activeClassYear, { quiet:true });
    await refreshStageConfigFromCloud({ quiet:true });
  })();

  const profileHas = (id) => !!(profile && Array.isArray(profile.achievements) && profile.achievements.includes(id));
  const getAchDef = (id) => ACHIEVEMENT_DEFS.find(a => a.id === id) || null;

  function fmtCoins(n){
    const v = Math.max(0, Math.trunc(Number(n) || 0));
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function getCoins(){
    return Math.max(0, Math.trunc(Number(profile && profile.coins) || 0));
  }
  function setCoins(v){
    if(!profile) return;
    profile.coins = Math.max(0, Math.trunc(Number(v) || 0));
    profile.updatedAt = Date.now();
    saveProfile(profile);
  }
  function addCoins(v){
    if(unverifiedRun())return;
    if(!profile) return;
    const add = Math.max(0, Math.trunc(Number(v) || 0));
    if(add <= 0) return;
    profile.coins = getCoins() + add;
    profile.updatedAt = Date.now();
    saveProfile(profile);
  }
  function spendCoins(cost){
    if(!profile) return false;
    const c = Math.max(0, Math.trunc(Number(cost) || 0));
    if(getCoins() < c) return false;
    profile.coins = getCoins() - c;
    profile.updatedAt = Date.now();
    saveProfile(profile);
    return true;
  }

  function ensureIconUnlocked(iconId){
    if(!profile) profile = createDefaultProfile();
    if(!profile.unlockedIcons.includes(iconId)){
      profile.unlockedIcons.push(iconId);
      profile.updatedAt = Date.now();
      saveProfile(profile);
      return true;
    }
    return false;
  }

  function unlockAchievement(id, silent=false){
    if(unverifiedRun())return false;
    if(!id) return false;
    if(!profile) profile = createDefaultProfile();
    if(profileHas(id)) return false;

    profile.achievements.push(id);
    const def = getAchDef(id);
    if(def && Array.isArray(def.unlockIcons)){
      for(const iconId of def.unlockIcons){
}
    }
    profile.updatedAt = Date.now();
    saveProfile(profile);
    try{ requestCloudCheckpointSave("achievement-unlocked"); }catch(_){/* ignore */}

    try{
      if(!silent){
        const label = def ? def.title : id;
        pushMsg(`🏅 Achievement unlocked: ${label}`, true);
      }
    }catch(_){/* ignore */}
    try{ renderProfileHeader(); }catch(_){/* ignore */}
    // Meta-achievement: unlock when all other achievements are complete
    if(id !== "all_achievements"){
      try{ checkAllAchievementsComplete(); }catch(_){/* ignore */}
    }
    return true;
  }

  function checkAllAchievementsComplete(){
    if(!profileReady()) return;
    const TARGET = "all_achievements";
    const have = new Set((profile && profile.achievements) ? profile.achievements : []);
    // Require every achievement except the meta one.
    const required = ACHIEVEMENT_DEFS
      .map(d => d && d.id)
      .filter(id => id && id !== TARGET);

    const complete = required.every(id => have.has(id));
    if(complete){
      // silent=true prevents an extra popup if you prefer; set to false if you want a toast.
      unlockAchievement(TARGET, false);
    }
  }

  // --- Challenge achievement checks ---
  function isChallengeMode(){
    return currentMode === "challenge";
  }

  function checkChallengeAchievementsAfterStageClear(){
    return;
  }


  function syncCoreAchievementsFromFlags(){
    // If the player already had clears saved from older builds, auto-grant these.
    try{
      const n = loadNormalCleared();
      const e = loadExtraCleared();
      if(n) unlockAchievement("normal_clear", true);
      if(e) unlockAchievement("extra_clear", true);
      if(n && e) unlockAchievement("master_clear", true);
    }catch(_){/* ignore */}

    try{ checkAllAchievementsComplete(); }catch(_){/* ignore */}
    }

  function addXp(amount){
    if(unverifiedRun())return;
    if(!profile) return;
    const a = Math.max(0, Math.trunc(Number(amount) || 0));
    if(a <= 0) return;

    const beforeLevel = levelFromXp(profile.xp);
    profile.xp = Math.max(0, profile.xp + a);
    const afterLevel = levelFromXp(profile.xp);

    profile.updatedAt = Date.now();
    saveProfile(profile);

    if(afterLevel > beforeLevel){
      try{ pushMsg(`⬆️ LEVEL UP! Lv.${afterLevel}`, true); }catch(_){/* ignore */}
    }
    try{ renderProfileHeader(); }catch(_){/* ignore */}
  }

  function profileReady(){
    return !!(profile && String(profile.name || "").trim().length > 0 && profile.iconId);
  }


  // ---- v64 competitive runs (isolated from old v63 browser highs) ----
  let rankedRun = null;
  function stableStringify(obj){
    if(Array.isArray(obj))return '['+obj.map(stableStringify).join(',')+']';
    if(obj && typeof obj==='object')return '{'+Object.keys(obj).sort().map(k=>JSON.stringify(k)+':'+stableStringify(obj[k])).join(',')+'}';
    return JSON.stringify(obj);
  }
  function rulesetHash(s){
    // Two rolling hashes for client-side diagnostics; the server decides the official ruleset.
    let a=2166136261>>>0,b=0x9e3779b9;
    for(let i=0;i<s.length;i++){
      const c=s.charCodeAt(i);
      a=Math.imul(a^c,16777619)>>>0;
      b=(Math.imul(b^c,2246822519)+0x9e3779b9)>>>0;
    }
    return a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0');
  }
  function stageRankedSnapshot(){
    if(currentMode==='shared') return 'shared-fixed';
    const st=STAGES[stageIndex]||{};
    const wordSet=(st.words||[]).map(w=>[String(w.prompt||''),String(w.answer||'')]).sort((a,b)=>a[1].localeCompare(b[1]));
    return stableStringify({version:'v64',mode:currentMode,stage:stageIndex,
      words:wordSet,bossHp:window.RPG_BALANCE?.get('bossMaxHp',st.bossMaxHp)??st.bossMaxHp,
      hit:window.RPG_BALANCE?.get('hitDamage',st.hitDamage)??st.hitDamage,
      spawn:window.RPG_BALANCE?.get('spawnEveryMs',st.spawnEveryMs)??st.spawnEveryMs,
      fall:window.RPG_BALANCE?.get('fallSpeedPxPerSec',st.fallSpeedPxPerSec)??st.fallSpeedPxPerSec,
      mechanicValues:window.RPG_BALANCE?.configSnapshot?.().mechanics||{},
      mechanics:[SPECIAL_STAGE_MECHANICS_ENABLED,EXTRA_SPECIAL_MECHANICS_ENABLED],
      fixedStage5Ramp:true});
  }
  function startRankedRun(){
    // Operator passives are allowed in ranked runs. Offline/locally cached runs remain unranked.
    if(runLocalOnly){rankedRun=null;window.RPG_V66_COMPETITIVE_ACTIVE=false;return;}
    rankedRun=['normal','extra','challenge','shared'].includes(currentMode)
      ? {mode:currentMode,grade:currentMode==='shared'?'all':(assignedRankGrade||cleanClassYear(profile?.classYear)),
         vocabPool:currentMode==='shared'?'all':assignedVocabPool,
         vocabRevision:currentMode==='shared'?Number(SHARED_RULESET.match(/-r(\d+)-/)?.[1]||0):assignedVocabRevision,
         sharedRuleset:SHARED_RULESET,
         stages:[],invalid:!!DEV_CHEATS_ENABLED||!vocabLastServerSuccess,
         submitted:false,lastAuditSec:-1,run_token:null,startPromise:null} : null;
    window.RPG_V66_COMPETITIVE_ACTIVE=!!rankedRun;
    if(rankedRun){const target=rankedRun;target.startPromise=fetch('/api/rankings/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({card_code:ADVENTURE_CONTEXT.card_code,mode:target.mode})}).then(async r=>{const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Run not registered.');target.run_token=d.token;if(d.revision!==target.vocabRevision||d.grade!==target.grade || (['normal','extra'].includes(currentMode)&&Number(d.configVersion)!==Number(window.RPG_V66_PREPARED_REVISION))){target.invalid=true;}return d;}).catch(e=>{target.invalid=true;console.error('Online ranked start failed:',e);});}
  }
  function recordRankedStage(){
    if(!rankedRun||rankedRun.mode!==currentMode)return;
    rankedRun.stages[stageIndex]=stageRankedSnapshot();
    rankedRun.lastAuditSec=-1;
  }
  function auditRankedStage(){
    if(!rankedRun || rankedRun.invalid || !rankedRun.stages[stageIndex])return;
    if(stageRankedSnapshot()!==rankedRun.stages[stageIndex])rankedRun.invalid=true;
    if(currentMode!=='shared' && (assignedRankGrade!==rankedRun.grade || assignedVocabRevision!==rankedRun.vocabRevision))rankedRun.invalid=true;
  }
  function downgradeOnConnectionLoss(){
    if(rankedRun)rankedRun.invalid=true;
    // If Wi-Fi drops during play, the run can finish as local practice only.
    if(typeof gameState!=='undefined' && ['playing','paused','countdown'].includes(gameState) && !runLocalOnly){
      setLocalOnlyRun(true);
      try{pushMsg('CONNECTION LOST · RUN UNRANKED · NO REWARDS',true);}catch(_){}
    }
  }
  window.addEventListener('rpg-v66-offline',downgradeOnConnectionLoss);
  window.addEventListener('offline',downgradeOnConnectionLoss);
  async function submitRankedCompletion(){
    const run=rankedRun;
    if(!run||run.submitted||run.mode!==currentMode)return;
    run.submitted=true;
    await run.startPromise;
    window.RPG_V66_COMPETITIVE_ACTIVE=false;window.dispatchEvent(new Event('rpg-v66-unlock-settings'));
    if(runLocalOnly||run.invalid || window.RPG_V66_DISCONNECTED || !run.run_token || !ADVENTURE_CONTEXT.card_code || !ADVENTURE_CONTEXT.online)return;
    if(run.stages.filter(Boolean).length!==(['shared','challenge'].includes(run.mode)?1:5))return;
    const score=getActiveScore();
    if(!Number.isInteger(score)||score<=0)return;
    const ruleset=run.mode==='shared'?run.sharedRuleset
      : `v65-r${run.vocabRevision}-${rulesetHash(stableStringify({mode:run.mode,grade:run.grade,stages:run.stages}))}`;
    try{
      const r=await fetch('/api/rankings/submit',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({card_code:ADVENTURE_CONTEXT.card_code,mode:run.mode,
          grade:run.grade,vocab_pool:run.vocabPool,vocab_revision:run.vocabRevision,run_token:run.run_token,ruleset,score,completed:true})});
      const data=await r.json();if(!r.ok||!data.ok)throw Error(data.error||'Ranking save failed.');
      if(gameState==='victory')pushMsg('RANK SAVED');
      return {ok:true,token:run.run_token,mode:run.mode};
    }catch(e){if(gameState==='victory')pushMsg('RANK NOT SAVED — '+String(e.message||'').slice(0,70),true);}
  }

  // ---- Grade-specific and shared challenge rankings ----
  let rankingRequest=0;let stopLiveRankings=null;
  let rankingMode='normal';
  // Only the three standard grades and shared challenge are shown as student filters.
  // The B-class vocabulary and separate rank records remain intact on the server.
  const PUBLIC_RANKING_GRADES=['1','2','3','all'];
  const visibleRankingGrade=grade=>PUBLIC_RANKING_GRADES.includes(grade)?grade:/^[123]b$/.test(grade)?'all':'1';
  let rankingGrade=visibleRankingGrade(assignedRankGrade||cleanClassYear(profile?.classYear));
  let lastStandardRankingGrade=/^[123]/.test(assignedRankGrade||'')?String(assignedRankGrade).charAt(0):'1';
  const rankingScore=n=>Math.max(0,Math.trunc(Number(n)||0)).toLocaleString();
  const rankingRank=n=>Number.isInteger(n)&&n>0?`#${n}`:'—';
  const rankingIconSrc=id=>{
    const icon=PROFILE_ICON_PRESETS.find(item=>item.id===id);
    return icon?icon.file:'icon01.webp';
  };
  function rankingIdentity(row,own=false){
    return `<span class="ranking-identity"><img class="ranking-avatar" data-rank-icon src="${escapeHtml(rankingIconSrc(row.icon_id))}" alt="" loading="lazy"><span class="ranking-name">${escapeHtml(row.name||'Player')}${own?'<span class="ranking-you">YOU</span>':''}</span></span>`;
  }
  function rankingsView(mode,grade,data=null,message=''){
    rankingMode=mode==='extra'?'extra':mode==='challenge'?'challenge':mode==='shared'?'shared':'normal';
    rankingGrade=visibleRankingGrade(grade);
    if(rankingGrade!=='all')lastStandardRankingGrade=rankingGrade;
    gameState='rankings';setInputsEnabled(false);showOverlay(true);
    overlayBox?.querySelector('.operator-showcase')?.remove();
    overlay.querySelector('.operator-selection-backdrop')?.remove();
    overlay.classList.remove('defeat-active');overlay.classList.add('mode-select-active');
    if(overlayBox){overlayBox.classList.remove('defeat-card','hearts-phase','modeSelectMenu','debugSmall');overlayBox.classList.add('rankings-card');}
    overlay.style.cursor='default';overlayTitle.textContent='RANKINGS';
    overlayDesc.textContent='';overlayHint.textContent='';countdownText.textContent='';overlayChoices.classList.add('show');
    const mine=data?.current||null,entries=Array.isArray(data?.entries)?data.entries:[];
    const top=entries.map(row=>{
      const own=mine&&row.public_id===mine.public_id;
      return `<div class="ranking-row${own?' mine':''}"><strong class="ranking-place">${escapeHtml(rankingRank(row.rank))}</strong>${rankingIdentity(row,own)}<strong class="ranking-points">${escapeHtml(rankingScore(row.score))}</strong></div>`;
    }).join('');
    const ownShown=mine&&entries.some(r=>r.public_id===mine.public_id);
    const own=mine&&!ownShown?`<div class="ranking-own"><strong>${escapeHtml(rankingRank(mine.rank))}</strong>${rankingIdentity(mine,true)}<strong>${escapeHtml(rankingScore(mine.score))}</strong></div>`:'';
    const gradeWarning=data?.assigned_grade===null&&rankingGrade!=='all'?'TEACHER: ASSIGN YOUR GRADE IN RANKING ADMIN':'';
    const notice=message||gradeWarning?`<div class="ranking-notice" role="status">${escapeHtml(message||gradeWarning)}</div>`:'';
    const empty=!entries.length&&!message?'<div class="ranking-empty">NO COMPLETED RUNS YET</div>':'';
    const description=rankingGrade==='all'?'ALL GRADES · IDENTICAL VOCAB & SETTINGS':(rankingGrade.endsWith('b')?'CLASS '+rankingGrade.toUpperCase():'GRADE '+rankingGrade)+' · COMPLETED RUNS ONLY';
    overlayChoices.innerHTML=`<div class="ranking-tabs">
       <button class="ranking-tab${rankingMode==='normal'?' active':''}" aria-pressed="${rankingMode==='normal'}" data-mode="normal" type="button">NORMAL</button>
       <button class="ranking-tab${rankingMode==='extra'?' active':''}" aria-pressed="${rankingMode==='extra'}" data-mode="extra" type="button">EXTRA</button>
       <button class="ranking-tab${rankingMode==='challenge'?' active':''}" aria-pressed="${rankingMode==='challenge'}" data-mode="challenge" type="button">CHALLENGE</button>
      </div>
      <div class="ranking-grades">${PUBLIC_RANKING_GRADES.map(y=>`<button type="button" class="ranking-grade${rankingGrade===y?' active':''}" aria-pressed="${rankingGrade===y}" data-grade="${y}">${y==='all'?'ALL GRADES':y+'年生'}</button>`).join('')}</div>
      <div class="ranking-meta">${description}${data?.ruleset?' · RULESET '+escapeHtml(data.ruleset.slice(-8)):''}</div>
      <div class="ranking-list">${top}${empty}</div>${own}${notice}
      ${rankingGrade==='all'?'<button class="ranking-action primary" type="button" data-play-shared>PLAY SHARED CHALLENGE</button>':''}
      <div class="ranking-actions"><button class="ranking-action" type="button" data-refresh>REFRESH</button><button class="ranking-action primary" type="button" data-back>← MODE SELECT</button></div>`;
    overlayChoices.querySelectorAll('[data-rank-icon]').forEach(img=>{
      img.addEventListener('error',()=>{img.src='icon01.webp';},{once:true});
    });
    overlayChoices.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();void openRankings(btn.dataset.mode,rankingGrade==='all'?lastStandardRankingGrade:rankingGrade);}));
    overlayChoices.querySelectorAll('[data-grade]').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();void openRankings(btn.dataset.grade==='all'?'shared':rankingMode==='shared'?'normal':rankingMode,btn.dataset.grade);}));
    overlayChoices.querySelector('[data-play-shared]')?.addEventListener('click',e=>{e.stopPropagation();rankingRequest++;setMode('shared');showOverlay(false);void startGame();});
    overlayChoices.querySelector('[data-refresh]')?.addEventListener('click',e=>{e.stopPropagation();void openRankings(rankingMode,rankingGrade);});
    overlayChoices.querySelector('[data-back]')?.addEventListener('click',e=>{e.stopPropagation();rankingRequest++;if(stopLiveRankings){stopLiveRankings();stopLiveRankings=null;}showModeSelectScreen();});
  }
  async function openRankings(mode='normal',grade=assignedRankGrade||cleanClassYear(profile?.classYear)){
    grade=visibleRankingGrade(grade);
    mode=grade==='all'?'shared':mode==='extra'?'extra':mode==='challenge'?'challenge':'normal';
    if(stopLiveRankings){stopLiveRankings();stopLiveRankings=null;}
    const req=++rankingRequest;rankingsView(mode,grade,null,'LOADING…');
    if(!rankIconInitialized)void initializeRankIcon();
    else queueRankIconSync();
    if(!ADVENTURE_CONTEXT.card_code){rankingsView(mode,grade,null,'ADVENTURE CARD REQUIRED');return;}
    try{
      const r=await fetch('/api/rankings',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({card_code:ADVENTURE_CONTEXT.card_code,mode,grade,limit:20})});
      const data=await r.json();if(!r.ok||!data.ok)throw Error(data.error||'Rankings unavailable.');
      if(req===rankingRequest){
        rankingsView(mode,grade,data,'');
        if(window.RPG_V66?.watchRankings){stopLiveRankings=window.RPG_V66.watchRankings(mode,grade,doc=>{
          if(req!==rankingRequest || gameState!=='rankings' || !doc || doc.ruleset!==data.expected_ruleset)return;
          const entries=(doc.entries||[]).map((item,i,all)=>({...item,rank:all.findIndex(e=>e.score===item.score)+1}));
          const mine=entries.find(e=>e.public_id===data.current?.public_id)||data.current;
          rankingsView(mode,grade,{...data,entries,current:mine,total:entries.length,ruleset:doc.ruleset||null},'');
        });}
      }
    }catch(err){
      if(req===rankingRequest){
        const errorText=String(err?.message||err||'').slice(0,170);
        const offline=!ADVENTURE_CONTEXT.online||window.RPG_V66_DISCONNECTED||!navigator.onLine;
        const reason=offline?'OFFLINE PRACTICE · RECONNECT AND SCAN YOUR CARD FOR LIVE RANKINGS':
          /Card not found|disabled|Register|session expired/i.test(errorText)?'CARD SESSION INVALID · RE-SCAN YOUR CARD':
          /index/i.test(errorText)?'RANKINGS INDEX MISSING · ASK TEACHER TO CHECK FIRESTORE INDEXES':
          /permission|denied/i.test(errorText)?'FIRESTORE PERMISSION DENIED · ASK TEACHER TO CHECK RULES':
          'RANKINGS UNAVAILABLE · '+(errorText||'RETRY WHEN CONNECTED');
        rankingsView(mode,grade,null,reason);
      }
    }
  }

  // ---- Profile modal ----
  let profileOverlayRequired = false;
  let profileOverlayOnDone = null;
  let selectedIconId = null;
  let profileCreateStep = "full";

  function setOverlayShow(el, show){
    if(!el) return;
    if(show){
      el.classList.add("show");
      el.setAttribute("aria-hidden", "false");
      el.style.cursor = "default";
    }else{
      el.classList.remove("show");
      el.setAttribute("aria-hidden", "true");
    }
  }
  function isOverlayShown(el){
    return !!(el && el.classList.contains("show"));
  }

  // The default character is the Adventure Card's player, not a separate named operator.
  // Read the current card identity each time so sharing a Chromebook never leaks a prior name.
  function adventurePlayerDisplayName(){
    const cardName = String(ADVENTURE_CONTEXT.name || "").trim();
    const localName = String(profile?.name || "").trim();
    return cardName || localName || "Player";
  }

  function getIntroCharacterMeta(){
    const charId = getSelectedOperator(); // Equipped operator is the only visual character selection.
    const map = {
      mc: { name: adventurePlayerDisplayName(), path: "assets/characters/mc.webp" },

    };
    // The player may feature any operator they have actually recruited.
    const owned = window.ADVENTURE_PLAYER?.recruitment?.owned || {};
    if(Object.prototype.hasOwnProperty.call(owned,charId) && /^[a-z][a-z0-9_]{0,39}$/.test(charId)){
      map[charId] = {name:window.RPG_OPERATOR_PASSIVES?.RULES?.[charId]?.name||charId.replace(/_/g,' '),path:`assets/recruitment/${charId}.webp`};
    }
    const meta = map[charId] || map.mc;
    return { id: map[charId] ? charId : "mc", name: meta.name, src: window.RPG_MEDIA?.url(meta.path) || meta.path };
  }

  function renderIntroCharacterFigure(){
    if(!introCharacterFigure) return;
    const meta = getIntroCharacterMeta();
    if(introCharacterFigure.dataset.sourceSrc !== meta.src) setImageSource(introCharacterFigure, meta.src);
    introCharacterFigure.dataset.characterId = meta.id;
  }

  function renderIntroProfileCard(){
    if(!introProfileCard || !introProfileIcon || !introProfileName || !introProfileLevel) return;

    const p = profile || null;
    const name = adventurePlayerDisplayName();
    const lvl = p ? levelFromXp(p.xp) : 1;

    // Always show the equipped operator, not the old editable Profile icon.
    const src = equippedOperatorIconSrc();

    if(introProfileName.textContent !== name) introProfileName.textContent = name;
    const lvlText = `Lv.${lvl}`;
    if(introProfileLevel.textContent !== lvlText) introProfileLevel.textContent = lvlText;
    if(introProfileExp){
      const xp = Math.max(0, Math.trunc(Number(p && p.xp) || 0));
      const nextBase = xpNeededToReachLevel(lvl + 1);
      const xt = `EXP: ${xp}/${nextBase}`;
      if(introProfileExp.textContent !== xt) introProfileExp.textContent = xt;
    }
    if(introProfileIcon.dataset.sourceSrc !== src) setImageSource(introProfileIcon, src);
    if(introProfileSelected){
      const charMeta = getIntroCharacterMeta();
      const selectedName = charMeta.id === 'mc' ? charMeta.name : String(charMeta.name).toUpperCase();
      const selectedText = `EQUIPPED / ${selectedName}`;
      if(introProfileSelected.textContent !== selectedText) introProfileSelected.textContent = selectedText;
    }
    renderIntroCharacterFigure();

    // Show/hide: show if we have any profile object (or always show as default)
    introProfileCard.setAttribute("aria-hidden", "false");
  }


  function renderProfileHeader(){
    // Only update if needed (avoid extra DOM churn)
    if(!playerLabel) return;

    syncCoreAchievementsFromFlags();

    const p = profile;
    const name = adventurePlayerDisplayName();
    const lvl = p ? levelFromXp(p.xp) : 1;

    // Name + level
    const label = name;
    const labelText = label;
    if(playerLabel.textContent !== labelText) playerLabel.textContent = labelText;

    if(playerLevelText){
      const lt = name ? `Lv.${lvl}` : "";
      if(playerLevelText.textContent !== lt) playerLevelText.textContent = lt;
    }

    // EXP progress (toward next level)
    if(playerExpText){
      if(p){
        const xp = Math.max(0, Math.trunc(Number(p && p.xp) || 0));
        const nextBase = xpNeededToReachLevel(lvl + 1);
        const xt = `EXP: ${xp}/${nextBase}`;
        if(playerExpText.textContent !== xt) playerExpText.textContent = xt;
      }else{
        if(playerExpText.textContent !== "") playerExpText.textContent = "";
      }
    }

    // Player HUD portrait is always the equipped operator's face icon.
    if(playerIconEl){
      const src = equippedOperatorIconSrc();
      if(playerIconEl.dataset.sourceSrc !== src){
        setImageSource(playerIconEl,src,{onerror:()=>{
          const fallback='assets/profile-icons/mc.webp';
          if(src!==fallback)setImageSource(playerIconEl,fallback);
        }});
      }
    }
    try{ renderIntroProfileCard(); }catch(_){/* ignore */}

  }

  function renderIconGrid(){
    if(!profileIconGrid) return;

    const work = profile || createDefaultProfile();
    const owned = new Set(work.unlockedIcons || []);
    const current = selectedIconId || work.iconId || "icon01";
    const coinsNow = Math.max(0, Math.trunc(Number(work.coins) || 0));
    if(profileCoinsValue) profileCoinsValue.textContent = fmtCoins(coinsNow);

    profileIconGrid.innerHTML = "";
    for(const icon of PROFILE_ICON_PRESETS){
      const price = Math.max(0, Math.trunc(Number(icon.price) || 0));
      const isOwned = owned.has(icon.id) || !!icon.starter;

      // Limited-event reward icons are completely hidden until earned.
      if(icon.hiddenUntilOwned && !isOwned) continue;

      // First-time profile creation should only show icons the student can already use.
      // The full icon list/shop is still shown when they open Profile later.
      if(profileOverlayRequired && !isOwned) continue;

      const canAfford = (price <= 0) || (coinsNow >= price);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "iconBtn" + (icon.id === current ? " selected" : "");
      btn.dataset.iconId = icon.id;

      // If not owned, show as locked but still clickable (click buys).
      if(!isOwned){
        btn.title = canAfford ? `Buy for ${fmtCoins(price)} coins` : `Need ${fmtCoins(price)} coins`;
        btn.style.opacity = canAfford ? "1" : ".55";
      }else{
        btn.title = icon.id;
      }

      const img = document.createElement("img");
      img.className = "iconImg pixel";
      img.alt = icon.id;
      setImageSource(img, icon.file);
      img.addEventListener("error", () => {
        try{
          img.remove();
          const fallback = document.createElement("div");
          fallback.textContent = icon.short || "??";
          fallback.style.fontWeight = "1000";
          fallback.style.color = "var(--gold)";
          fallback.style.fontSize = "16px";
          btn.appendChild(fallback);
        }catch(_){/* ignore */}
      });
      btn.appendChild(img);

      // Price / owned label (kept in-flow to avoid clipping into neighbors)
      if(!isOwned && price > 0){
        const tag = document.createElement("div");
        tag.className = "iconPriceTag";
        tag.textContent = `BUY ${fmtCoins(price)}`;
        btn.appendChild(tag);

        if(!canAfford){
          const note = document.createElement("div");
          note.className = "iconLockedNote";
          note.textContent = "Not enough";
          btn.appendChild(note);
        }
      }

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if(!profile) return;

        const ownedNow = new Set(profile.unlockedIcons || []);
        const alreadyOwned = ownedNow.has(icon.id) || !!icon.starter;

        if(alreadyOwned){
          selectedIconId = icon.id;
          renderIconGrid();
          return;
        }

        const cost = Math.max(0, Math.trunc(Number(icon.price) || 0));
        if(cost <= 0){
          // Free icon
          ensureIconUnlocked(icon.id);
          selectedIconId = icon.id;
          try{ requestCloudCheckpointSave("icon-unlocked"); }catch(_){/* ignore */}
          renderIconGrid();
          return;
        }

        if(!spendCoins(cost)){
          if(profileHint) profileHint.textContent = `Coins が足りません（必要: ${fmtCoins(cost)}）`;
          return;
        }

        // Mark owned + auto-select
        ensureIconUnlocked(icon.id);
        selectedIconId = icon.id;
        try{ requestCloudCheckpointSave("icon-purchased"); }catch(_){/* ignore */}
        if(profileHint) profileHint.textContent = `購入しました！ (${fmtCoins(cost)} coins)`;
        renderIconGrid();
      });

      profileIconGrid.appendChild(btn);
    }
  }

  function validateProfileAccountStep(){
    if(!profile) profile = createDefaultProfile();

    const name = String(profileNameInput ? profileNameInput.value : "").trim();
    if(name.length <= 0){
      if(profileHint) profileHint.textContent = "Username を入力してください";
      setCloudStatus("Username is required.", true);
      return false;
    }
    if(name.length > 16){
      if(profileHint) profileHint.textContent = "Username は16文字以内です";
      setCloudStatus("Username must be 16 characters or fewer.", true);
      return false;
    }

    profile.name = name;
    // QR card identity replaces the old Google account/password scheme.
    profile.cloudId = "";
    profile.cloudPin = "";
    if(profileHint) profileHint.textContent = "";
    setCloudStatus(cloudSyncEnabled()
      ? "Account set. Choose an icon next."
      : "Account set. Cloud sync is not set up yet.", !cloudSyncEnabled());
    return true;
  }

  function setProfileCreateStep(step){
    profileCreateStep = step || "full";
    const required = !!profileOverlayRequired;
    const accountOnly = required && profileCreateStep === "account";
    const iconOnly = required && profileCreateStep === "icon";

    if(profileAccountStep) profileAccountStep.classList.toggle("hidden", iconOnly);
    if(profileIconStep) profileIconStep.classList.toggle("hidden", accountOnly);

    if(profileNextBtn) profileNextBtn.style.display = accountOnly ? "" : "none";
    if(profileBackBtn) profileBackBtn.style.display = iconOnly ? "" : "none";
    if(profileSaveBtn){
      profileSaveBtn.style.display = accountOnly ? "none" : "";
      profileSaveBtn.textContent = required ? "Create Profile" : "Save";
    }
    if(profileCloudSaveBtn) profileCloudSaveBtn.style.display = accountOnly ? "none" : "";
    if(profileCloudLoadBtn) profileCloudLoadBtn.style.display = accountOnly ? "" : "";
    if(profileCancelBtn) profileCancelBtn.style.display = required ? "none" : "";

    if(profileTitle) profileTitle.textContent = required
      ? (accountOnly ? "CREATE PROFILE" : "CHOOSE ICON")
      : "PROFILE";
    if(profileDesc) profileDesc.textContent = required
      ? (accountOnly
          ? "First, enter your Username and Password."
          : "Next, choose your starter icon.")
      : "";
    if(profileHint) profileHint.textContent = "";

    if(accountOnly && profileNameInput){
      try{ setTimeout(() => profileNameInput.focus(), 0); }catch(_){/* ignore */}
    }
  }

function openProfileModal(required=false, onDone=null){
    if(!profile) profile = createDefaultProfile();

    profileOverlayRequired = !!required;
    profileOverlayOnDone = (typeof onDone === "function") ? onDone : null;
    profileCreateStep = required ? "account" : "full";

    if(profileNameInput){
      profileNameInput.value = String(profile.name || "");
    }

    selectedIconId = profile.iconId || "icon01";
    renderCloudProfileControls();
    setCloudStatus(cloudSyncEnabled()
      ? (profile.cloudId
          ? `Cloud ready. Class: ${getClassYearLabel(profile.classYear)}. Vocab: ${WORDS.length} words (${vocabSourceLabel}).`
          : "Enter a Username + Password.")
      : "Cloud sync not set up yet. Paste the Apps Script Web App URL in the HTML first.", !cloudSyncEnabled());

    try{ if(profileCoinsValue) profileCoinsValue.textContent = fmtCoins(getCoins()); }catch(_){/* ignore */}
    renderIconGrid();
    setProfileCreateStep(profileCreateStep);
    setOverlayShow(profileOverlay, true);
  }

  function closeProfileModal(){
    setOverlayShow(profileOverlay, false);
    profileOverlayRequired = false;
    profileOverlayOnDone = null;
    profileCreateStep = "full";
  }

  function commitProfileFromModal(){
    if(!profile) profile = createDefaultProfile();

    if(profileOverlayRequired && profileCreateStep === "account"){
      if(validateProfileAccountStep()){
        setProfileCreateStep("icon");
        renderIconGrid();
      }
      return false;
    }

    if(!validateProfileAccountStep()) return false;
    const name = String(profileNameInput ? profileNameInput.value : "").trim();

    // Ensure selected icon is selectable
    const iconId = String(selectedIconId || profile.iconId || "icon01");
        const owned = new Set(profile.unlockedIcons || []);
    const iconDef2 = PROFILE_ICON_PRESETS.find(x=>x.id===iconId);
    const isOwned = owned.has(iconId) || (iconDef2 && iconDef2.starter);
    if(!isOwned){
      if(profileHint) profileHint.textContent = "そのアイコンは購入してください";
      return false;
    }
const iconDef = PROFILE_ICON_PRESETS.find(x=>x.id===iconId) || PROFILE_ICON_PRESETS[0];
    // Save
    profile.name = name;
    profile.iconId = iconId;
    profile.classYear = applyClassYearToVocab(profile.classYear || activeClassYear || DEFAULT_CLASS_YEAR);
    ensureIconUnlocked(iconId);
    syncCloudFieldsIntoProfile();

    profile.updatedAt = Date.now();
    saveProfile(profile);
    // Classroom flow: if a Password is entered, the normal Save button also saves/updates the cloud profile.
    try{
      if(cleanCloudPin(profile.cloudPin || "")) requestCloudCheckpointSave("profile-saved");
    }catch(_){/* ignore */}

    renderProfileHeader();

    const cb = profileOverlayOnDone;
    closeProfileModal();
    if(cb) cb();
    return true;
  }

  function openAchievementsModal(){
    syncCoreAchievementsFromFlags();
    if(achTitle) achTitle.textContent = "ACHIEVEMENTS";
    if(achDesc) achDesc.textContent = "";

    if(achList){
      achList.innerHTML = "";
      if(!ACHIEVEMENT_DEFS.length){
        const d = document.createElement("div");
        d.className = "muted";
        d.textContent = "No achievements yet.";
        achList.appendChild(d);
      }else{
        for(const a of ACHIEVEMENT_DEFS){
          const unlocked = profileHas(a.id);
          const row = document.createElement("div");
          row.className = "achRow" + (unlocked ? "" : " locked");

          const ic = document.createElement("div");
          ic.className = "achIcon";
          ic.textContent = unlocked ? (a.icon || "★") : "？";

          const body = document.createElement("div");
          const t = document.createElement("div");
          t.className = "achTitle";
          t.textContent = unlocked ? a.title : "???";
          const d = document.createElement("div");
          d.className = "achDesc";
          d.textContent = unlocked ? a.desc : `LOCKED — ${a.desc}`;
          body.appendChild(t);
          body.appendChild(d);

          row.appendChild(ic);
          row.appendChild(body);
          achList.appendChild(row);
        }
      }
    }
    setOverlayShow(achOverlay, true);
  }
  function closeAchievementsModal(){
    setOverlayShow(achOverlay, false);
  }

  // Click outside to close (if allowed)
  if(profileOverlay){
    profileOverlay.addEventListener("click", (e) => {
      if(e.target !== profileOverlay) return;
      if(profileOverlayRequired) return;
      closeProfileModal();
    });
  }
  if(achOverlay){
    achOverlay.addEventListener("click", (e) => {
      if(e.target !== achOverlay) return;
      closeAchievementsModal();
    });
  }
  if(profileNextBtn) profileNextBtn.addEventListener("click", (e)=>{
    e.stopPropagation();
    if(validateProfileAccountStep()){
      setProfileCreateStep("icon");
      renderIconGrid();
    }
  });
  if(profileBackBtn) profileBackBtn.addEventListener("click", (e)=>{
    e.stopPropagation();
    if(profileOverlayRequired) setProfileCreateStep("account");
  });
  if(profileSaveBtn) profileSaveBtn.addEventListener("click", (e)=>{ e.stopPropagation(); commitProfileFromModal(); });
  if(profileCancelBtn) profileCancelBtn.addEventListener("click", (e)=>{ e.stopPropagation(); closeProfileModal(); });
  if(profileCloudSaveBtn) profileCloudSaveBtn.addEventListener("click", (e)=>{
    e.stopPropagation();
    saveProfileToCloud(true);
  });
  if(profileCloudLoadBtn) profileCloudLoadBtn.addEventListener("click", (e)=>{
    e.stopPropagation();
    loadProfileFromCloud();
  });
  if(achCloseBtn) achCloseBtn.addEventListener("click", (e)=>{ e.stopPropagation(); closeAchievementsModal(); });

  // ESC should close these modals first (without pausing/resuming etc.)
  window.addEventListener("keydown", (e) => {
    if(e.key !== "Escape") return;
    if(isOverlayShown(profileOverlay)){
      if(!profileOverlayRequired){
        e.preventDefault(); e.stopPropagation();
        closeProfileModal();
      }
      return;
    }
    if(isOverlayShown(achOverlay)){
      e.preventDefault(); e.stopPropagation();
      closeAchievementsModal();
      return;
    }
  }, true);

  // Allow quick reset during non-typing overlay states (prevents the need for an on-overlay Reset button).
  window.addEventListener("keydown", (e) => {
    if(!(e.key === "r" || e.key === "R")) return;
    // Only when the main game overlay is shown (not Profile/Achievements) and we're not in Mode Select.
    if(!isOverlayShown(overlay)) return;
    if(isOverlayShown(profileOverlay) || isOverlayShown(achOverlay)) return;
    if(gameState === "modeselect") return;

    // These states are safe to reset from (no active typing input).
    const okStates = ["dialogue", "stageclear", "victory", "paused"];
    if(!okStates.includes(gameState)) return;

    e.preventDefault();
    e.stopPropagation();
    resetGame();
  }, true);
  const stageNameEl = document.getElementById("stageName");
  const bossNameEl = document.getElementById("bossName");

  const bossFill = document.getElementById("bossFill");
  const bossHpText = document.getElementById("bossHpText");
  const ex4EyeBanner = document.getElementById("ex4EyeBanner");


  const playerFill = document.getElementById("playerFill");
  const playerBonusFill = document.getElementById("playerBonusFill");
  const playerMeter = document.getElementById("playerMeter");
  const playerHpText = document.getElementById("playerHpText");
  const mistakesText = document.getElementById("mistakesText");

  const continuesText = document.getElementById("continuesText");
  const scoreModeLabel = document.getElementById("scoreModeLabel");
  const scoreText = document.getElementById("scoreText");
  const bestScoreText = document.getElementById("bestScoreText");
  const scorePenaltyText = document.getElementById("scorePenaltyText");


  const msgBox = document.getElementById("msgBox");
  const answerForm = document.getElementById("answerForm");
  const answerInput = document.getElementById("answerInput");


  const startCmd = document.getElementById("startCmd");
  const pauseCmd = document.getElementById("pauseCmd");
  const pauseCmdText = document.getElementById("pauseCmdText");
  const resetCmd = document.getElementById("resetCmd");
  const runCmd = document.getElementById("runCmd");
  const profileCmd = document.getElementById("profileCmd");
  const achievementsCmd = document.getElementById("achievementsCmd");

  const bgmVol = document.getElementById("bgmVol");
  const bgmVolText = document.getElementById("bgmVolText");
  const bgmMuteBtn = document.getElementById("bgmMuteBtn");

  function showOverlay(show){
    overlay.classList.toggle("show", show);
    // Only Mode Select gets the full-screen background. Dialogue and battle
    // overlays retain their original translucent behavior.
    if(!show) overlay.classList.remove("mode-select-active", "defeat-active");
    if(!show && overlayBox){
      overlayBox.classList.remove("modeSelectMenu", "defeat-card", "hearts-phase", "rankings-card");
      overlayBox.querySelector('.operator-showcase')?.remove();
      overlay.querySelector('.operator-selection-backdrop')?.remove();
    }
    // Ensure the overlay is always the top-most interactive layer.
    // (Some browsers create tricky stacking contexts with transformed elements.)
    const bf = document.getElementById("battlefield");
    if(bf) bf.classList.toggle("overlayOpen", !!show);
  }
  function setOverlayText(title, desc, hint){
    overlayBox?.querySelector('.operator-showcase')?.remove();
    overlay.querySelector('.operator-selection-backdrop')?.remove();
    overlay.classList.remove("mode-select-active", "defeat-active");
    if(overlayBox) overlayBox.classList.remove("defeat-card", "hearts-phase", "rankings-card");
    overlayTitle.textContent = title;
    overlayDesc.textContent = desc;
    overlayHint.textContent = hint;
    countdownText.textContent = "";
    overlayChoices.classList.remove("show");
    overlayChoices.innerHTML = "";
    if(overlayBox) overlayBox.classList.remove("debugSmall", "modeSelectMenu");
    overlay.style.cursor = "pointer";
  }
  function setOverlayTitleStageClear(stageName){
    overlayTitle.innerHTML = `<span class="stageClearSlide">${escapeHtml(stageName)} Clear</span>`;
  }

  function pushMsg(text, muted=false){
    const div = document.createElement("div");
    div.textContent = text;
    if(muted) div.className = "muted";
    msgBox.appendChild(div);
    while(msgBox.children.length > 8) msgBox.removeChild(msgBox.firstChild);
    msgBox.scrollTop = msgBox.scrollHeight;
  }

  function showStage5Timer(show){
    stage5Timer.classList.toggle("show", !!show);
  }

  function formatTime(sec){
    const s = Math.max(0, Math.ceil(sec));
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, "0");
    return `${m}:${ss}`;
  }
    let stage5TimerLastText = "";

  function updateStage5Timer(){
    // Stage 5 no longer uses a BGM-remaining timer.
    showStage5Timer(false);
  }

  let bossBubbleTimer = null;
  function showBossBubble(text, ms=4000){
    if(bossBubbleTimer){ clearTimeout(bossBubbleTimer); bossBubbleTimer = null; }
    bossBubble.textContent = text;
    bossBubble.classList.add("show");
    bossBubbleTimer = setTimeout(() => {
      bossBubble.classList.remove("show");
      bossBubble.textContent = "";
      bossBubbleTimer = null;
    }, ms);
  }
  function hideBossBubble(){
    if(bossBubbleTimer){ clearTimeout(bossBubbleTimer); bossBubbleTimer = null; }
    bossBubble.classList.remove("show");
    bossBubble.textContent = "";
  }


  

const bgm = new Audio();
  bgm.preload = "metadata";
  bgm.loop = true;

  let currentBgm = "";
  let isMuted = false;
  let lastVol = 0.35;
  let sleepyBgmGain = 1; // Temporary chapter Sleepy reduction, independent of user volume / mute.
  function syncBgmVolume(){
    try{ bgm.volume = Math.min(1, Math.max(0, lastVol * sleepyBgmGain)); }catch(_){/* ignore */}
  }
  function setSleepyBgmGain(gain){
    const next = Number.isFinite(gain) ? Math.max(0,Math.min(1,gain)) : 1;
    if(Math.abs(next-sleepyBgmGain)<0.001)return;
    sleepyBgmGain=next;syncBgmVolume();
  }
  let audioUnlocked = false;

  let savedBgmState = null;
  function saveBgmState(){
    savedBgmState = {
      src: currentBgm || (bgm.currentSrc || ""),
      time: Number.isFinite(bgm.currentTime) ? bgm.currentTime : 0,
      loop: !!bgm.loop
    };
  }
  function restoreBgmState(){
    if(!savedBgmState || !savedBgmState.src) return;
    const {src, time, loop} = savedBgmState;
    setBgm(src, loop);
    try{ bgm.currentTime = Math.max(0, time || 0); }catch(_){}
    savedBgmState = null;
  }

  function pushAudioHintOnce(msg){
    pushMsg(msg || "⚠️ Safari/iOS：自動再生がブロックされる場合があります。音が出ない時はSTARTを押してからUNMUTEを押してください", true);
  }

  function setBgmVolume(v01){
    const v = Math.max(0, Math.min(1, v01));
    lastVol = v;
    // Always keep the real volume in sync; muting is handled via bgm.muted.
    syncBgmVolume();
    try{ bgm.muted = !!isMuted; }catch(_){/* ignore */}
    bgmVol.value = String(Math.round(v * 100));
    bgmVolText.textContent = `${Math.round(v * 100)}%`;
  }
  function toggleMute(){
    isMuted = !isMuted;
    try{ bgm.muted = !!isMuted; }catch(_){/* ignore */}
    syncBgmVolume();
    bgmMuteBtn.textContent = isMuted ? "UNMUTE" : "MUTE";
    // Helpful on iOS/Safari: unmuting is a user gesture, so retry play.
    if(!isMuted) tryPlayBgm();
  }
  async function tryPlayBgm(){
    try{
      // If the track ended (non-loop), rewind so play() can restart.
      try{
        if(Number.isFinite(bgm.duration) && bgm.duration > 0){
          if(bgm.ended || bgm.currentTime >= bgm.duration - 0.05){
            bgm.currentTime = 0;
          }
        }
      }catch(_){/* ignore */}

      // Keep element mute state consistent with the UI state.
      try{ bgm.muted = !!isMuted; }catch(_){/* ignore */}
      if(!isMuted) syncBgmVolume();

      const p = bgm.play();
      if(p && typeof p.catch === "function"){
        p.catch(() => {
          // Fallback: try muted autoplay (often allowed) so BGM can begin immediately.
          try{
            const prevUserMuted = isMuted;
            const prevMutedProp = bgm.muted;

            // Force muted playback and reflect it in UI so UNMUTE works.
            isMuted = true;
            bgmMuteBtn.textContent = "UNMUTE";
            bgm.muted = true;
            syncBgmVolume();

            const p2 = bgm.play();
            if(p2 && typeof p2.catch === "function"){
              p2.catch(() => {
                // Restore previous state if even muted autoplay was blocked.
                isMuted = prevUserMuted;
                bgmMuteBtn.textContent = prevUserMuted ? "UNMUTE" : "MUTE";
                bgm.muted = prevMutedProp;
                if(!prevUserMuted) syncBgmVolume();
                pushAudioHintOnce();
              });
            }else{
              // muted autoplay likely succeeded
              pushAudioHintOnce("🔇 自動再生がブロックされました（ミュートで再生中）。音を出すにはUNMUTEしてください");
            }
          }catch(_){
            pushAudioHintOnce();
          }
        });
      }
    }catch(_){
      pushAudioHintOnce();
    }
  }
  
  // iOS/iPad Safari sometimes treats later async BGM starts as "autoplay" and forces mute.
  // When we have a REAL user gesture (tap/click), use this helper to start BGM with sound.
  function tryPlayBgmFromGesture(){
    // Explicit user intent: default to unmuted.
    isMuted = false;
    bgmMuteBtn.textContent = "MUTE";
    syncBgmVolume();

    // If the track ended (non-loop), rewind so play() can restart.
    try{
      if(Number.isFinite(bgm.duration) && bgm.duration > 0){
        if(bgm.ended || bgm.currentTime >= bgm.duration - 0.05){
          bgm.currentTime = 0;
        }
      }
    }catch(_){/* ignore */}

    // Workaround: start muted, then immediately unmute in the same gesture tick.
    // This improves the success rate of audible playback on iOS Safari.
    try{
      try{ bgm.muted = true; }catch(_){/* ignore */}
      const p = bgm.play();
      try{ bgm.muted = false; }catch(_){/* ignore */}
      if(p && typeof p.catch === "function"){
        p.catch(() => {
          pushAudioHintOnce("⚠️ iPad/Safari：音が出ない時は、もう一度画面をタップしてからMUTE/UNMUTEを押してください");
        });
      }
    }catch(_){
      pushAudioHintOnce("⚠️ iPad/Safari：音が出ない時は、もう一度画面をタップしてからMUTE/UNMUTEを押してください");
    }
  }


function setBgm(src, loop=true, autoplay=true){
    bgm.loop = !!loop;
    const asset = window.RPG_MEDIA?.classify(src);
    if(!src || (asset && !asset.present)){ stopBgm(); return; }
    const url = asset?.url || src;
    if(currentBgm !== src){
      setSleepyBgmGain(1);
      currentBgm = src;
      bgm.src = url;
      bgm.currentTime = 0;
      try{ bgm.load(); }catch(_){/* ignore */}
    }
    if(autoplay) tryPlayBgm();
  }
  function stopBgm(){
    setSleepyBgmGain(1);
    currentBgm = "";
    bgm.pause();
    bgm.removeAttribute("src");
    bgm.load();
  }

  // Clear Extra Stage 2 only when its stage BGM finishes (boss takes no damage).
  // NOTE: We guard by (1) stage, (2) gameState, and (3) currentBgm matching the stage BGM.
  bgm.addEventListener("ended", () => {
    try{
      if(!ex2ClearOnBgmEndActive) return;
      if(!isExtraStage2()) return;
      if(gameState !== "playing") return;
      if(!ex2ClearOnBgmEndSrc || currentBgm !== ex2ClearOnBgmEndSrc) return;

      ex2ClearOnBgmEndActive = false; // prevent double-fire
      ex2ClearOnBgmEndSrc = "";

      onBossDefeated();
    }catch(_){/* ignore */}
  });

  // ---- Intro start screen (pre-menu) ----
  // Replace these drop-in filenames anytime you want by overwriting the files in the same folder.
  const INTRO_BG_LOCKED = "";
  const INTRO_BG_UNLOCKED = "";
  const INTRO_BG_MASTER = "";
  const INTRO_BGM_LOCKED = "";
  const INTRO_BGM_UNLOCKED = "";
  const INTRO_BGM_MASTER = "";
  const INTRO_FAKE_LOAD_MS = 400;

  const introOverlay = document.getElementById("introOverlay");
  const introBg = document.getElementById("introBg");
  const introBadge = document.getElementById("introBadge");
  const introStartBtn = document.getElementById("introStartBtn");
  const introNote = document.getElementById("introNote");

  // Center profile display on startup screen
  const introProfileCard = document.getElementById("introProfileCard");
  const introProfileIcon = document.getElementById("introProfileIcon");
  const introProfileName = document.getElementById("introProfileName");
  const introProfileLevel = document.getElementById("introProfileLevel");
  const introProfileExp = document.getElementById("introProfileExp");
  const introProfileSelected = document.getElementById("introProfileSelected");
  const introCharacterFigure = document.getElementById("introCharacterFigure");

  let introTimer = null;
  let introState = "idle"; // "idle" -> "loading" -> "ready"
  let introShownOnce = false;
  let introBgmErrorHandler = null;

  // ---- Intro unlocked BG glitch reveal ----
  let introIsUnlocked = false;

  let introRevealActive = false;
  let introRevealRAF = null;
  let introPulseTimer = null;
  let introPulseCleanupTimer = null;
  let introBaseOpacity = 1; // eased 0..1

  function stopIntroBgGlitch(){
    introRevealActive = false;
    if(introRevealRAF){ cancelAnimationFrame(introRevealRAF); introRevealRAF = null; }
    if(introPulseTimer){ clearTimeout(introPulseTimer); introPulseTimer = null; }
    if(introPulseCleanupTimer){ clearTimeout(introPulseCleanupTimer); introPulseCleanupTimer = null; }
    introBg.classList.remove("introGlitching", "introGlitchPulse");
    introBg.style.removeProperty("--gX");
    introBg.style.removeProperty("--gY");
    introBg.style.removeProperty("--gSkew");
    introBg.style.removeProperty("--gShiftX");
  }

  function setIntroBgHidden(hidden){
    introBg.classList.toggle("introHidden", !!hidden);
    if(hidden){
      introBaseOpacity = 0;
      introBg.style.opacity = "0";
    }else{
      introBaseOpacity = 1;
      introBg.style.opacity = "1";
    }
  }

  function startUnlockedIntroBgReveal(){
    // Smooth reveal for unlocked/master intro background (no glitch).
    stopIntroBgGlitch();
    introRevealActive = true;

    introBg.classList.remove("introHidden");
    introBg.classList.remove("introGlitching", "introGlitchPulse");

    const start = performance.now();
    const dur = INTRO_FAKE_LOAD_MS;

    const step = () => {
      if(!introRevealActive) return;
      const p = clamp((performance.now() - start) / dur, 0, 1);
      // ease-in so it starts "invisible"
      const eased = Math.pow(p, 1.18);
      introBaseOpacity = eased;
      introBg.style.opacity = String(clamp(eased, 0, 1));

      if(p < 1){
        introRevealRAF = requestAnimationFrame(step);
      }else{
        introRevealRAF = null;
      }
    };
    introRevealRAF = requestAnimationFrame(step);
  }

  function finishUnlockedIntroBgReveal(){
    // Called when fake loading finishes (~5s)
    stopIntroBgGlitch();
    introBg.classList.remove("introHidden");
    introBg.style.opacity = "1";
  }


  function setIntroState(state){
    introState = state;
    try{ introOverlay.dataset.state = state; }catch(_){ }
    if(state === "idle"){
      introStartBtn.disabled = false;
      introStartBtn.innerHTML = `Load <span class="introStartArrow">▶</span>`;
      introNote.textContent = introNote.textContent || "Press LOAD";
    }else if(state === "loading"){
      introStartBtn.disabled = true;
      introStartBtn.textContent = "Loading…";
    }else if(state === "ready"){
      introStartBtn.disabled = false;
      introStartBtn.innerHTML = `Start <span class="introStartArrow">▶</span>`;
      introNote.textContent = "";
    }
  }

  function showIntroStartScreen(force=false){
    if(introShownOnce && !force) return;
    introShownOnce = true;

    setIntroState("ready");

    const normalDone = loadNormalCleared();
    const extraDone = loadExtraCleared();
    const masterDone = (normalDone && extraDone);

    introIsUnlocked = !!normalDone; // any Normal clear unlocks the "LOAD->reveal" behavior
    stopIntroBgGlitch();
    // Unlocked/Master intro bg starts invisible until LOAD is pressed.
    setIntroBgHidden(introIsUnlocked);


    const bgFile = masterDone ? INTRO_BG_MASTER : (normalDone ? INTRO_BG_UNLOCKED : INTRO_BG_LOCKED);
    const bgmFile = masterDone ? INTRO_BGM_MASTER : (normalDone ? INTRO_BGM_UNLOCKED : INTRO_BGM_LOCKED);
// Background: set directly (more robust) + keep CSS var for fallback.
    const introArt=window.RPG_MEDIA?.classify(bgFile);
    const introBackground=introArt ? introArt.url : bgFile;
    introBg.style.setProperty("--introBg",introBackground ? `url("${introBackground}")` : 'none');
    introBg.style.backgroundImage=introBackground ? `url("${introBackground}")` : 'none';

    // Badge text (optional)
    introBadge.textContent = "RPG TYPING VERSUS";

    // Diagnostics / guidance
    introNote.textContent = "";
    try{ renderIntroProfileCard(); }catch(_){/* ignore */}
// Preload background to detect missing file / wrong path
    try{
      const img = new Image();
      img.onload = () => {
        // background loaded
      };
      img.onerror = () => {
        introNote.textContent = 'BACKGROUND UNAVAILABLE'; console.warn('Missing intro background:', bgFile);
      };
      // The same versioned URL is shared with the CSS background; no duplicate cache-busting fetch.
      if(introBackground) img.src = introBackground;
    }catch(_){}

    introOverlay.classList.add("show");
    introOverlay.setAttribute("aria-hidden", "false");

    // Audio: set the track now, but DO NOT start until the user presses LOAD.
    stopBgm();
    setBgm(bgmFile, true, false);
    if(introBgmErrorHandler){
      bgm.removeEventListener("error", introBgmErrorHandler);
      introBgmErrorHandler = null;
    }

    const onBgmError = () => {
      if(currentBgm === bgmFile){
        introNote.textContent = 'AUDIO UNAVAILABLE'; console.warn('Missing intro audio:', bgmFile);
      }
      bgm.removeEventListener("error", onBgmError);
    };
    introBgmErrorHandler = onBgmError;
    if(bgmFile) bgm.addEventListener("error", onBgmError);
  }
  function hideIntroStartScreen(){
    if(introTimer) clearTimeout(introTimer);
    introTimer = null;

    stopIntroBgGlitch();

    introOverlay.classList.remove("show");
    introOverlay.setAttribute("aria-hidden", "true");

    // Stop intro music. (Stage/Dialogue BGMs will start normally once the game begins.)
    stopBgm();
  }
  introStartBtn.addEventListener("click", (e) => {
    e.stopPropagation();

    // Any button press counts as a user gesture: force an audible start on iPad/Safari.
    try{ tryPlayBgmFromGesture(); }catch(_){
      try{ bgm.muted = false; }catch(_){/* ignore */}
      tryPlayBgm();
    }

    if(introState === "ready"){
      hideIntroStartScreen();
      if(Number(window.ADVENTURE_PLAYER?.tutorial?.version)===0){
        // First-time accounts complete the four lessons, including a real free 10-pull.
        window.location.assign('tutorial.html');
        return;
      }
      try{ showModeSelectScreen(); }catch(_){ /* ignore */ }
    }
  });



  const sfxPool = { bossHit: [], bossIdx: 0, playerHit: [], playerIdx: 0 };
  function initSfxPool(){
    const n = 4;

    // Boss hit
    sfxPool.bossHit = Array.from({length:n}, () => {
      const a = new Audio(AUDIO.bossHitSfx);
      a.preload = "auto";
      a.volume = 0.55;
      return a;
    });

    // Player damage
    sfxPool.playerHit = Array.from({length:n}, () => {
      const a = new Audio(AUDIO.playerHitSfx);
      a.preload = "auto";
      a.volume = 0.70;
      return a;
    });
}
  function playBossHitSfx(){
    const arr = sfxPool.bossHit;
    if(!arr || arr.length === 0) return;
    const a = arr[sfxPool.bossIdx % arr.length];
    sfxPool.bossIdx++;
    try{ a.currentTime = 0; a.play().catch(()=>{}); }catch(_){}
  }

  function playPlayerHitSfx(){
    const arr = sfxPool.playerHit;
    if(!arr || arr.length === 0) return;
    const a = arr[sfxPool.playerIdx % arr.length];
    sfxPool.playerIdx++;
    try{ a.currentTime = 0; a.play().catch(()=>{}); }catch(_){}
  }
  function unlockAudioOnce(){
    if(audioUnlocked) return;
    audioUnlocked = true;
    // No auto-audio warmup here: intro BGM must only start when the user presses LOAD.
  }

async function launchStoryStage(stage){
  if(!stage)return;
  storySelectedStage = stage;
  try{window.RPG_BALANCE?.setActive('story',String(stage.id),String(stage.id).split('-')[0]);}catch(_){}
  const wantsBattle = stage.type !== "story-only";
  if(wantsBattle){
    const templateId=Math.max(0,Math.min(STAGES_NORMAL.length-1,Math.floor(Number(stage.battle?.template||1))-1));
    const base=STAGES_NORMAL[templateId]||STAGES_NORMAL[0];
    storyBattleStage={...base,
      stageName:String(stage.id),bossName:String(stage.battle?.bossName||"Story Boss"),
      bossDialogue:"Ready for battle?",midFightDialogue:"",
      bossMaxHp:Math.max(1,Math.min(999,Math.floor(Number(stage.battle?.bossHp)||20))),
      ...Object.fromEntries(['fallSpeedPxPerSec','spawnEveryMs','hitDamage'].filter(k=>typeof stage.battle?.[k]==='number'&&Number.isFinite(stage.battle[k])).map(k=>[k,stage.battle[k]])),
      bossFile:(/^story\/images\/[\w.-]+\.(?:png|webp|jpg|jpeg|svg)$/i.test(String(stage.battle?.bossSprite||""))?String(stage.battle.bossSprite):""),bossFile2:"",bgFile:(/^story\/images\/[\w.-]+\.(?:png|webp|jpg|jpeg|svg)$/i.test(String(stage.battle?.battleBackground||""))?String(stage.battle.battleBackground):""),
      // Default battle theme for all Chapter 1 stages, including existing Firestore publications.
      // An explicitly selected stage BGM always wins. Slides, other chapters and modes are unaffected.
      playBgmFile:(/^story\/audio\/[a-zA-Z0-9][\w.-]*\.(?:mp3|m4a|webm|opus|ogg|wav)$/i.test(String(stage.battle?.bgmFile||""))?String(stage.battle.bgmFile):(String(stage.id||"").startsWith("1-")?"story/audio/ch1-battle.webm":"")),
      playBgmLoop:stage.battle?.bgmLoop!==false,dialogueBgmFile:"",
      words:WORDS};
  }else storyBattleStage=null;
  // Per-stage Story Editor values take priority over inherited Game Settings.
  // Behavior remains defined by static game modules; Firestore supplies only numeric/boolean options.
  try{
    const battle=stage.battle||{};
    const overrides={...Object.fromEntries(['fallSpeedPxPerSec','spawnEveryMs','hitDamage'].filter(k=>typeof battle[k]==='number'&&Number.isFinite(battle[k])).map(k=>[k,battle[k]])),bossMaxHp:Math.max(1,Math.min(999,Math.floor(Number(battle.bossHp)||20)))};
    window.RPG_BALANCE?.setStoryOverrides?.(stage.id,overrides,battle.mechanics||{});
  }catch(error){console.warn('Story battle settings:',error)}
  // Show pictures first. The scene overlay is independent of the battle engine.
  const scenesOk = await window.RPG_STORY.showSlides(stage.intro,stage.id,'intro');
  if(!scenesOk){ window.RPG_STORY.openMap(launchStoryStage); return }
  if(!wantsBattle){
    await completeStoryStage(stage,null);
    return;
  }
  if(/^[12]-/.test(String(stage.id||''))){
    const chosen=await chooseStorySquad();
    if(!chosen){window.RPG_STORY.openMap(launchStoryStage);return;}
    storySquad.ids=chosen;
  }else storySquad.ids=[];
  setMode("story");
  showOverlay(false);
  startGame();
}
async function completeStoryStage(stage,damage=null){
  if(!stage)return;
  try{ await window.RPG_STORY.showSlides(stage.outro,stage.id,'outro'); }catch(e){console.warn(e)}
  let result=null;
  if(runLocalOnly||window.RPG_V66_DISCONNECTED||!navigator.onLine){
    try{window.RPG_LOCAL_PRACTICE?.record({mode:'story',stageId:stage.id});}catch(_){}
    const stars=damage===null?null:window.RPG_STORY.starsForDamage(damage,stage.id);
    result={stars,best:stars,firstClear:false,offline:true};
  }else{
    try{result=await window.RPG_STORY.markCompleted(stage.id,{isBattle:damage!==null,damageTaken:damage??0});}catch(e){console.warn(e)}
  }
  // Only battle clears pay. Dialogue-only Story stages never pay Guild Coins.
  if(result && !result.offline && damage!==null && !DEV_CHEATS_ENABLED && !window.RPG_V66_DISCONNECTED && guildStoryAttemptId){
    try{
      const award=await window.RPG_GUILD.claim({mode:'story',stageId:stage.id,attemptId:guildStoryAttemptId,firstClear:result.firstClear,correct:guildCorrectThisRun,incorrect:mistakes});
      result.guildCoins=award.awarded;result.guildDuplicate=!!award.duplicate;
    }catch(e){result.guildError='COINS NOT SAVED';console.warn('Story Guild Coins:',e)}
  }
  try{ await window.RPG_STORY.showResult(stage.id,result,damage??0); }catch(e){console.warn(e)}
  const completedId=stage.id;
  storySelectedStage=null;storyBattleStage=null;
  resetGame(false);
  // The newly unlocked successor becomes the selected node.
  const stages=(await window.RPG_STORY.loadManifest()).flatMap(c=>c.stages);
  const i=stages.findIndex(s=>s.id===completedId);
  const next=(i>=0&&stages[i+1])?stages[i+1].id:completedId;
  window.RPG_STORY.openMap(launchStoryStage,next);
}
function showModeSelectScreen(){
  window.RPG_V66_COMPETITIVE_ACTIVE=false;window.dispatchEvent(new Event("rpg-v66-unlock-settings"));
  rankingRequest++;

  // No Profile screen. The Adventure Card supplies the name; local game
  // progress still uses a background save record for XP and currency.
  if(!profileReady()){
    profile=profile||createDefaultProfile();
    profile.name=String(ADVENTURE_CONTEXT.name||profile.name||'Player').slice(0,16);
    profile.iconId=profile.iconId||'icon01';
    saveProfile(profile);
  }
  renderProfileHeader();
  void initializeRankIcon();

  normalCleared = loadNormalCleared();

  gameState = "modeselect";
  setInputsEnabled(false);

  showOverlay(true);
  overlay.classList.remove("defeat-active");
  if(overlayBox) overlayBox.classList.remove("defeat-card", "hearts-phase");
  overlay.classList.add("mode-select-active");
  // Play menu BGM on mode select
  stopBgm();

  if(overlayBox){
    overlayBox.classList.remove("debugSmall");
    overlayBox.classList.add("modeSelectMenu");
  }
  overlay.style.cursor = "default";

  overlayTitle.textContent = "MODE SELECT";
  overlayDesc.textContent = "";
  // Mode Select is intentionally a single column of names only.
  // Keep onboarding in the tutorial flow rather than a replay menu entry.
  overlayHint.textContent = "";

  countdownText.textContent = "";
  overlayChoices.classList.add("show");
  overlayChoices.innerHTML = "";

  const addMode = (title, {disabled=false, lockedReason='', onClick}={}) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choiceBtn student-mode-card';
    button.disabled = !!disabled;
    button.setAttribute('aria-label', disabled && lockedReason ? `${title} — ${lockedReason}` : title);
    if(disabled && lockedReason) button.title = lockedReason;
    const label = document.createElement('span');
    label.className = 'title';
    label.textContent = title;
    button.appendChild(label);
    if(!disabled && typeof onClick === 'function') button.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick();
    });
    overlayChoices.appendChild(button);
    return button;
  };

  // v86.35 — full-body operator is displayed to the LEFT of the mode menu.
  // The same owned-only IDs and passive rules used by gameplay drive this UI.
  overlayBox?.querySelector('.operator-showcase')?.remove();
  overlay.querySelector('.operator-selection-backdrop')?.remove();
  const operatorMeta=id=>{
    const rule=window.RPG_OPERATOR_PASSIVES?.RULES?.[id];
    return {id,name:id==='mc'?adventurePlayerDisplayName():(rule?.name||id.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())),
      rarity:rule?.rarity||0,passive:rule?.title||'No passive',
      description:rule?.description||'Default character · No operator passive.',
      fullArt:id==='mc'?'assets/characters/mc.webp':`assets/recruitment/${id}.webp`,
      icon:`assets/profile-icons/${id}.webp`};
  };
  const operatorImgSrc=path=>window.RPG_MEDIA?.url?.(path)||path;
  const addOperatorImg=(element,path)=>{
    element.src=operatorImgSrc(path);
    element.onerror=()=>{
      if(!element.dataset.fallback){element.dataset.fallback='1';element.src=operatorImgSrc(element.dataset.fallbackPath||'assets/characters/mc.webp');}
    };
  };
  const hero=document.createElement('section');
  hero.className='operator-showcase';
  hero.setAttribute('aria-label','Equipped operator');
  hero.innerHTML=`<div class="operator-hero-heading"><div class="operator-hero-kicker">EQUIPPED OPERATOR</div>
      <div class="operator-hero-name"></div><div class="operator-hero-rarity"></div></div>
    <button type="button" class="operator-hero-art" aria-label="Change operator"><img alt="" decoding="async"></button>
    <div class="operator-hero-footer"><div class="operator-hero-passive"></div>
      <button type="button" class="operator-hero-change">CHANGE OPERATOR <span aria-hidden="true">›</span></button></div>`;
  overlayBox?.insertBefore(hero,overlayTitle);
  const heroArt=hero.querySelector('.operator-hero-art');
  const heroImg=hero.querySelector('.operator-hero-art img');
  const heroChange=hero.querySelector('.operator-hero-change');
  let shownId=null;
  const refreshHero=()=>{
    const info=operatorMeta(getSelectedOperator());
    hero.querySelector('.operator-hero-name').textContent=info.name;
    hero.querySelector('.operator-hero-rarity').textContent=info.rarity?'★'.repeat(info.rarity):'DEFAULT';
    hero.querySelector('.operator-hero-passive').textContent=info.passive;
    if(shownId!==info.id){
      shownId=info.id;
      heroImg.classList.remove('operator-art-visible');
      heroImg.dataset.fallback='';
      addOperatorImg(heroImg,info.fullArt);
      // Reduced-motion preferences are handled in CSS.
      requestAnimationFrame(()=>heroImg.classList.add('operator-art-visible'));
    }
  };
  const openOperatorSelector=()=>{
    if(overlay.querySelector('.operator-selection-backdrop'))return;
    const ids=ownedOperatorIds();
    let pending=getSelectedOperator();
    const backdrop=document.createElement('div');
    backdrop.className='operator-selection-backdrop';
    backdrop.innerHTML=`<div class="operator-selection-dialog" role="dialog" aria-modal="true" aria-labelledby="operatorPickerTitle">
      <div class="operator-selection-header"><h3 id="operatorPickerTitle">SELECT OPERATOR</h3>
        <button type="button" class="operator-selection-close" aria-label="Close operator selection">✕</button></div>
      <div class="operator-selection-body"><div class="operator-selection-list" aria-label="Owned operators"></div>
        <div class="operator-selection-detail"><div class="operator-detail-art"><img alt="" decoding="async"></div>
          <div class="operator-detail-name"></div><div class="operator-detail-rarity"></div>
          <div class="operator-detail-passive"></div><p class="operator-detail-description"></p>
          <button type="button" class="operator-selection-equip">EQUIP OPERATOR</button></div></div></div>`;
    overlay.appendChild(backdrop);
    const list=backdrop.querySelector('.operator-selection-list');
    const detailImg=backdrop.querySelector('.operator-detail-art img');
    const equip=backdrop.querySelector('.operator-selection-equip');
    const close=()=>{
      backdrop.removeEventListener('keydown',onKey);
      backdrop.remove();
      if(overlay.classList.contains('mode-select-active'))heroChange.focus();
    };
    const onKey=event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
      if(event.key==='Tab'){
        const controls=[...backdrop.querySelectorAll('button:not([disabled])')];
        const first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    backdrop.addEventListener('keydown',onKey);
    backdrop.addEventListener('click',event=>{if(event.target===backdrop)close();});
    backdrop.querySelector('.operator-selection-close').addEventListener('click',close);
    const buttons=[];
    const updateDetail=()=>{
      const info=operatorMeta(pending);
      for(const button of buttons){
        const selected=button.dataset.operatorId===pending;
        button.classList.toggle('selected',selected);
        button.setAttribute('aria-pressed',String(selected));
      }
      detailImg.dataset.fallback='';
      addOperatorImg(detailImg,info.fullArt);
      backdrop.querySelector('.operator-detail-name').textContent=info.name;
      backdrop.querySelector('.operator-detail-rarity').textContent=info.rarity?'★'.repeat(info.rarity):'DEFAULT';
      backdrop.querySelector('.operator-detail-passive').textContent=info.passive;
      backdrop.querySelector('.operator-detail-description').textContent=info.description;
    };
    for(const id of ids){
      const info=operatorMeta(id);
      const button=document.createElement('button');
      button.className='operator-selection-item';button.type='button';button.dataset.operatorId=id;
      button.setAttribute('aria-label',`${info.name}, ${info.rarity?info.rarity+' stars':'default'}, ${info.passive}`);
      const portrait=document.createElement('img');portrait.alt='';portrait.loading='lazy';
      portrait.dataset.fallbackPath='assets/profile-icons/mc.webp';
      addOperatorImg(portrait,info.icon);
      const labels=document.createElement('span');labels.className='operator-selection-item-labels';
      const name=document.createElement('strong');name.textContent=info.name;
      const ability=document.createElement('small');ability.textContent=info.passive;
      labels.append(name,ability);button.append(portrait,labels);
      button.addEventListener('click',()=>{pending=id;updateDetail();});
      buttons.push(button);list.appendChild(button);
    }
    equip.addEventListener('click',()=>{selectOperator(pending);refreshHero();close();});
    updateDetail();
    const selected=buttons.find(b=>b.dataset.operatorId===pending);
    backdrop.querySelector('.operator-selection-close').focus();
    selected?.scrollIntoView?.({block:'nearest'});
  };
  heroArt.addEventListener('click',openOperatorSelector);
  heroChange.addEventListener('click',openOperatorSelector);
  refreshHero();

  addMode('Story Mode', {onClick:()=>{
    if(!window.RPG_STORY){pushMsg('Story unavailable.',true);return;}
    window.RPG_STORY.openMap(launchStoryStage);
  }});
  addMode('Practice', {onClick:()=>{
    setMode('practice');showOverlay(false);startGame();
  }});
  addMode('Normal Mode', {onClick:()=>{
    setMode('normal');showOverlay(false);startGame();
  }});
  addMode('Extra Mode', {disabled:!normalCleared,
    lockedReason:'Clear Normal Mode to unlock',onClick:()=>{
      setMode('extra');showOverlay(false);startGame();
    }});
  addMode('Challenge Mode', {disabled:!extraCleared||!ADVENTURE_CONTEXT.online||!!window.RPG_V66_DISCONNECTED,
    lockedReason:!extraCleared?'Clear Extra Mode to unlock':'Online Firebase required',onClick:()=>{
      setMode('challenge');showOverlay(false);startGame();
    }});
  addMode('All Grades Challenge', {disabled:!ADVENTURE_CONTEXT.online||!!window.RPG_V66_DISCONNECTED,lockedReason:'Online Firebase required',onClick:()=>{
    setMode('shared');showOverlay(false);startGame();
  }});
  addMode('Recruitment', {disabled:!ADVENTURE_CONTEXT.online||!!window.RPG_V66_DISCONNECTED,lockedReason:'Online Firebase required',onClick:()=>{
    window.location.assign('recruitment.html');
  }});
  const auraWorkshopMode=addMode('Aura Workshop', {disabled:!ADVENTURE_CONTEXT.online||!!window.RPG_V66_DISCONNECTED,
    lockedReason:'Online Firebase required',onClick:()=>{
      window.location.assign('auras.html');
    }});
  auraWorkshopMode.classList.add('aura-mode-card');
  addMode('Rankings', {disabled:!ADVENTURE_CONTEXT.online||!!window.RPG_V66_DISCONNECTED,lockedReason:'Online Firebase required',onClick:()=>{
    void openRankings('normal');
  }});
  addMode('Tournament', {disabled:true,
    lockedReason:'Scan your teacher’s tournament QR code to join'});
  if(!ADVENTURE_CONTEXT.online){
    const note=document.createElement('p');note.setAttribute('role','status');note.id='localPracticeNotice';
    note.style.cssText='font:800 12px/1.5 system-ui;background:#fff4a8;color:#1b1b1b;padding:9px 12px;margin:10px 0 0';
    note.textContent='LOCAL PRACTICE · UNRANKED · PROGRESS NOT SYNCED';
    overlayChoices.appendChild(note);
  }
  const box = overlayChoices.closest('.overlayBox');
  if(box) box.scrollTop = 0;

}
// ---- Game state ----


  // ---- Async UI flow cancellation ----
  // Prevents countdown/dialogue/etc. from resuming after Reset/Run.
  let uiFlowToken = 0;
  let uiFlowCleanups = [];
  function addUiFlowCleanup(fn){
    uiFlowCleanups.push(fn);
    return () => {
      const i = uiFlowCleanups.indexOf(fn);
      if(i >= 0) uiFlowCleanups.splice(i, 1);
    };
  }
  function cancelUiFlow(){
    uiFlowToken++;
    const toRun = uiFlowCleanups.slice();
    uiFlowCleanups.length = 0;
    for(const fn of toRun){
      try{ fn(); }catch(_){/* ignore */}
    }
    return uiFlowToken;
  }
  function isUiFlow(t){ return t === uiFlowToken; }

  let gameState = "idle";
  let stageIndex = 0;

  let bossHp = 0;
  let bossMaxHp = 0;

  // For non-Stage5 bosses: swap to phase 2 art when HP drops below half (used by Extra stages)
  let bossVariantPhase = 1;
  let baseHitDamage = 1;

  // Extra Stage 1: phase state (1 or 2)
  let ex1Phase = 1;

  let playerMaxHp = BASE_PLAYER_MAX_HP;
  let playerHp = BASE_PLAYER_MAX_HP;
  let mistakes = 0;
  let guildCorrectThisRun = 0;
  let guildStoryAttemptId = null;

  let continuesLeft = (currentMode === "practice") ? Infinity : MAX_CONTINUES;
  let continuePromptUntilMs = 0;
  let continueListeners = null;
  let pauseListeners = null;
  let pausedBgmState = null;

  // ---- Scoring ----
  // Normal and Extra have separate scores (no carryover between modes).
  // Score carries across stages within the same run/mode.
  let scoreNormal = 0;
  let scoreExtra = 0;
  let scorePractice = 0;
  let scoreChallenge = 0;
  let scoreStory = 0;
  let scoreShared = 0;
  let hiScoreShared = 0;

  let hiScoreNormal = loadHighScore("normal");
  let hiScoreExtra  = loadHighScore("extra");
  let hiScorePractice = 0; // session-only (not saved)
  let hiScoreChallenge = 0; // session-only (not saved)
  let continuesUsedThisRun = 0; // affects future points: ×(0.8^continuesUsed)
  let damageTakenThisStage = 0;
  let damageTakenThisRun = 0;

  function getActiveScore(){
    if(currentMode === "extra") return scoreExtra;
    if(currentMode === "practice") return scorePractice;
    if(currentMode === "challenge") return scoreChallenge;
    if(currentMode === "story") return scoreStory;
    if(currentMode === "shared") return scoreShared;
    return scoreNormal;
  }
  function setActiveScore(v){
    v = Math.max(0, Math.trunc(Number(v) || 0));
    if(currentMode === "extra") scoreExtra = v;
    else if(currentMode === "practice") scorePractice = v;
    else if(currentMode === "challenge") scoreChallenge = v;
    else if(currentMode === "story") scoreStory = v;
    else if(currentMode === "shared") scoreShared = v;
    else scoreNormal = v;
  }
  function getActiveHiScore(){
    if(currentMode === "extra") return hiScoreExtra;
    if(currentMode === "practice") return hiScorePractice;
    if(currentMode === "challenge") return hiScoreChallenge;
    if(currentMode === "story") return 0;
    if(currentMode === "shared") return hiScoreShared;
    return hiScoreNormal;
  }
  function setActiveHiScore(v){
    if(unverifiedRun())return;
    v = Math.max(0, Math.trunc(Number(v) || 0));
    if(currentMode === "extra"){
      hiScoreExtra = v; saveHighScore("extra", v);
    }else if(currentMode === "practice"){
      // Practice scores are session-only (do not write to localStorage)
      hiScorePractice = v;
    }else if(currentMode === "challenge"){
      hiScoreChallenge = v;
    }else if(currentMode === "shared"){
      hiScoreShared = v;
    }else if(currentMode === "story"){
      // Story scores are separate and do not affect Normal records.
    }else{
      hiScoreNormal = v; saveHighScore("normal", v);
    }
  }
  function scorePenaltyMultiplier(){
    if(currentMode === "practice") return 1;
    // 0 continues => ×1.00, 1 => ×0.80, 2 => ×0.64, 3 => ×0.512 ...
    return Math.pow(0.8, Math.max(0, continuesUsedThisRun|0));
  }

  function scoreModeMultiplier(){
    // Challenge or Extra: ×2 score
    return (currentMode === "extra") ? 2 : 1;
  }
  function resetRunScoring(){
// Reset current mode run score + penalty.
    setActiveScore(0);
    continuesUsedThisRun = 0;
    damageTakenThisRun = 0;
    damageTakenThisStage = 0;

  }
  function resetAllRunScoring(){
    scoreNormal = 0;
    scoreExtra = 0;
    scoreChallenge = 0;
    scoreStory = 0;
    scoreShared = 0;
    continuesUsedThisRun = 0;
  }
  function addScore(points){
    const p = Math.max(0, Math.trunc(Number(points) || 0));
    if(p <= 0) return;
    const ns = getActiveScore() + p;
    setActiveScore(ns);
    if(ns > getActiveHiScore()) setActiveHiScore(ns);
  
    // Coins use the same points you earn as score (persisted). Practice does not earn coins.
    try{ if(!["practice","story","shared"].includes(currentMode) && profileReady && profileReady()) addCoins(p); }catch(_){/* ignore */}
}

  function countEnglishLetters(s){
    // Count A–Z letters only (spaces/punct ignored). "the tallest" => 10
    const norm = normalizeAnswer(s || "");
    const letters = norm.replace(/[^a-z]/g, "");
    return Math.max(0, letters.length);
  }
  function basePointsForAnswer(answer){
    // Simple length-based scoring: 10 points per letter (min 10).
    const n = countEnglishLetters(answer);
    return Math.max(10, n * 10);
  }
  function fallingHeightMultiplier(y){
    // Higher on screen => more points (range ~1.2x .. 2.0x)
    const h = laneHeight();
    const maxY = Math.max(1, h - 30);
    const progress = clamp(y / maxY, 0, 1);     // 0 top, 1 bottom
    const height01 = 1 - progress;              // 1 top, 0 bottom
    return 1.2 + 0.8 * height01;                // 2.0 top, 1.2 bottom
  }
  function calcWordScore(word){
    const base = basePointsForAnswer(word?.answer || "");
    const posMult = (word?.state === "falling") ? fallingHeightMultiplier(word.y || 0) : 1.0;
    const pen = scorePenaltyMultiplier();
    const modeMult = scoreModeMultiplier();
    return Math.max(1, Math.round(base * posMult * pen * modeMult));
  }
  function calcMaximumHexWordScore(word){
    // Hex typing uses the original word's length tier at the highest normal
    // lane-position multiplier (2.0x), then existing mode/Continue modifiers.
    // Summoned words originate from the stage's shortest vocabulary entry.
    const answer=word?.chainHexOrigin?.answer||word?.answer||'';
    return Math.max(1,Math.round(basePointsForAnswer(answer)*2
      *scorePenaltyMultiplier()*scoreModeMultiplier()));
  }
  function calcMinimumWordScore(word){
    // Seraphine's automatically eliminated words use the LOW end (1.2x) of
    // the existing length-based scoring range, with normal mode/continue modifiers.
    // Example: 8 letters = 8 * 10 * 1.2 = 96 (Normal) or 192 (Extra).
    return Math.max(1, Math.round(basePointsForAnswer(word?.answer || "") * 1.2
      * scorePenaltyMultiplier() * scoreModeMultiplier()));
  }


  let wordsOnField = [];
  

  let restackDirty = false;
  function showDebugStagePicker(){
  const prevState = gameState;
  const wasPlaying = (prevState === "playing");

  if(wasPlaying){
    pauseStageClock();
    showStage5Timer(false);
  }

  gameState = "debugselect";
  setInputsEnabled(false);

  showOverlay(true);
  overlay.style.cursor = "default";
  if(overlayBox) overlayBox.classList.add("debugSmall");

  overlayTitle.textContent = "DEBUG";
  overlayDesc.textContent = "";
  overlayHint.textContent = "";
  countdownText.textContent = "";

  overlayChoices.classList.add("show");
  overlayChoices.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "debugGrid";
  overlayChoices.appendChild(grid);

  const cleanup = () => {
    overlayChoices.innerHTML = "";
    overlayChoices.classList.remove("show");
    if(overlayBox) overlayBox.classList.remove("debugSmall");
    overlay.removeEventListener("click", onOverlayClick);
    window.removeEventListener("keydown", onKeyDown);
  };

  const exitBack = () => {
    cleanup();
    if(wasPlaying){
      showOverlay(false);
      gameState = "playing";
      setInputsEnabled(true);
      resumeStageClock();
      updateUI();
    }else{
      showModeSelectScreen();
    }
  };

  const onOverlayClick = (e) => {
    if(e.target === overlay) exitBack();
  };

  const onKeyDown = (e) => {
    if(e.key === "Escape") exitBack();
  };

  overlay.addEventListener("click", onOverlayClick);
  window.addEventListener("keydown", onKeyDown);

  const jumpTo = (mode, idx) => {
    cleanup();
    // startStage handles its own overlay / countdown
    setMode(mode);
    startStage(idx);
  };

  const addBtn = (label, mode, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "debugStageBtn";
    btn.textContent = label;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      jumpTo(mode, idx);
    });
    grid.appendChild(btn);
  };

  // Buttons: Normal 1-5, Extra 1-2
  for(let i=0;i<STAGES_NORMAL.length;i++){
    addBtn(`N${i+1}`, "normal", i);
  }
  for(let i=0;i<STAGES_EXTRA.length;i++){
    addBtn(`EX${i+1}`, "extra", i);
  }
  for(let i=0;i<STAGES_CHALLENGE.length;i++){
    addBtn(`C${i+1}`, "challenge", i);
  }
}

async function debugJumpTo(mode, idx){
  cleanupContinueListeners();
  setMode(mode);
  resetAllRunScoring();

  // Reset run state (similar to startGame)
  resetField();
  hideBossBubble();
  showStage5Timer(false);

  stageIndex = clamp(idx, 0, Math.max(0, STAGES.length - 1));
  mistakes = 0;
  continuesLeft = (currentMode === "practice") ? Infinity : MAX_CONTINUES;
  playerMaxHp = BASE_PLAYER_MAX_HP;
  playerHp = playerMaxHp;

  resumeStageClock();
  showOverlay(false);
  await startStage(idx);
}


  // v114 — Chapters 1 and 2 only. The three existing lives are three operators.
  // This is isolated from the normal/extra/practice/tournament battle rules.
  const storySquad={ids:[],index:0,knockedOut:[],enabled:false};
  let storySquadSwitchTimer=null;
  let storySquadGraceUntil=0;
  const storyThreeLifeStage=()=>currentMode==='story'&&/^[12]-/.test(String(storySelectedStage?.id||''));
  const storySquadVisual=document.getElementById('storySquadVisual');
  const storySquadArt=document.getElementById('storySquadArt');
  const storySquadRoster=document.getElementById('storySquadRoster');
  const storySquadName=document.getElementById('storySquadHeroName');
  const storySquadCount=document.getElementById('storySquadCount');
  const storySquadDeploy=document.getElementById('storySquadDeploy');
  const storyActiveLabel=document.getElementById('storyActiveLabel');
  const storyBossHpRow=document.getElementById('storyBossHpRow');
  const storyEnemySlot=document.getElementById('storyEnemySlot');
  const storyStatusList=document.querySelector('#storyStatusPanel .statusList');
  const storyBgmRow=document.querySelector('#storyStatusPanel .bgmRow');
  const storyContinuesLine=document.getElementById('storyContinuesLine');
  const storyOperatorName=id=>id==='mc'?adventurePlayerDisplayName():String(window.RPG_OPERATOR_PASSIVES?.RULES?.[id]?.name||id).replace(/_/g,' ');
  const storyArtUrl=id=>window.RPG_MEDIA?.url?.(id==='mc'?'assets/characters/mc.webp':`assets/recruitment/${id}.webp`)|| (id==='mc'?'assets/characters/mc.webp':`assets/recruitment/${id}.webp`);
  const storyIconUrl=id=>window.RPG_MEDIA?.url?.(`assets/profile-icons/${id}.webp`)||`assets/profile-icons/${id}.webp`;
  // v119: smaller pre-framed lineup art, independently cropped from the originals.
  // Original recruitment art and boss sprites remain untouched.
  const storyDeploymentArtUrl=id=>window.RPG_MEDIA?.url?.(`assets/deployment/${id}.webp`)||`assets/deployment/${id}.webp`;
  function clearStorySquadSwitch(){
    if(storySquadSwitchTimer!==null){clearTimeout(storySquadSwitchTimer);storySquadSwitchTimer=null;}
    storySquadDeploy?.classList.remove('show');
    storySquadGraceUntil=0;
  }
  function renderStorySquad(){
    const on=storySquad.enabled&&storyThreeLifeStage();
    // Keep the arena in the proper three-column Story layout after any
    // overlay, async stage preload, or operator switch.
    document.body.classList.toggle('story-squad-layout',on);
    if(storySquadVisual)storySquadVisual.hidden=!on;
    if(storyContinuesLine)storyContinuesLine.hidden=on;
    if(storyActiveLabel)storyActiveLabel.textContent=on?` · ${storyOperatorName(activeOperatorId)}`:'';
    if(!on){
      if(storyBossHpRow&&storyStatusList&&storyBossHpRow.parentElement!==storyStatusList)storyStatusList.prepend(storyBossHpRow);
      if(storyBgmRow&&storyStatusList&&storyBgmRow.parentElement!==storyStatusList)storyStatusList.append(storyBgmRow);
      return;
    }
    if(storyBossHpRow&&storyEnemySlot&&storyBossHpRow.parentElement!==storyEnemySlot)storyEnemySlot.append(storyBossHpRow);
    if(storyBgmRow&&storyEnemySlot&&storyBgmRow.parentElement!==storyEnemySlot)storyEnemySlot.append(storyBgmRow);
    if(storySquadArt){
      const src=storyArtUrl(activeOperatorId);
      if(storySquadArt.dataset.src!==src){storySquadArt.dataset.src=src;storySquadArt.src=src;}
      storySquadArt.onerror=()=>{if(!storySquadArt.src.endsWith('mc.webp'))storySquadArt.src='assets/characters/mc.webp';};
      storySquadArt.alt=storyOperatorName(activeOperatorId);
    }
    if(storySquadName)storySquadName.textContent=storyOperatorName(activeOperatorId);
    if(storySquadCount)storySquadCount.textContent=`${Math.max(0,storySquad.ids.length-storySquad.knockedOut.length)}/${storySquad.ids.length}`;
    if(storySquadRoster){
      storySquadRoster.replaceChildren();
      storySquad.ids.forEach((id,i)=>{
        const cell=document.createElement('div');
        cell.className='storySquadCell'+(storySquad.knockedOut.includes(i)?' ko':i===storySquad.index?' active':'');
        const portrait=document.createElement('img');portrait.alt='';portrait.src=storyIconUrl(id);
        portrait.onerror=()=>{portrait.onerror=null;portrait.src='assets/profile-icons/mc.webp';};
        const name=document.createElement('span');name.textContent=storyOperatorName(id);
        const state=document.createElement('small');state.textContent=storySquad.knockedOut.includes(i)?'KO':i===storySquad.index?'ACTIVE':'NEXT';
        cell.append(portrait,name,state);storySquadRoster.appendChild(cell);
      });
    }
  }
  function stopStorySquad(){
    clearStorySquadSwitch();storySquad.enabled=false;storySquad.ids=[];storySquad.index=0;storySquad.knockedOut=[];
    document.body.classList.remove('story-squad-layout');renderStorySquad();
  }
  async function chooseStorySquad(){
    // v117: cinematic party setup inspired by character-lineup RPGs.
    // Selection is restricted to genuinely owned operators plus the same three starter trials.
    const owned=ownedOperatorIds();
    const available=[...new Set(owned)];
    for(const id of ['alden','livia','kade']){
      if(available.length<3&&window.RPG_OPERATOR_PASSIVES?.RULES?.[id]&&!available.includes(id))available.push(id);
    }
    if(available.length<3)return null;
    return await new Promise(resolve=>{
      // The squad picker is a dedicated pre-battle screen, not a child of
      // the gameplay overlay. This removes its clipping/height dependency.
      const selectScreen=document.getElementById('storySquadSelectScreen');
      const selectMount=document.getElementById('storySquadSelectMount');
      if(!selectScreen||!selectMount){resolve(null);return;}
      showOverlay(false);
      selectMount.replaceChildren();
      selectScreen.hidden=false;
      selectScreen.setAttribute('aria-hidden','false');
      document.body.classList.add('story-squad-picker-open');
      const make=(tag,cls,text)=>{
        const el=document.createElement(tag);
        if(cls)el.className=cls;
        if(text!==undefined)el.textContent=text;
        return el;
      };
      const roster=available.map(id=>({
        id,name:storyOperatorName(id),
        rarity:Number(window.RPG_OPERATOR_PASSIVES?.RULES?.[id]?.rarity||4),
        trial:!owned.includes(id)
      })).sort((a,b)=>Number(a.trial)-Number(b.trial)||b.rarity-a.rarity||a.name.localeCompare(b.name));
      // Start with all three slots empty: selections must be made 1 -> 2 -> 3.
      let selected=[];
      let activeSlot=0;
      let lockedCount=0; // number of confirmed operators; only the next slot can be edited
      let rarityFilter='all';
      let search='';
      let done=false;
      const wrap=make('div','storySquadPicker');
      const stage=make('section','storySquadPickerStage');
      const heading=make('div','storySquadPickerLegend');
      const countText=make('span','storySquadSubhead','0 / 3 SELECTED');
      heading.append(make('span','storySquadEyebrow','DEPLOYMENT ORDER'),countText);
      const lineup=make('div','storySquadStages');
      lineup.setAttribute('role','group');
      lineup.setAttribute('aria-label','Three operator lives in deployment order');
      const cards=[];
      for(let i=0;i<3;i++){
        const holder=make('div','storySquadStage');
        const card=make('button','storySquadSlot');
        card.type='button';
        const number=make('span','storySquadSlotNumber',String(i+1).padStart(2,'0'));
        const image=make('img','storySquadSlotArt');
        image.alt='';image.decoding='async';
        const label=make('div','storySquadSlotLabel');
        const stars=make('span','storySquadSlotStars');
        const name=make('strong','storySquadSlotName');
        const state=make('span','storySquadSlotState',i===0?'FIRST':'RESERVE');
        label.append(stars,name,state);
        card.append(number,image,label);
        card.addEventListener('click',()=>{if(i!==lockedCount)return;activeSlot=i;message.textContent='';render();});
        const slotAction=make('div','storySquadSlotAction');
        holder.append(card,slotAction);
        lineup.appendChild(holder);
        cards.push({holder,card,image,name,stars,state,slotAction});
      }
      const ready=make('button','storySquadAction primary storySquadReadyBtn','READY');ready.type='button';
      stage.append(heading,lineup);

      const side=make('aside','storySquadPickerRoster');
      const sideHeading=make('div','storySquadRosterHeading');
      const sideTitle=make('strong','','OPERATORS');
      sideHeading.append(sideTitle);
      const searchBox=make('input','storySquadSearch');
      searchBox.type='search';searchBox.placeholder='Search operators';searchBox.setAttribute('aria-label','Search available operators');
      searchBox.autocomplete='off';searchBox.spellcheck=false;
      const filters=make('div','storySquadFilters');
      const filterButtons=[];
      for(const [value,title] of [['all','ALL'],['6','6★'],['5','5★'],['4','4★']]){
        const btn=make('button','storySquadFilter',title);
        btn.type='button';btn.addEventListener('click',()=>{rarityFilter=value;renderRoster();});
        filters.appendChild(btn);filterButtons.push({btn,value});
      }
      const rosterList=make('div','storySquadPickerList');
      rosterList.setAttribute('role','group');rosterList.setAttribute('aria-label','Available operators');
      const message=make('div','storySquadPickerError');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
      side.append(sideHeading,searchBox,filters,rosterList);
      const footer=make('div','storySquadPickerActions');
      const cancel=make('button','storySquadAction secondary','BACK');cancel.type='button';
      const reset=make('button','storySquadAction secondary','RESET');reset.type='button';
      footer.append(message,reset,cancel);
      wrap.append(stage,side,footer);selectMount.appendChild(wrap);

      function renderRoster(){
        filterButtons.forEach(({btn,value})=>{btn.classList.toggle('active',value===rarityFilter);btn.setAttribute('aria-pressed',String(value===rarityFilter));});
        const filtered=roster.filter(o=>(rarityFilter==='all'||String(o.rarity)===rarityFilter)&&o.name.toLowerCase().includes(search.toLowerCase().trim()));
        rosterList.replaceChildren();
        if(!filtered.length)rosterList.append(make('p','storySquadRosterEmpty','No matching operators.'));
        for(const op of filtered){
          const card=make('button','storySquadRosterCard');card.type='button';
          const pos=selected.indexOf(op.id);
          card.classList.toggle('inSquad',pos!==-1);
          card.classList.toggle('highlighted',selected[activeSlot]===op.id);
          card.setAttribute('aria-label',`${op.name}, ${op.rarity} stars${op.trial?', trial':''}${pos>=0?', deployed as '+(pos+1):''}`);
          // Existing square headshot assets have consistent focal framing.
          // Do not squeeze the tall full-body deployment crops into square roster cards.
          const pic=make('img','');pic.alt='';pic.loading='lazy';pic.src=storyIconUrl(op.id);
          pic.onerror=()=>{pic.onerror=null;pic.src='assets/profile-icons/mc.webp';};
          const details=make('span','storySquadRosterName',op.name);
          const status=make('span','storySquadRosterBadge',pos>=0?String(pos+1):op.trial?'TRIAL':`${op.rarity}★`);
          card.append(pic,details,status);
          card.addEventListener('click',()=>{
            if(lockedCount>2)return;
            const occupied=selected.indexOf(op.id);
            if(occupied>=0 && occupied!==lockedCount){
              message.textContent='Already selected.';return;
            }
            // A choice only previews the operator in the current slot.
            // READY is the explicit lock-in; the next slot stays empty until then.
            selected[lockedCount]=op.id;
            activeSlot=lockedCount;
            message.textContent='';render();
          });
          rosterList.appendChild(card);
        }
      }
      function render(){
        cards.forEach(({holder,card,image,name,stars,state,slotAction},i)=>{
          const id=selected[i],op=roster.find(o=>o.id===id);
          const confirmed=i<lockedCount;
          const locked=i!==lockedCount;
          holder.classList.toggle('selected',i===lockedCount);
          holder.classList.toggle('confirmed',confirmed);
          holder.classList.toggle('empty',!id);
          holder.classList.toggle('locked',locked && !confirmed);
          card.disabled=locked;
          card.setAttribute('aria-pressed',String(i===activeSlot));
          card.setAttribute('aria-label',`Life ${i+1}: ${op?.name||'Empty'}${locked?', select previous operator first':i===activeSlot?', selected':''}`);
          if(id){
            // Cropped lineup art centers faces and upper bodies even on wide 6-star illustrations.
            const art=storyDeploymentArtUrl(id)||storyArtUrl(id);
            image.hidden=false;
            if(image.dataset.src!==art){
              image.dataset.src=art;image.src=art;
              image.onerror=()=>{image.onerror=null;image.src=storyArtUrl(id);};
            }
          }else{
            image.hidden=true;image.removeAttribute('src');delete image.dataset.src;image.onerror=null;
          }
          name.textContent=op?.name||(locked?'LOCKED':`SELECT ${['FIRST','SECOND','THIRD'][i]}`);
          stars.textContent=op?'★'.repeat(op.rarity):'';
          state.textContent=confirmed?'LOCKED IN':op?(op.trial?'TRIAL':'SELECTED'):(locked?'':'PICK AN OPERATOR');
          // There is only one READY button. It physically moves under the current slot.
          slotAction.replaceChildren();
          if(i===lockedCount)slotAction.appendChild(ready);
        });
        countText.textContent=`${lockedCount} / 3 LOCKED IN`;
        ready.disabled=!selected[lockedCount];
        renderRoster();
      }
      searchBox.addEventListener('input',()=>{search=searchBox.value;renderRoster();});
      const finish=result=>{
        if(done)return;
        done=true;
        window.removeEventListener('keydown',keys);
        selectMount.replaceChildren();
        selectScreen.hidden=true;
        selectScreen.setAttribute('aria-hidden','true');
        document.body.classList.remove('story-squad-picker-open');
        resolve(result);
      };
      const keys=e=>{if(e.key==='Escape'){e.preventDefault();finish(null);}};
      window.addEventListener('keydown',keys);
      cancel.addEventListener('click',()=>finish(null));
      reset.addEventListener('click',()=>{
        selected=[];lockedCount=0;activeSlot=0;message.textContent='';render();
        cards[0].card.focus();
      });
      ready.addEventListener('click',()=>{
        if(!selected[lockedCount])return;
        const chosen=selected[lockedCount];
        if(selected.slice(0,lockedCount).includes(chosen)){
          message.textContent='Already selected.';return;
        }
        lockedCount++;
        if(lockedCount===3){
          finish(selected.slice());return;
        }
        activeSlot=lockedCount;
        message.textContent='';render();
        cards[lockedCount].card.focus();
      });
      render();cards[0].card.focus();
    });
  }
  function swapToNextStoryOperator(){
    if(!storySquad.enabled||gameState!=='playing')return false;
    storySquad.knockedOut.push(storySquad.index);
    const next=storySquad.index+1;
    if(next>=storySquad.ids.length){renderStorySquad();return false;}
    storySquad.index=next;
    gameState='squad-deploy';setInputsEnabled(false);answerInput.value='';
    pauseStageClock();setSleepyBgmGain(1);
    resetOperatorForStage(); // Safely remove old operator marks; retain normal falling words and boss HP.
    renderStorySquad();
    if(storySquadDeploy){storySquadDeploy.textContent=`${storyOperatorName(storySquad.ids[next])} DEPLOYING`;storySquadDeploy.classList.add('show');}
    storySquadSwitchTimer=setTimeout(()=>{
      storySquadSwitchTimer=null;
      if(!storySquad.enabled||gameState!=='squad-deploy'||currentMode!=='story')return;
      activeOperatorId=storySquad.ids[next];
      operatorPassive=window.RPG_OPERATOR_PASSIVES?.create(activeOperatorId,currentMode)||null;
      playerMaxHp=BASE_PLAYER_MAX_HP+(operatorPassive?.getMaxHpBonus?.()||0);
      playerHp=playerMaxHp;
      // Grant a short grace window, without resetting or deleting the falling words.
      resumeStageClock();storySquadGraceUntil=stageElapsedSec()+2;
      window.RPG_CH1_SPECIAL?.start(currentMode,storySelectedStage?.id||'',stageElapsedSec());
      const stageEffect=operatorPassive?.onStageStart?.(playerHp,stageElapsedSec(),wordsOnField);
      if(stageEffect?.type==='fletcher-last-stand')renderFletcherStatus(stageElapsedSec());
      gameState='playing';setInputsEnabled(true);renderStorySquad();renderProfileHeader();
      storySquadDeploy?.classList.remove('show');
      uiCache.playerHpStr=null;uiCache.nitrateVisible=null;uiCache.nitrateShield=null;
      updateUI();answerInput.focus();
    },1600);
    return true;
  }
  // v86.31 — choose an owned operator for this run; passive effects reset each stage.
  const operatorModeEligible=()=>['normal','extra','practice','story','challenge','shared'].includes(currentMode);
  const ownedOperatorIds=()=>{
    const data=window.ADVENTURE_PLAYER?.recruitment?.owned||{};
    const safe=Object.keys(data).filter(id=>/^[a-z][a-z0-9_]{0,39}$/.test(id)&&!['mc','crimson_knight','silver_knight'].includes(id));
    return ['mc',...safe.sort()];
  };
  let selectedOperatorId=null;
  let activeOperatorId='mc';
  let operatorPassive=null;
  let lastFletcherPhase='off';
  const nitrateShieldEl=document.getElementById('nitrateShield');
  const nitrateShieldSegments=Array.from(nitrateShieldEl?.querySelectorAll('.nitrate-shield-segment')||[]);
  let fletcherStatusEl=null;
  let fletcherStatusLastText='';
  // Chain Cleave owns only the temporary hex visuals/word replacements.
  // Its activation clock is in operator-passives and is pause-aware.
  let chainHexEntry=null,chainHexStatusEl=null,chainHexStatusText='';
  function hexWord(word, summoned=false){
    if(!chainHexEntry||!word||word.chainHexed||word.foxfireHidden||word.ex2Hacked||word.ex3ExpiredGhost||word.s5Permafrost)return false;
    if(word.state!=='falling'&&word.state!=='landed')return false;
    word.chainHexOrigin={prompt:word.prompt,answer:word.answer,answerNorm:word.answerNorm,
      shownPrompt:word.promptEl?.textContent??word.prompt,
      shownAnswer:word.answerEl?.textContent??word.answer,
      shownTag:word.tagEl?.textContent??''};
    word.chainHexed=true;word.chainHexSummoned=!!summoned;
    word.prompt=chainHexEntry.prompt;word.answer=chainHexEntry.answer;
    word.answerNorm=normalizeAnswer(word.answer);
    if(word.promptEl)word.promptEl.textContent=word.prompt;
    if(word.answerEl)word.answerEl.textContent=word.answer;
    if(word.tagEl)word.tagEl.textContent='☾';
    word.el?.classList?.add('operator-chain-hex');
    return true;
  }
  function clearChainCleaveHex(){
    let removed=false;
    for(const word of [...wordsOnField]){
      if(word.chainHexSummoned){removeWord(word.id);removed=true;continue;}
      const original=word.chainHexOrigin;
      if(!original)continue;
      word.prompt=original.prompt;word.answer=original.answer;word.answerNorm=original.answerNorm;
      if(word.promptEl)word.promptEl.textContent=original.shownPrompt;
      if(word.answerEl)word.answerEl.textContent=original.shownAnswer;
      if(word.tagEl)word.tagEl.textContent=original.shownTag;
      delete word.chainHexed;delete word.chainHexOrigin;delete word.chainHexSummoned;
      word.el?.classList?.remove('operator-chain-hex');
    }
    if(removed){restackDirty=true;restackLanded();}
    chainHexEntry=null;
    chainHexStatusEl?.remove();chainHexStatusEl=null;chainHexStatusText='';
  }
  function syncChainCleaveHex(time){
    if(!chainHexEntry)return;
    if(!operatorPassive?.isChainCleaveActive(time)){
      clearChainCleaveHex();
      pushMsg('CHAIN CLEAVE · HEX ENDED',true);
      return;
    }
    if(!chainHexStatusEl||!chainHexStatusEl.isConnected){
      chainHexStatusEl=document.createElement('div');
      chainHexStatusEl.className='operator-chain-hex-status';
      chainHexStatusEl.setAttribute('aria-live','off');
      wordLane?.appendChild(chainHexStatusEl);
      chainHexStatusText='';
    }
    const remaining=operatorPassive.getChainCleaveRemaining(time);
    const label=`CHAIN CLEAVE · ${remaining.toFixed(1)}s`;
    if(label!==chainHexStatusText){chainHexStatusText=label;chainHexStatusEl.textContent=label;}
  }
  function startChainCleaveHex(effect){
    // The combo-triggering word was already removed. Only words still on
    // the field at activation are eligible for the 2-or-fewer condition.
    chainHexEntry=operatorShortestStageEntry();
    if(!chainHexEntry)return;
    const currentlyTypeable=wordsOnField.filter(w=>
      (w.state==='falling'||w.state==='landed')&&!w.foxfireHidden&&!w.ex2Hacked&&!w.ex3ExpiredGhost&&!w.s5Permafrost);
    for(const word of currentlyTypeable)hexWord(word);
    if(currentlyTypeable.length<=effect.maxExisting){
      // Four extra words are deliberately NOT normal timed spawns. They
      // have no stage-mechanic spawn hooks and are removed when the hex ends.
      for(let i=0;i<effect.extraWords;i++){
        const word=spawnOneWord({forceOperatorSpawn:true,operatorHexSummoned:true,
          state:'falling',y:-30-i*32,countSpawn:false,skipMechanicHooks:true,
          preventEx4Infection:true,prompt:chainHexEntry.prompt,answer:chainHexEntry.answer});
        if(word)hexWord(word,true);
      }
    }
    syncChainCleaveHex(stageElapsedSec());
    pushMsg('CHAIN CLEAVE · 4s HEX',true);
  }
  // v102: Foxfire rewinds visually while the model remains safely at the top.
  const FOXFIRE_REWIND_MS=580;
  let foxfireRewindTimer=null,foxfireRewindTicket=0;
  function cancelFoxfireRewind(){
    foxfireRewindTicket++;
    if(foxfireRewindTimer!==null){clearTimeout(foxfireRewindTimer);foxfireRewindTimer=null;}
    for(const word of wordsOnField){
      word.el?.classList?.remove('operator-foxfire-rewinding');
      word.el?.style?.removeProperty?.('--tavi-rewind-distance');
    }
    wordLane?.classList?.remove('operator-foxfire-rewinding');
  }
  function equippedOperatorIconSrc(){
    const id=getSelectedOperator();
    if(storySquad.enabled&&storyThreeLifeStage())return `assets/profile-icons/${activeOperatorId}.webp`;
    return `assets/profile-icons/${id}.webp`;
  }
  function getSelectedOperator(){
    const roster=ownedOperatorIds();
    if(!roster.includes(selectedOperatorId)){
      let saved='';
      try{saved=localStorage.getItem(adventureKey('selectedOperator'))||'';}catch(_){}
      const featured=window.ADVENTURE_PLAYER?.selected_character;
      selectedOperatorId=roster.includes(saved)?saved:roster.includes(featured)?featured:'mc';
    }
    return selectedOperatorId;
  }
  function selectOperator(id){
    selectedOperatorId=ownedOperatorIds().includes(id)?id:'mc';
    try{localStorage.setItem(adventureKey('selectedOperator'),selectedOperatorId);}catch(_){}
    // Immediately refresh both the in-game HUD and the Adventure intro portrait.
    renderProfileHeader();
  }
  function prepareOperatorForRun(){
    clearStorySquadSwitch();
    storySquad.enabled=storyThreeLifeStage()&&storySquad.ids.length===3;
    storySquad.index=0;storySquad.knockedOut=[];
    activeOperatorId=storySquad.enabled?storySquad.ids[0]:(operatorModeEligible()?getSelectedOperator():'mc');
    operatorPassive=window.RPG_OPERATOR_PASSIVES?.create(activeOperatorId,currentMode)||null;
    renderStorySquad();
  }
  // Keeps one unobtrusive visible 3-second countdown inside the word lane.
  function renderFletcherStatus(time){
    const phase=operatorPassive?.getAdrenalinePhase?.(time)||'off';
    if(phase==='off'){
      fletcherStatusEl?.remove();fletcherStatusEl=null;fletcherStatusLastText='';
      wordLane?.classList?.remove('operator-fletcher-last-stand','operator-fletcher-overdrive');
      return;
    }
    wordLane?.classList?.toggle('operator-fletcher-last-stand',phase==='last-stand');
    wordLane?.classList?.toggle('operator-fletcher-overdrive',phase==='overdrive');
    if(!fletcherStatusEl||!fletcherStatusEl.isConnected){
      fletcherStatusEl=document.createElement('div');
      fletcherStatusEl.className='operator-fletcher-status';
      fletcherStatusEl.setAttribute('role','timer');
      fletcherStatusEl.setAttribute('aria-live','off');
      wordLane?.appendChild(fletcherStatusEl);
      fletcherStatusLastText='';
    }
    const fletcherState=operatorPassive?.debug?.()||{};
    const until=fletcherState.adrenalineLastStandUntil||0;
    const text=phase==='last-stand'
      ?`LAST STAND · ${Math.max(0,until-time).toFixed(1)}s`
      :fletcherState.adrenalineMomentumUnlocked
        ?'ADRENALINE MOMENTUM · +1 DMG'
        :`OVERDRIVE · ${Math.min(3,fletcherState.adrenalineMomentumStreak||0)}/3 WORDS`;
    if(text!==fletcherStatusLastText){fletcherStatusEl.textContent=text;fletcherStatusLastText=text;}
  }
  function resetOperatorForStage(){
    clearChainCleaveHex();
    cancelFoxfireRewind();
    operatorPassive?.reset();
    lastFletcherPhase='off';
    fletcherStatusEl?.remove();fletcherStatusEl=null;fletcherStatusLastText='';
    for(const word of wordsOnField){
      word.el?.classList?.remove('operator-crossbow-bullseye','operator-crossbow-adrenaline');
    }
    bossHpText?.classList?.remove('operator-weak-point-ready');
    wordLane?.classList?.remove('operator-frozen-domain','operator-foxfire-active','operator-sovereign-guard','operator-fletcher-last-stand','operator-fletcher-overdrive','operator-nitrate-ready');
    uiCache.nitrateShield=null;uiCache.nitrateVisible=null;
    operatorClearLupaVisuals();
  }
  function operatorStageWithoutBoss(){
    // Survival/time trials have a visible boss HP bar but no boss to defeat.
    const stage=STAGES[stageIndex];
    return ['challenge','shared','practice'].includes(currentMode)
      || !!stage?.bossInvulnerable || !!stage?.endStageOnBgmEnd || isExtraStage2();
  }

  function operatorStageWordEntries(){
    const stage=STAGES[stageIndex];
    const list=(stage&&stage.words)?stage.words:[];
    const valid=[];
    for(const w of list){
      if(!w)continue;
      const prompt=String(w.prompt??'').trim();
      const answer=String(w.answer??'').trim();
      if(!prompt||!answer)continue;
      valid.push({prompt,answer});
    }
    return valid;
  }
  function operatorShortestStageEntry(){
    const valid=operatorStageWordEntries();
    return valid.reduce((best,w)=>!best||countEnglishLetters(w.answer)<countEnglishLetters(best.answer)?w:best,null);
  }
  function operatorLongestStageEntry(exclude=new Set()){
    const valid=operatorStageWordEntries().filter(entry=>!exclude.has(normalizeAnswer(entry.answer)));
    if(!valid.length)return null;
    const maxLen=Math.max(...valid.map(entry=>countEnglishLetters(entry.answer)));
    const longest=valid.filter(entry=>countEnglishLetters(entry.answer)===maxLen);
    return longest[Math.floor(Math.random()*longest.length)]||valid[0]||null;
  }
  function operatorRandomStageEntry(exclude=new Set()){
    const valid=operatorStageWordEntries().filter(entry=>!exclude.has(normalizeAnswer(entry.answer)));
    if(!valid.length)return null;
    return valid[Math.floor(Math.random()*valid.length)]||valid[0]||null;
  }
  // Moonlit Ambush uses ONE stable countdown: all three Weak Points share the
  // same deadline. Avoid changing a CSS pseudo-element on every animation frame.
  let lupaTimerEl=null;
  let lupaTimerValueEl=null;
  let lupaTimerLastText='';
  function operatorLupaTimer(seconds){
    if(!wordLane)return;
    if(!lupaTimerEl||!lupaTimerEl.isConnected){
      lupaTimerEl=document.createElement('div');
      lupaTimerEl.className='operator-lupa-timer';
      lupaTimerEl.setAttribute('role','timer');
      lupaTimerEl.setAttribute('aria-label','Moonlit Ambush seconds remaining');
      lupaTimerEl.setAttribute('aria-live','off');
      const title=document.createElement('span');
      title.className='operator-lupa-timer-title';
      title.textContent='MOONLIT AMBUSH';
      lupaTimerValueEl=document.createElement('span');
      lupaTimerValueEl.className='operator-lupa-timer-value';
      lupaTimerEl.append(title,lupaTimerValueEl);
      wordLane.appendChild(lupaTimerEl);
      lupaTimerLastText='';
    }
    const display=Math.max(0,Math.ceil(Math.max(0,seconds)*10)/10).toFixed(1)+'s';
    if(display!==lupaTimerLastText){
      lupaTimerValueEl.textContent=display;
      lupaTimerLastText=display;
    }
  }
  function operatorClearLupaVisuals(){
    document.body.classList.remove('operator-lupa-focus');
    wordLane?.classList?.remove('operator-lupa-focus');
    lupaTimerEl?.remove();
    lupaTimerEl=null;lupaTimerValueEl=null;lupaTimerLastText='';
    for(const word of wordsOnField){
      word?.el?.classList?.remove('operator-lupa-weakpoint');
      word?.el?.removeAttribute?.('data-lupa-time');
    }
  }
  function operatorApplyLupaVisuals(wordIds,seconds){
    operatorClearLupaVisuals();
    const ids=new Set(Array.isArray(wordIds)?wordIds:[]);
    if(!ids.size)return;
    document.body.classList.add('operator-lupa-focus');
    wordLane?.classList?.add('operator-lupa-focus');
    for(const word of wordsOnField){
      if(ids.has(word.id))word.el?.classList?.add('operator-lupa-weakpoint');
    }
    operatorLupaTimer(seconds);
  }
  function operatorRefreshLupaVisuals(time=stageElapsedSec()){
    if(operatorPassive?.rule?.id!=='lupa')return;
    const debug=operatorPassive.debug?.();
    if(!debug?.lupaActive){
      if(document.body.classList.contains('operator-lupa-focus'))operatorClearLupaVisuals();
      return;
    }
    const ids=new Set(debug.lupaTargets||[]);
    if(!ids.size){operatorClearLupaVisuals();return;}
    if(!document.body.classList.contains('operator-lupa-focus'))document.body.classList.add('operator-lupa-focus');
    if(!wordLane?.classList?.contains('operator-lupa-focus'))wordLane?.classList?.add('operator-lupa-focus');
    // Update the single, large number only when its visible tenth changes.
    operatorLupaTimer((debug.lupaDeadline||0)-time);
    for(const word of wordsOnField){
      const active=ids.has(word.id);
      if(word.el?.classList?.contains('operator-lupa-weakpoint')!==active){
        word.el?.classList?.toggle('operator-lupa-weakpoint',active);
      }
    }
  }
  function operatorPrepareLupaTargets(){
    const chosen=landedWords().sort((a,b)=>b.y-a.y).slice(0,3);
    const need=Math.max(0,3-chosen.length);
    if(!need)return chosen;
    const exclude=new Set(wordsOnField.map(w=>normalizeAnswer(w.answer)));
    const spawned=[];
    for(let i=0;i<need;i++){
      let pick=null;
      if(i===0)pick=operatorLongestStageEntry(exclude);
      if(!pick)pick=operatorRandomStageEntry(exclude);
      if(!pick)break;
      exclude.add(normalizeAnswer(pick.answer));
      const word=spawnOneWord({state:'landed',countSpawn:false,prompt:pick.prompt,answer:pick.answer,skipMechanicHooks:true});
      if(word)spawned.push(word);
    }
    if(spawned.length){restackDirty=true;restackLanded();}
    return chosen.concat(spawned).slice(0,3);
  }
  function operatorStartLupa(){
    const targets=operatorPrepareLupaTargets();
    const effect=operatorPassive?.startLupa?.(targets.map(w=>w.id),stageElapsedSec());
    if(effect)applyOperatorFieldEffect(effect);
    return effect;
  }
  function operatorOnCorrect(clearedWord){
    if(!operatorPassive?.rule)return null;
    const effect=operatorPassive.onCorrect(wordsOnField,stageElapsedSec(),{
      hp:playerHp,maxHp:playerMaxHp,clearedWord,nonBoss:operatorStageWithoutBoss()
    });
    if(!effect)return null;
    if(effect.momentumUnlocked)pushMsg('FLETCHER · ADRENALINE MOMENTUM (+1 DAMAGE UNLOCKED)',true);
    if(effect.type==='word-freeze')pushMsg('NORA · SHADOW HOLD (1.5s)',true);
    else if(effect.type==='spawn-pause'){
      // Discard prior spawn progress: this is a pause, not a delayed burst.
      spawnAccMs=0;
      pushMsg('MIRA · BREATHING ROOM (2s)',true);
    }else if(effect.type==='slowdown'){
      pushMsg('ELISE · QUICK RECOVERY (3s)',true);
    }else if(effect.type==='heal'){
      playerHp=Math.min(playerMaxHp,playerHp+effect.hp);
      pushMsg('VEX · ENDURANCE (+1 HP)',true);
      updateUI();
    }else if(effect.type==='anodyne-serum'){
      // Overheal is intentionally allowed. Preserve the base max HP for each stage.
      playerHp+=effect.hp;
      pushMsg('ANODYNE · RECOVERY SERUM (+2 HP)',true);
      updateUI();
    }else if(effect.type==='anodyne-cryo'){
      pushMsg('ANODYNE · CRYOGENIC SOLUTION (30% SLOW · 5s)',true);
    }else if(effect.type==='anodyne-suppression'){
      // Don't queue a burst of words after the pause ends.
      spawnAccMs=0;
      pushMsg('ANODYNE · SUPPRESSION FORMULA (4s)',true);
    }else if(effect.type==='nitrate-charge'){
      pushMsg(`NITRATE · WRATH SHIELD (${effect.shield}/5)`,true);
      updateUI();
    }else if(effect.type==='nitrate-release'){
      pushMsg('NITRATE · WRATH RELEASE (+7 BOSS DAMAGE)',true);
      nitrateReleaseVisual();
      updateUI();
    }else if(effect.type==='crossbow-showoff'){
      if(effect.forceLongest){
        const entry=operatorLongestStageEntry();
        const spawned=entry?spawnOneWord({prompt:entry.prompt,answer:entry.answer,forceOperatorSpawn:true}):null;
        if(spawned)operatorPassive?.markCrossbowWord(spawned);
      }
      pushMsg('SHOW-OFF · BULLSEYE MARKED',true);
    }else if(effect.type==='charge'){
      bossHpText?.classList?.add('operator-weak-point-ready');
      pushMsg('AVELINE · WEAK POINT READY',true);
    }else if(effect.type==='boss-bonus'){
      bossHpText?.classList?.remove('operator-weak-point-ready');
      pushMsg('AVELINE · WEAK POINT (+2 DAMAGE)',true);
    }else if(effect.type==='domain-freeze'){
      wordLane?.classList?.add('operator-frozen-domain');
      spawnAccMs=0;
      pushMsg('ISOLDE · FROZEN DOMAIN (2.5s)',true);
    }else if(effect.type==='mark-word'){
      pushMsg('SERAPHINE · TARGET MARKED',true);
    }else if(effect.type==='execution-pending'){
      pushMsg('SERAPHINE · NEXT TARGET (3s)',true);
    }else if(effect.type==='lupa-ready'){
      operatorStartLupa();
      return effect;
    }else if(effect.type==='lupa-hit'){
      pushMsg(`LUPA · WEAK POINT (+${effect.damage} BOSS DMG)`,true);
    }else if(effect.type==='lupa-complete'){
      pushMsg(`LUPA · MOONLIT AMBUSH COMPLETE (+${effect.damage} BOSS DMG)`,true);
      operatorClearLupaVisuals();
    }
    applyOperatorFieldEffect(effect);
    return effect;
  }
  // Visual/field effects are kept outside the rules engine. This is also used
  // after frame spawns, so timed effects can pick up newly arriving words.
  function applyOperatorFieldEffect(effect){
    if(!effect)return;
    if(effect.type==='nitrate-mark'){
      if(effect.wordIds?.length)pushMsg(`NITRATE · WRATH MARKED (${effect.wordIds.length})`,true);
    }else if(effect.type==='chain-cleave-start'){
      startChainCleaveHex(effect);
    }else if(effect.type==='shield-advance'){
      // Push only the snapshot of falling words present at the HP crossing.
      // Keep words within the top boundary; stacked words/spawn timer are untouched.
      const ids=new Set(effect.wordIds);
      const height=Math.max(1,laneHeight());
      const moved=[];
      for(const word of wordsOnField){
        if(!ids.has(word.id)||word.state!=='falling')continue;
        const before=word.y;
        word.y=Math.max(-30,before-height*effect.percent/100);
        const delta=before-word.y;
        if(delta<=0)continue;
        // The simulation moves to the safe position immediately. A separate
        // CSS `translate` animates from the old screen position to the new
        // one without interfering with per-frame `transform: var(--y)`.
        word.el?.classList?.remove('operator-shield-pushing');
        word.el?.style?.setProperty('--mara-shield-push-distance',`${delta}px`);
        setWordY(word.el,word.y);
        moved.push(word.el);
      }
      // Batch the style flush once so the same word can animate a second
      // threshold crossing even if the first animation is still in progress.
      if(moved.length){
        void wordLane?.offsetWidth;
        for(const el of moved)el?.classList?.add('operator-shield-pushing');
      }
      pushMsg(effect.freezeSeconds
        ?`SHIELD ADVANCE · 35% PUSH + ${effect.freezeSeconds}s HOLD`
        :'SHIELD ADVANCE · 10% PUSH',true);
    }else if(effect.type==='lupa-start'){
      operatorApplyLupaVisuals(effect.wordIds,effect.seconds);
      pushMsg(`LUPA · MOONLIT AMBUSH (${effect.wordIds.length} WEAK POINTS)`,true);
    }else if(effect.type==='lupa-timeout'){
      operatorClearLupaVisuals();
      pushMsg(effect.count>0
        ?`LUPA · WEAK POINT FAILED (-${effect.selfDamage} HP)`
        :'LUPA · MOONLIT AMBUSH ENDED',true);
    }else if(effect.type==='anodyne-suppression-ended'){
      spawnAccMs=0;
      pushMsg('ANODYNE · SUPPRESSION ENDED',true);
    }else if(effect.type==='foxfire-start'){
      cancelFoxfireRewind();
      spawnAccMs=0;
      const ids=new Set(effect.wordIds);
      const rewound=[];
      for(const word of wordsOnField){
        if(!ids.has(word.id))continue;
        // The simulation is safely moved to -30 immediately, but an independent
        // CSS `translate` starts at the original on-screen coordinate. All
        // affected words visibly travel BACK up the lane before entering stasis.
        const fromY=word.y;
        const wasLanded=word.state==='landed';
        word.foxfireOrigin=true;
        word.foxfireHidden=true;
        word.state='falling';
        word.y=-30;
        word.groupId=0;word.groupIndex=0;word.spawnBaseCount=undefined;
        word.el?.classList?.remove('landed','operator-foxfire-released');
        word.el?.classList?.add('operator-foxfire-hidden','operator-foxfire-rewinding');
        word.el?.style?.setProperty('--tavi-rewind-distance',`${Math.max(0,fromY+30)}px`);
        if(wasLanded){
          // Landed-only special timers should not expire while rewound.
          word.ex1DamageArmed=false;word.ex1DeadlineMs=0;
          word.ex3DeadlineMs=0;word.ex4DeadlineMs=0;
          word.el?.classList?.remove('ex1StarArmed');
        }
        setWordY(word.el,word.y);
        rewound.push(word);
      }
      // Excluded words are unchanged, and their stack reflows immediately.
      restackDirty=true;
      restackLanded();
      wordLane?.classList?.add('operator-foxfire-active','operator-foxfire-rewinding');
      const ticket=foxfireRewindTicket;
      const finish=()=>{
        if(ticket!==foxfireRewindTicket)return; // Stage/reset/continue won.
        foxfireRewindTimer=null;
        for(const word of rewound){
          word.el?.classList?.remove('operator-foxfire-rewinding');
          word.el?.style?.removeProperty?.('--tavi-rewind-distance');
        }
        wordLane?.classList?.remove('operator-foxfire-rewinding');
        // The first word becomes typeable only after its visible rewind ends.
        if(gameState==='playing'||gameState==='paused')releaseFoxfireWord(effect.releaseId);
      };
      const reduced=!!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      if(reduced||!rewound.length)finish();
      else foxfireRewindTimer=setTimeout(finish,FOXFIRE_REWIND_MS);
      pushMsg(`TAVI · FOXFIRE REWIND (${effect.wordIds.length} WORDS)`,true);
    }else if(effect.type==='foxfire-next'){
      releaseFoxfireWord(effect.wordId);
    }else if(effect.type==='foxfire-ready'){
      pushMsg('TAVI · FOXFIRE READY',true);
    }else if(effect.type==='foxfire-end'){
      cancelFoxfireRewind();
      wordLane?.classList?.remove('operator-foxfire-active');
      spawnAccMs=0;
      pushMsg('TAVI · FOXFIRE COMPLETE',true);
    }else if(effect.type==='hound-mark'){
      pushMsg(effect.chain
        ?`HOUND · BLOOD HUNT (${effect.chainHits+1}/3 · 3s)`
        :'HOUND · PREY MARKED (6s)',true);
    }else if(effect.type==='hound-await-prey'){
      pushMsg('HOUND · WAITING FOR PREY',true);
    }else if(effect.type==='hound-next'){
      pushMsg(effect.damage>0
        ?`HOUND · BLOOD HUNT (+${effect.damage} BOSS DMG)`
        :'HOUND · BLOOD HUNT START',true);
    }else if(effect.type==='hound-complete'){
      pushMsg('HOUND · BLOOD HUNT COMPLETE',true);
    }else if(effect.type==='hound-force-spawn'){
      // Forced chain targets bypass ordinary spawn pacing, not stage/word rules.
      if(gameState==='playing'){
        spawnOneWord({forceOperatorSpawn:true});
        const newMark=operatorPassive?.updateField(wordsOnField,stageElapsedSec());
        if(newMark?.type==='hound-mark')applyOperatorFieldEffect(newMark);
      }
    }else if(effect.type==='cassian-decree'){
      pushMsg(effect.invulnerable
        ?'CASSIAN · DECREE + ROYAL AUTHORITY (5s)'
        :'CASSIAN · SOVEREIGN’S DECREE',true);
      if(effect.invulnerable)wordLane?.classList?.add('operator-sovereign-guard');
    }
  }
  function releaseFoxfireWord(wordId){
    const word=wordsOnField.find(w=>w.id===wordId);
    if(!word)return;
    word.foxfireHidden=false;
    word.el?.classList?.remove('operator-foxfire-hidden');
    word.el?.classList?.add('operator-foxfire-released');
    setWordY(word.el,word.y);
  }
  function operatorAutoEliminate(wordId,grantRewards,operatorId='seraphine'){
    // This removes an existing falling word only. It never triggers onCorrect,
    // another operator charge, typing streak, or server-side "correctWord" claim.
    const word=wordsOnField.find(w=>w.id===wordId&&w.state==='falling'&&!w.ex2Hacked&&!w.ex3ExpiredGhost);
    if(!word)return 0;
    const pts=grantRewards?calcMinimumWordScore(word):0;
    const slash=grantRewards?document.createElement('span'):null;
    if(slash){
      slash.className=operatorId==='cassian'?'operator-sovereign-slash':'operator-phantom-slash';
      slash.style.top=`${Math.max(0,word.y)}px`;
      slash.setAttribute('aria-hidden','true');
      wordLane.appendChild(slash);
      setTimeout(()=>slash.remove(),500);
    }
    removeWord(word.id);
    if(grantRewards){
      addScore(pts); // addScore also awards regular score-linked coins where eligible.
      if(currentMode!=='shared')addXp(1);
      pushMsg(operatorId==='cassian'?`CASSIAN · DECREE (+${pts})`:`SERAPHINE · PHANTOM EXECUTION (+${pts})`,true);
      return baseHitDamage;
    }
    pushMsg('AVELINE · TACTICAL CLEAR',true);
    return 0;
  }
  function operatorCleaveLowest(){
    const next=wordsOnField.filter(w=>w.state==='falling'&&!w.ex2Hacked&&!w.ex3ExpiredGhost&&!w.s5Permafrost)
      .reduce((best,w)=>!best||w.y>best.y?w:best,null);
    if(next)operatorAutoEliminate(next.id,false);
  }
  function operatorOnMistake(){
    const effect=operatorPassive?.onMistake(stageElapsedSec());
    if(effect?.type==='mistake-guard')pushMsg('KADE · TRICKSTER (NO HP LOSS)',true);
    return !!effect?.preventHpLoss;
  }
  function operatorSpawnPaused(time=stageElapsedSec()){
    return Boolean(operatorPassive?.isSpawnPaused(time));
  }

  let nextWordId = 1;

  let lastTs = 0;

  // Prevent huge dt spikes after tab/app is backgrounded.
  document.addEventListener("visibilitychange", () => {
    if(!document.hidden) lastTs = 0;
  });

  let overflow = false;
  let overflowAcc = 0;
  const OVERFLOW_SPAWN_RESUME_GRACE_MS = 1250;
  let overflowSpawnGraceUntilMs = 0;


  let stagePlayStartMs = 0;
  let stagePausedTotalMs = 0;
  let stagePauseStartMs = null;

  let spawnAccMs = 0;
  let autoSpawnEnabled = true; // can be disabled for the EX2 Phase 5 wake-up sequence

  let spawnCountThisStage = 0;
  let midFightBubbleShown = false;

// Normal Stage 3 mechanics removed.
let stage5Phase = 1;
  let stage5EndedHandled = false;
  let stage5Phase2At = null;
  let stage5Phase3At = null;

  // Stage 5 (Normal) Phase 3 ramp: on each boss hit, slightly increase spawn rate + fall speed.
  let s5p3SpawnMs = null;
  let s5p3FallSpeed = null;
  let bossNormalSrc = "";

  function setInputsEnabled(enabled){
    answerInput.disabled = !enabled;
    if(enabled){
      answerInput.focus();
    }else{
      answerInput.blur();
      answerInput.value = "";
    }
  }

  // Like setInputsEnabled(), but does NOT clear the current text.
  // (Useful for Pause: keep what the user was typing.)
  function setInputsEnabledSoft(enabled){
    answerInput.disabled = !enabled;
    if(enabled){
      answerInput.focus();
    }else{
      answerInput.blur();
    }
  }

  // PERF: Cache last-rendered values to avoid rewriting DOM on every frame.

  const uiCache = {
    stageName: null,
    bossName: null,
    bossHpStr: null,
    bossFillW: null,
    playerHpStr: null,
    playerFillW: null,
    playerBonusFillW: null,
    playerBonusLeft: null,
    maraHpActive: null,
    nitrateShield: null,
    nitrateVisible: null,
    mistakes: null,
    continuesLeft: null,
    overflow: null,
    bossInv: null,
    scoreMode: null,
    scoreStr: null,
    bestScoreStr: null,
    penaltyStr: null,
  };

  const UI_TICK_MS = 50; // ~20fps is plenty for text/UI, reduces jank on mobile.
  let nextUiTickAt = 0;
function updatePauseCmdUI(){
  if(!pauseCmd || !pauseCmdText) return;

  let label = (gameState === "paused") ? "Resume (ESC)" : "Pause (ESC)";
  let disabled = false;

  if(gameState === "playing"){
    if(isExtraStage2()){
      disabled = true;
      label = "Pause (N/A in EX2)";
    }
  }else if(gameState === "paused"){
    disabled = false;
  }else{
    disabled = true;
    label = isExtraStage2() ? "Pause (N/A in EX2)" : "Pause";
  }

  pauseCmd.classList.toggle("disabled", disabled);
  pauseCmd.disabled = disabled;
  pauseCmd.classList.toggle("crossedOut", isExtraStage2());
  pauseCmdText.textContent = label;
}

  function updateUIThrottled(){
    const now = nowMs();
    if(now < nextUiTickAt) return;
    nextUiTickAt = now + UI_TICK_MS;
    updateUI();
  }

// 5★ Mara: the standard 10 HP remains green, and only her +3 HP is amber.
// Split by total bar capacity; consuming bonus HP removes amber before green.
function computePlayerHpSegments(hp,maxHp,maraEquipped){
  const capacity=Math.max(1,Number(maxHp)||BASE_PLAYER_MAX_HP);
  const remaining=clamp(Number(hp)||0,0,capacity);
  const baseCap=Math.min(BASE_PLAYER_MAX_HP,capacity);
  const base=(maraEquipped?Math.min(remaining,baseCap):remaining);
  const extra=maraEquipped?Math.max(0,remaining-baseCap):0;
  const percent=n=>`${(100*n/capacity).toFixed(1)}%`;
  return {baseWidth:percent(base),bonusWidth:percent(extra),bonusLeft:percent(baseCap)};
}

function updateUI(){
    const stage = STAGES[stageIndex] || null;
    // Menu destinations are safe only outside an active run.
    const accountBlocked=['playing','paused','countdown','dialogue','stageclear','continuePrompt'].includes(gameState);
    if(profileCmd)profileCmd.disabled=accountBlocked;
    if(achievementsCmd)achievementsCmd.disabled=accountBlocked;


    // Practice Mode: hide the confusing "Start（モード選択）" command (it doesn't work during play anyway)
    if(startCmd){
      startCmd.style.display = (currentMode === "practice") ? "none" : "";
    }
    const stageName = stage ? stage.stageName : "-";
    if(stageName !== uiCache.stageName){
      uiCache.stageName = stageName;
      stageNameEl.textContent = stageName;
    }

    const bossName = stage ? stage.bossName : "-";
    if(bossName !== uiCache.bossName){
      uiCache.bossName = bossName;
      bossNameEl.textContent = bossName;
    }

    // EX4: cover boss HP with eye banner (HP line only)
    if(ex4EyeBanner){
      const showEye = (currentMode === "extra" && stageIndex === 3 && gameState === "playing");
      ex4EyeBanner.style.opacity = showEye ? "1" : "0";
    }

    const bossHpStr = `${bossHp}/${bossMaxHp}`;
    if(bossHpStr !== uiCache.bossHpStr){
      uiCache.bossHpStr = bossHpStr;
      bossHpText.textContent = bossHpStr;
    }

    const bossW = `${((bossMaxHp ? clamp(bossHp/bossMaxHp,0,1) : 0) * 100).toFixed(1)}%`;
    if(bossW !== uiCache.bossFillW){
      uiCache.bossFillW = bossW;
      bossFill.style.width = bossW;
    }

    const playerHpStr = `${playerHp}/${playerMaxHp}`;
    if(playerHpStr !== uiCache.playerHpStr){
      uiCache.playerHpStr = playerHpStr;
      playerHpText.textContent = playerHpStr;
      playerHpText.classList.toggle('operator-anodyne-overheal',playerHp>playerMaxHp);
    }

    const maraHpActive=operatorPassive?.rule?.id==='shield' && playerMaxHp>BASE_PLAYER_MAX_HP;
    const hpVisual=computePlayerHpSegments(playerHp,playerMaxHp,maraHpActive);
    if(maraHpActive!==uiCache.maraHpActive){
      uiCache.maraHpActive=maraHpActive;
      playerMeter.classList.toggle('operator-mara-hp',maraHpActive);
      playerMeter.title=maraHpActive?'Mara: 10 base HP + 3 bonus HP':'';
    }
    if(hpVisual.baseWidth!==uiCache.playerFillW){
      uiCache.playerFillW=hpVisual.baseWidth;
      playerFill.style.width=hpVisual.baseWidth;
    }
    if(hpVisual.bonusWidth!==uiCache.playerBonusFillW){
      uiCache.playerBonusFillW=hpVisual.bonusWidth;
      playerBonusFill.style.width=hpVisual.bonusWidth;
    }
    if(hpVisual.bonusLeft!==uiCache.playerBonusLeft){
      uiCache.playerBonusLeft=hpVisual.bonusLeft;
      playerBonusFill.style.left=hpVisual.bonusLeft;
      playerMeter.style.setProperty('--mara-base-share',hpVisual.bonusLeft);
    }

    const nitrateVisible=operatorPassive?.rule?.id==='nitrate';
    const nitrateShield=nitrateVisible?(operatorPassive.getNitrateShield?.()||0):0;
    if(nitrateVisible!==uiCache.nitrateVisible){
      uiCache.nitrateVisible=nitrateVisible;
      if(nitrateShieldEl)nitrateShieldEl.hidden=!nitrateVisible;
      if(!nitrateVisible)wordLane?.classList?.remove('operator-nitrate-ready');
    }
    if(nitrateShield!==uiCache.nitrateShield){
      uiCache.nitrateShield=nitrateShield;
      for(let i=0;i<nitrateShieldSegments.length;i++){
        nitrateShieldSegments[i].classList.toggle('filled',i<nitrateShield);
      }
      if(nitrateShieldEl){
        nitrateShieldEl.classList.toggle('awakened',nitrateShield>=3);
        nitrateShieldEl.classList.toggle('charged',nitrateShield>=5);
        nitrateShieldEl.setAttribute('aria-label',`Wrath Shield ${nitrateShield} of 5`);
      }
      wordLane?.classList?.toggle('operator-nitrate-ready',nitrateVisible&&nitrateShield>=5);
    }

    if(mistakes !== uiCache.mistakes){
      uiCache.mistakes = mistakes;
      mistakesText.textContent = String(mistakes);
    }
    if(continuesLeft !== uiCache.continuesLeft){
      uiCache.continuesLeft = continuesLeft;
      continuesText.textContent = (currentMode === "practice" || continuesLeft === Infinity) ? "∞" : String(continuesLeft);
    }

    if(overflow !== uiCache.overflow){
      uiCache.overflow = overflow;
      overflowBadge.classList.toggle("show", overflow);
    }

    const bossInv = !!(stage && stage.bossInvulnerable);
    if(bossInv !== uiCache.bossInv){
      uiCache.bossInv = bossInv;
      if(bossMeter) bossMeter.classList.toggle("invuln", bossInv);
    }

    // ---- Score UI ----
    const modeLabel = (currentMode === "extra")
      ? "Extra"
      : ((currentMode === "practice")
          ? "Practice"
          : ((currentMode === "challenge") ? "Challenge" : currentMode === "shared" ? "All Grades" : currentMode === "story" ? "Story" : "Normal"));
    if(scoreModeLabel && modeLabel !== uiCache.scoreMode){
      uiCache.scoreMode = modeLabel;
      scoreModeLabel.textContent = modeLabel;
    }

    const scoreStr = String(getActiveScore());
    if(scoreText && scoreStr !== uiCache.scoreStr){
      uiCache.scoreStr = scoreStr;
      scoreText.textContent = scoreStr;
    }

    const bestStr = String(getActiveHiScore());
    if(bestScoreText && bestStr !== uiCache.bestScoreStr){
      uiCache.bestScoreStr = bestStr;
      bestScoreText.textContent = bestStr;
    }

    const modeMult = scoreModeMultiplier();
    const multStr = (modeMult !== 1) ? ` / Mode ×${modeMult}` : "";
    const penStr = multStr + ((continuesUsedThisRun > 0) ? ` / Penalty ×${scorePenaltyMultiplier().toFixed(2)}` : "");
    if(scorePenaltyText && penStr !== uiCache.penaltyStr){
      uiCache.penaltyStr = penStr;
      scorePenaltyText.textContent = penStr;
    }

    updatePauseCmdUI();
  }

  function flashPlayerDamage(){
    damageFlash.classList.remove("show");
    void damageFlash.offsetWidth;
    damageFlash.classList.add("show");
  }

  function resetField(opts = {}){
    window.RPG_CH1_SPECIAL?.reset();
    setSleepyBgmGain(1);
    clearChainCleaveHex();
    cancelFoxfireRewind();
    const preservePermafrost = !!opts.preservePermafrost;

    if(!preservePermafrost){
      for(const w of wordsOnField){
        // Remove each word before clearing the field.
        try{ w && w.el && w.el.remove(); }catch(_){}
      }
      wordsOnField = [];
    }else{
      const keep = [];
      for(const w of wordsOnField){
        // Remove non-persistent words before clearing the field.
        if(w && w.s5Permafrost){
          keep.push(w);
        }else{
          try{ w && w.el && w.el.remove(); }catch(_){}
        }
      }
      wordsOnField = keep;
      restackLanded();
    }

    overflow = false;
    overflowAcc = 0;
    overflowSpawnGraceUntilMs = 0;
    try{ ex5ClearSunSpots(); }catch(_){/* ignore */}
  }

function laneHeight(){ return wordLane.clientHeight; }
  function laneCapacity(){ return Math.floor(laneHeight() / 30); }
  function landedWords(){
    // Expired Extra Stage 3 ghosts are non-interactive, but they still count as solid landed words.
    return wordsOnField.filter(w => w.state === "landed");
  }

  // PERF: Use a CSS variable + translate3d to move words without triggering layout.
  function setWordY(el, y){
    el.style.setProperty("--y", `${y}px`);
    // Make "ghosting past each other" visually obvious: lower words render above higher words,
    // but still let sun spots fully cover comet words.
    const isChallengeCometEl = !!(el && el.classList && el.classList.contains("challengeComet") && !el.classList.contains("landed"));
    el.style.zIndex = String((isChallengeCometEl ? 8000 : 1000) + Math.round(y));
  }


  function restackLanded(){
    const h = laneHeight();
    const landed = landedWords().sort((a,b)=> b.y - a.y);
    for(let i=0;i<landed.length;i++){
      const y = h - 30 * (i+1);
      landed[i].y = y;
      setWordY(landed[i].el, y);
    }
    // NOTE: overflow + UI are handled in tick() for consistency/perf
  }

  let gradedSpawnIndex=0;
  const gradedPools=[[],[],[]];
  function resetGradedBuckets(){gradedSpawnIndex=0;for(let i=0;i<3;i++)gradedPools[i]=[];}
  function gradedWordForSpawn(valid){
    const categories=[valid.filter(w=>countEnglishLetters(w.answer)<=5),
      valid.filter(w=>countEnglishLetters(w.answer)>=6&&countEnglishLetters(w.answer)<=8),
      valid.filter(w=>countEnglishLetters(w.answer)>=9)];
    const available=categories.map((g,i)=>g.length?i:-1).filter(i=>i>=0);
    if(!available.length)return null;
    const bi=available[gradedSpawnIndex++%available.length];
    let pool=gradedPools[bi];
    if(!pool.length){
      pool=categories[bi].map((_,i)=>i);
      for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
      gradedPools[bi]=pool;
    }
    const word=categories[bi][pool.pop()];
    return {prompt:word.prompt,answer:word.answer};
  }
  function pickStageWord(opts = {}){
    const stage = STAGES[stageIndex];
    const list = (stage && stage.words) ? stage.words : [];
    if(!list.length) return null;

    // Guard: skip accidental header rows like "Japanese    English"
    // and also skip empty/invalid entries.
    const isBad = (p, a) => {
      const pp = String(p ?? "").trim();
      const aa = String(a ?? "").trim();
      if(!pp || !aa) return true;
      const pL = pp.toLowerCase();
      const aL = aa.toLowerCase();

      // Common header / meta rows
      if((pL === "japanese" && aL === "english") || (pL === "english" && aL === "japanese")) return true;
      if((pp === "日本語" && aL === "japanese") || (pp === "英語" && aL === "english")) return true;

      return false;
    };

    const valid = [];
    for(const w of list){
      if(!w) continue;
      if(isBad(w.prompt, w.answer)) continue;
      valid.push(w);
    }
    if(valid.length <= 0) return null;

    // Challenge comet words should appear, but should not be long words as often.
    // This weights shorter English answers higher without completely banning long ones.
    if(opts && opts.preferShort){
      let total = 0;
      const weighted = valid.map(w => {
        const len = challengeAnswerLengthForWeight(w.answer);
        const weight = 1 / Math.pow(len, 1.75);
        total += weight;
        return { w, weight };
      });
      let r = Math.random() * total;
      for(const item of weighted){
        r -= item.weight;
        if(r <= 0) return { prompt: item.w.prompt, answer: item.w.answer };
      }
      const last = weighted[weighted.length - 1].w;
      return { prompt: last.prompt, answer: last.answer };
    }

    if(currentMode === "shared") return sharedWordForSpawn();
    if(currentMode==='normal'||currentMode==='extra')return gradedWordForSpawn(valid);
    const w = valid[Math.floor(Math.random() * valid.length)];
    return w ? { prompt: w.prompt, answer: w.answer } : null;
  }

  // (Extra Stage 1 unique mechanics removed)


  function makeUnreadableAnswer(original){
    // Keep it unreadable, but compact so long JP prompts don\'t get squeezed.
    return "■".repeat(3);
  }


// ---- Challenge Mode mechanics: comet + star-struck words ----
function isChallengeCometStage(){
  return currentMode === "challenge";
}
function challengeSpecialsAlwaysBoth(){
  if(!isChallengeCometStage()) return false;
  // After 1 minute, any special Challenge word becomes both Comet + Star-Struck.
  try{ return stageElapsedSec() >= 60; }catch(_){ return false; }
}
function challengeAllWordsAlwaysBoth(){
  if(!isChallengeCometStage()) return false;
  // After 2 minutes, every Challenge word becomes both Comet + Star-Struck.
  try{ return stageElapsedSec() >= 120; }catch(_){ return false; }
}
function challengeRampMultiplier(elapsedSec){
  if(!isChallengeCometStage()) return 1;
  const elapsed = Number(elapsedSec) || 0;
  if(elapsed < 180) return 1;
  // After 3 minutes, ramp spawn rate and fall speed upward gradually.
  // +10% every 20 seconds, capped so the game does not become impossible instantly.
  const steps = Math.max(0, (elapsed - 180) / 20);
  return Math.min(2.75, 1 + (steps * 0.10));
}
function challengeStarBaseForCount(count){
  const n = Number(count) || 0;
  // First word is star-struck, then every 3rd cadence after that: 1, 4, 7, 10...
  return (((n - 1) % 3) === 0);
}
function challengeCometBaseForCount(count){
  const n = Number(count) || 0;
  // First word is comet, then every 4th cadence after that: 1, 5, 9, 13...
  return (((n - 1) % 4) === 0);
}
// New coded mechanics register independently and receive stable lifecycle hooks.
function mechanicEvent(type,word=null,info={}){
  if(!window.RPG_MECHANICS?.hasHook(type))return;
  const helpers={
    // Extra word spawns bypass plugin onSpawn to avoid accidental infinite recursion.
    spawn:(options={})=>spawnOneWord({...options,countSpawn:false,skipMechanicHooks:true}),
    remove:id=>removeWord(id),
    damagePlayer:(amount)=>damagePlayer(amount,'custom mechanic'),
    damageBoss:amount=>damageBoss(amount),
    time:()=>stageElapsedSec()
  };
  try{window.RPG_MECHANICS?.dispatch(type,{word,mode:currentMode,stageIndex,...info,...helpers});}catch(e){console.warn(e)}
}
function challengeSpecialWord(id, defaultResult){
  if(window.RPG_BALANCE?.mechanic(id,'enabled',true)===false)return false;
  const pct=Number(window.RPG_BALANCE?.mechanic(id,'chancePct',-1)??-1);
  return pct>=0?Math.random()*100<pct:defaultResult;
}
function challengeIsCometSpawn(){
  if(!isChallengeCometStage()) return false;
  if(challengeAllWordsAlwaysBoth()) return challengeSpecialWord('comet',true);
  const n = spawnCountThisStage;
  const comet = challengeCometBaseForCount(n);
  const star = challengeStarBaseForCount(n);
  const defaultResult=challengeSpecialsAlwaysBoth() ? (comet || star) : comet;
  return challengeSpecialWord('comet', defaultResult);
}
function challengeIsStarStruckSpawn(){
  if(!isChallengeCometStage()) return false;
  if(challengeAllWordsAlwaysBoth()) return challengeSpecialWord('star_struck',true);
  const n = spawnCountThisStage;
  const comet = challengeCometBaseForCount(n);
  const star = challengeStarBaseForCount(n);
  const defaultResult=challengeSpecialsAlwaysBoth() ? (comet || star) : star;
  return challengeSpecialWord('star_struck', defaultResult);
}
function challengeWouldBeCometForCount(nextCount){
  if(!isChallengeCometStage()) return false;
  if(challengeAllWordsAlwaysBoth()) return true;
  const n = Number(nextCount) || 0;
  const comet = challengeCometBaseForCount(n);
  const star = challengeStarBaseForCount(n);
  return challengeSpecialsAlwaysBoth() ? (comet || star) : comet;
}
function challengeAnswerLengthForWeight(answer){
  const s = String(answer || "");
  const letters = s.replace(/[^A-Za-z0-9]/g, "").length;
  return Math.max(1, letters || s.trim().length || 1);
}
function challengeUpdateCometGlow(w, progress){
  try{
    if(!w || !w.el || !w.challengeComet) return;
    const p = clamp(Number(progress) || 0, 0, 1);
    // Make the final third of the fall much brighter and easier to notice.
    const eased = Math.pow(p, 1.7);
    const glowPx = Math.round(34 + eased * 118);
    const whitePx = Math.round(22 + eased * 92);
    const outerPx = Math.round(54 + eased * 154);
    w.el.style.setProperty("--cometGlowPx", `${glowPx}px`);
    w.el.style.setProperty("--cometWhiteGlowPx", `${whitePx}px`);
    w.el.style.setProperty("--cometOuterGlowPx", `${outerPx}px`);
    w.el.style.setProperty("--cometBlueAlpha", String(Math.min(.98, .42 + eased * .56)));
    w.el.style.setProperty("--cometWhiteAlpha", String(Math.min(.92, .18 + eased * .70)));
    w.el.style.setProperty("--cometOuterAlpha", String(Math.min(.72, .08 + eased * .58)));
    w.el.style.setProperty("--cometBrightness", String((1.22 + eased * 2.20).toFixed(3)));
    w.el.style.setProperty("--cometSaturation", String((1.28 + eased * .95).toFixed(3)));
    w.el.style.opacity = "1";
    w.el.style.visibility = "visible";
  }catch(_){/* ignore */}
}
function challengeHandleCometLanding(w){
  if(!w) return;
  try{ pushMsg("☄️ COMET landed!", true); }catch(_){}
  // If this word was both Comet + star-struck, the sun spot still happens where it landed.
  try{
    if(w.ex5StarStruck) ex5CreateSunSpotAt(w.y);
  }catch(_){}
  try{ removeWord(w.id); }catch(_){}
  try{ damagePlayer(2, "comet"); }catch(_){}
}

// ---- Normal Stage 4 mechanics removed for clean base ----
function isNormalStage4(){ return false; }
function stage4InitCycleTimer(){ /* Stage 4 mechanic removed. */ }
function stage4IsFrozen(){ return false; }
function stage4ClearFreezeTimeouts(){ /* Stage 4 mechanic removed. */ }
function stage4UpdateFreeze(_dtReal){ /* Stage 4 mechanic removed. */ }
function stage4UpdateCycle(_dt){ /* Stage 4 mechanic removed. */ }
function showStage4Timer(_show){ /* Stage 4 mechanic removed. */ }
function updateStage4Timer(){ /* Stage 4 mechanic removed. */ }

  // ---- Normal Stage 5 mechanics removed for clean base ----
function isNormalStage5(){ return false; }
function stage5HighlightFrequency(){ return 0; }
function stage5FrostWindowSec(){ return 0; }
function stage5BossVariantForPhase(_phase){ return 1; }
function stage5ArmFrost(_w, _elapsed){ /* Stage 5 mechanic removed. */ }
function stage5MakePermafrost(_w){ /* Stage 5 mechanic removed. */ }
function stage5UpdateFrost(){ /* Stage 5 mechanic removed. */ }
function stage5ClearNonPermafrostWords(){ /* Stage 5 mechanic removed. */ }
function stage5IsFrozenInput(_norm){ return false; }

function ex1IsFrozenInput(_norm){ return false; }


  // ---- Extra Stage 1 mechanic: shooting star countdown damage ----
  function isExtraStage1(){
    return currentMode === "extra" && stageIndex === 0;
  }
  function ex1HighlightFrequency(){
    // Every 3 spawned words becomes a shooting star.
    return isExtraStage1() ? 3 : 0;
  }
  function ex1ShootingStarWindowSec(){
    // Below half boss HP: countdown becomes 3 seconds instead of 4.
    return (isExtraStage1() && bossMaxHp > 0 && bossHp < (bossMaxHp / 2)) ? 3 : 4;
  }
  function ex1RandomFallMult(){ return 1; }
  function ex1SetShootingStarGlow(wordObj, progress){
    if(!wordObj || !wordObj.el) return;
    const p = clamp(Number(progress) || 0, 0, 1);
    const brightness = (1 + p * 1.35).toFixed(2);
    const outerGlow = Math.round(24 + p * 62);
    const innerGlow = Math.round(8 + p * 24);
    const alpha1 = (0.25 + p * 0.45).toFixed(2);
    const alpha2 = (0.10 + p * 0.38).toFixed(2);
    wordObj.el.style.filter = `brightness(${brightness})`;
    wordObj.el.style.boxShadow = [
      "0 0 0 1px rgba(255, 230, 120, .50)",
      `0 0 ${innerGlow}px rgba(255, 255, 210, ${alpha2})`,
      `0 0 ${outerGlow}px rgba(255, 230, 120, ${alpha1})`,
      "0 8px 12px rgba(0,0,0,.35)"
    ].join(", ");
  }
  function ex1ClearShootingStarGlow(wordObj){
    try{
      if(!wordObj || !wordObj.el) return;
      wordObj.el.style.filter = "";
      wordObj.el.style.boxShadow = "";
      wordObj.el.classList.remove("flash", "ex1StarArmed");
    }catch(_){/* ignore */}
  }
  function ex1ArmPermafrost(wordObj){
    // Legacy function name kept for compatibility; now arms the shooting-star countdown.
    if(!isExtraStage1() || !wordObj || !wordObj.ex1Highlighted) return;
    if(wordObj.ex1DeadlineMs) return;
    const sec = ex1ShootingStarWindowSec();
    wordObj.ex1CountdownMs = sec * 1000;
    wordObj.ex1DeadlineMs = nowMs() + wordObj.ex1CountdownMs;
    wordObj.ex1DamageArmed = true;
    try{ wordObj.el && wordObj.el.classList.add("ex1StarArmed"); }catch(_){}
    ex1SetShootingStarGlow(wordObj, 0);
    if(wordObj.tagEl) wordObj.tagEl.textContent = `★ ${sec}`;
  }
  function ex1UpdatePermafrost(){
    // Legacy function name kept for compatibility; now updates shooting-star countdowns.
    if(!isExtraStage1()) return;
    const t = nowMs();
    for(const w of [...wordsOnField]){
      if(!w || w.state !== "landed") continue;
      if(!w.ex1Highlighted || !w.ex1DamageArmed || !w.ex1DeadlineMs) continue;

      const remMs = w.ex1DeadlineMs - t;
      const totalMs = Math.max(1, Number(w.ex1CountdownMs) || (ex1ShootingStarWindowSec() * 1000));
      const progress = 1 - clamp(remMs / totalMs, 0, 1);
      ex1SetShootingStarGlow(w, progress);

      if(remMs <= 0){
        w.ex1DamageArmed = false;
        ex1ClearShootingStarGlow(w);
        damagePlayer(2, "shooting star");
        removeWord(w.id);
      }else{
        const rem = Math.max(1, Math.ceil(remMs / 1000));
        if(w.tagEl && w.tagEl.textContent !== `★ ${rem}`) w.tagEl.textContent = `★ ${rem}`;
      }
    }
  }
  function ex1EnterPhase2(){ /* Old Extra Stage 1 phase mechanic removed. */ }




  // ---- Extra Stage 2 mechanic: timer + highlight + scramble ----
  function isExtraStage2(){
    return false;
  }
  function ex2HighlightFrequency(){
    if(!isExtraStage2()) return 0;
    // Phase mechanics removed for Extra Stage 2: keep a constant difficulty
    return 3;
  }
  function ex2CycleSeconds(){
    if(!isExtraStage2()) return 0;
    // Phase mechanics removed for Extra Stage 2: keep a constant shuffle timer
    return 5;
  }

function ex2RandRange(a, b){
  return a + (b - a) * Math.random();
}
function ex2RandomFallMult(){
  // Noticeable variation but still readable/playable.
  return (Math.random() < 0.5) ? ex2RandRange(0.60, 0.95) : ex2RandRange(1.15, 1.70);
}
function ex2ApplyPhase4ToExistingWords(){
  // Phase 4: all words ignore collision while falling, and fall at different rates.
  for(const w of wordsOnField){
    if(!w) continue;
    w.ignoreCollision = true;
    if(w.state === "falling"){
      w.ex2FallMult = ex2RandomFallMult();
    }
  }
}
  function ex2BossVariantForPhase(p){
    // EX2 boss art is time-phase locked (not HP-based):
    // Phase 1-2 => v1, Phase 3 => v2, Phase 4+ => v3.
    if(p >= 4) return 3;
    if(p >= 3) return 2;
    return 1;
  }





    function ex2HandlePhaseTriggers(elapsedSec){
    if(!isExtraStage2()) return;

    // Time-based phases:
    // Phase 1: 0–40s    (obscure every 3 spawns)
    // Phase 2: 40–68s   (obscure every 2 spawns)
    // Phase 3: 68–98s   (Phase 2 cadence carries over; on LAND: toggle reveal/obscure)
    // Phase 4: 98s+     (Phase 2+3 carry over; ALL words ignore collision while falling + per-word fall speed variance)
    let target = 1;
    if(elapsedSec >= EX2_PHASE1_END_SEC) target = 2;
    if(elapsedSec >= EX2_PHASE2_END_SEC) target = 3;
    if(elapsedSec >= EX2_PHASE3_END_SEC) target = 4;

    if(target !== ex2Phase){
      ex2Phase = target;
      ex2PhaseSpawnCount = 0; // restart per-phase cadence

      // Phase-locked EX2 boss sprite
      const desiredV = ex2BossVariantForPhase(ex2Phase);
      if(desiredV !== bossVariantPhase){
        bossVariantPhase = desiredV;
        try{ setBossVariant(STAGES[stageIndex], desiredV); }catch(_){/* ignore */}
      }

      if(ex2Phase === 2 && !ex2Phase2Announced){
        ex2Phase2Announced = true;
        try{ pushMsg("PHASE 2", true); }catch(_){}
      }
      if(ex2Phase === 3 && !ex2Phase3Announced){
        ex2Phase3Announced = true;
        try{ pushMsg("PHASE 3", true); }catch(_){}
      }
      if(ex2Phase === 4 && !ex2Phase4Announced){
        ex2Phase4Announced = true;
        try{ pushMsg("PHASE 4", true); }catch(_){}
        ex2ApplyPhase4ToExistingWords();
      }
    }
  }


function ex2ToggleObscureOnLand(w){
    if(!w || w.ex2LandToggled) return;
    w.ex2LandToggled = true;

    w.hidePromptWhileFalling = !w.hidePromptWhileFalling;

    const aEl = w.answerEl || (w.el ? w.el.querySelector(".answer") : null);
    if(aEl){
      aEl.textContent = w.hidePromptWhileFalling ? makeUnreadableAnswer(w.answer) : w.answer;
      try{ aEl.setAttribute("title", aEl.textContent || ""); }catch(_){/* ignore */}
      try{ fitAnswerToRight(w.el || (aEl.closest ? aEl.closest(".word") : null)); }catch(_){/* ignore */}
    }
  }

  // ---- Extra Stage 3 mechanic: ghost words ----
  function isExtraStage3(){
    return currentMode === "extra" && stageIndex === 2;
  }
  function ex3SpecialFrequency(){
    // Every other spawned word becomes a ghost word.
    return isExtraStage3() ? 2 : 0;
  }
  function ex3GhostWindowSec(){
    // Below half boss HP: ghost timer becomes 4 seconds instead of 6.
    return (isExtraStage3() && bossMaxHp > 0 && bossHp < (bossMaxHp / 2)) ? 4 : 6;
  }
  function ex3RandomFallMult(){
    // Ghost words fall faster; after half HP they fall a bit faster again.
    return (isExtraStage3() && bossMaxHp > 0 && bossHp < (bossMaxHp / 2)) ? 1.85 : 1.55;
  }
  function ex3ArmGhostTimer(wordObj){
    if(!isExtraStage3() || !wordObj || !wordObj.ex3Ghost || wordObj.ex3ExpiredGhost) return;
    if(wordObj.ex3DeadlineMs) return;
    const sec = ex3GhostWindowSec();
    wordObj.ex3CountdownMs = sec * 1000;
    wordObj.ex3DeadlineMs = nowMs() + wordObj.ex3CountdownMs;
    if(wordObj.tagEl) wordObj.tagEl.textContent = `👻 ${sec}`;
  }
  function ex3ExpireGhostWord(wordObj){
    if(!wordObj || wordObj.ex3ExpiredGhost) return;
    wordObj.ex3ExpiredGhost = true;
    wordObj.ex3ExpiredAnswerNorm = wordObj.answerNorm || normalizeAnswer(wordObj.answer);
    wordObj.ex3Ghost = false;
    wordObj.ex3DeadlineMs = 0;
    wordObj.ex3CountdownMs = 0;
    wordObj.answerNorm = "";
    try{
      if(wordObj.el){
        wordObj.el.classList.remove("ghost", "ex3GhostWord");
        wordObj.el.classList.add("ex3ExpiredGhost");
      }
      if(wordObj.promptEl) wordObj.promptEl.textContent = "👻";
      if(wordObj.answerEl) wordObj.answerEl.textContent = "";
      if(wordObj.tagEl) wordObj.tagEl.textContent = "";
    }catch(_){/* ignore */}
    restackDirty = true;
  }
  function ex3UpdateGhostTimers(){
    if(!isExtraStage3()) return;
    const t = nowMs();
    for(const w of [...wordsOnField]){
      if(!w || !w.ex3Ghost || w.ex3ExpiredGhost || w.state !== "landed") continue;
      if(!w.ex3DeadlineMs) ex3ArmGhostTimer(w);
      if(!w.ex3DeadlineMs) continue;
      const remMs = w.ex3DeadlineMs - t;
      if(remMs <= 0){
        ex3ExpireGhostWord(w);
      }else if(w.tagEl){
        w.tagEl.textContent = `👻 ${Math.ceil(remMs / 1000)}`;
      }
    }
  }


  // ---- Extra Stage 4 mechanic: infected words multiply ----
  function isExtraStage4Infection(){
    return currentMode === "extra" && stageIndex === 3;
  }
  function ex4InfectFrequency(){
    if(!isExtraStage4Infection()) return 0;
    // Below half boss HP: every 3rd word instead of every 4th.
    return (bossMaxHp > 0 && bossHp < (bossMaxHp / 2)) ? 3 : 4;
  }
  function ex4InfectWindowSec(){ return 4; }
  function ex4ArmInfectionTimer(wordObj){
    if(!isExtraStage4Infection() || !wordObj || !wordObj.ex4Infected || wordObj.ex4Multiplied) return;
    if(wordObj.ex4DeadlineMs) return;
    const sec = ex4InfectWindowSec();
    wordObj.ex4CountdownMs = sec * 1000;
    wordObj.ex4DeadlineMs = nowMs() + wordObj.ex4CountdownMs;
    try{ wordObj.el && wordObj.el.classList.add("ex4InfectionArmed"); }catch(_){}
    if(wordObj.tagEl) wordObj.tagEl.textContent = `⚠️ ${sec}`;
  }
  function ex4ResetInfectionTimerAfterMultiply(wordObj){
    if(!wordObj) return;
    // Keep the original infected and restart its timer if it still has not been cleared.
    wordObj.ex4Infected = true;
    wordObj.ex4Multiplied = false;
    const sec = ex4InfectWindowSec();
    wordObj.ex4CountdownMs = sec * 1000;
    wordObj.ex4DeadlineMs = nowMs() + wordObj.ex4CountdownMs;
    try{
      if(wordObj.el){
        wordObj.el.classList.add("ex4Infected", "ex4InfectionArmed");
      }
      if(wordObj.tagEl) wordObj.tagEl.textContent = `⚠️ ${sec}`;
    }catch(_){}
  }
  function ex4MultiplyInfectedWord(wordObj){
    if(!wordObj || !wordObj.ex4Infected || wordObj.state !== "landed") return;

    // 2x means the original stays infected and creates one normal duplicate.
    // The duplicate is not infected and cannot trigger this mechanic.
    const copy = spawnOneWord({
      state: "landed",
      prompt: wordObj.prompt,
      answer: wordObj.answer,
      y: Math.max(0, (Number(wordObj.y) || 0) - 30),
      countSpawn: false,
      preventEx4Infection: true,
    });
    if(copy){
      copy.ex4Infected = false;
      copy.ex4Multiplied = true;
      copy.ex4DeadlineMs = 0;
      copy.ex4CountdownMs = 0;
      try{ copy.el && copy.el.classList.remove("ex4Infected", "ex4InfectionArmed"); }catch(_){}
      if(copy.tagEl) copy.tagEl.textContent = "";
    }

    ex4ResetInfectionTimerAfterMultiply(wordObj);
    restackDirty = true;
    try{ pushMsg("⚠️ INFECTED word multiplied! Timer reset!", true); }catch(_){}
  }
  function ex4UpdateInfectionTimers(){
    if(!isExtraStage4Infection()) return;
    const t = nowMs();
    for(const w of [...wordsOnField]){
      if(!w || !w.ex4Infected || w.ex4Multiplied || w.state !== "landed") continue;
      if(!w.ex4DeadlineMs) ex4ArmInfectionTimer(w);
      if(!w.ex4DeadlineMs) continue;
      const remMs = w.ex4DeadlineMs - t;
      if(remMs <= 0){
        ex4MultiplyInfectedWord(w);
      }else if(w.tagEl){
        w.tagEl.textContent = `⚠️ ${Math.ceil(remMs / 1000)}`;
      }
    }
  }


  // ---- Extra Stage 5 mechanic: star-struck words create temporary sun spots ----
  function isExtraStage5StarStruck(){
    return currentMode === "extra" && stageIndex === 4;
  }
  function ex5StarStruckFrequency(){
    if(!isExtraStage5StarStruck()) return 0;
    // Below half boss HP: every 2nd word instead of every 3rd.
    return (bossMaxHp > 0 && bossHp < (bossMaxHp / 2)) ? 2 : 3;
  }
  function ex5CreateSunSpotAt(y){
    try{
      const spot = document.createElement("div");
      spot.className = "sunSpot";
      const maxY = Math.max(0, laneHeight() - 30);
      const yy = clamp(Number(y) || 0, 0, maxY);
      spot.style.setProperty("--y", `${yy}px`);
      wordLane.appendChild(spot);
      setTimeout(() => { try{ spot.remove(); }catch(_){} }, 4600);
    }catch(_){/* ignore */}
  }
  function ex5ClearSunSpots(){
    try{ wordLane.querySelectorAll(".sunSpot").forEach(el => el.remove()); }catch(_){/* ignore */}
  }


  let ex2Active = false;
  let ex2NextShuffleAtMs = 0;
  let ex2CycleSec = 0;

  // Extra Stage 2 phases (time-based)
  let ex2Phase = 0; // 1..5 (0 = inactive)
  let ex2Phase2Announced = false;
  let ex2Phase3Announced = false;
  let ex2Phase4Announced = false;
let ex2PhaseSpawnCount = 0; // counts falling spawns within the current phase

  // Extra Stage 2: clear condition (survival) — clear ONLY when the stage BGM ends
  let ex2ClearOnBgmEndActive = false;
  let ex2ClearOnBgmEndSrc = "";
  const EX2_PHASE1_END_SEC = 40;
  const EX2_PHASE2_END_SEC = 68;
  const EX2_PHASE3_END_SEC = 98;



  function showEx2Timer(show){
    if(!ex2Timer) return;
    ex2Timer.classList.toggle("show", !!show);
  }

  function showEx2EndTimer(show){
    if(!ex2EndTimer) return;
    ex2EndTimer.classList.toggle("show", !!show);
  }

  function stopEx2Mechanic(){
    ex2Active = false;
    ex2NextShuffleAtMs = 0;
    ex2CycleSec = 0;
    showEx2Timer(false);
  }

  function startEx2Mechanic(){
    if(!(gameState === "playing" && isExtraStage2())){
      stopEx2Mechanic();
      return;
    }
    ex2Active = true;
    ex2CycleSec = ex2CycleSeconds() || 5;
    ex2NextShuffleAtMs = nowMs() + ex2CycleSec * 1000;
    showEx2Timer(true);
    updateEx2Mechanic();
  }

  function pickRandomDifferent(stage, curPrompt, curAnswer){
    const arr = stage?.words || [];
    if(arr.length === 0) return { prompt: curPrompt, answer: curAnswer };

    let choice = null;
    for(let i=0;i<12;i++){
      const w = arr[Math.floor(Math.random() * arr.length)];
      if((w.prompt !== curPrompt) || (w.answer !== curAnswer)){
        choice = w;
        break;
      }
    }
    if(!choice) choice = arr[Math.floor(Math.random() * arr.length)];
    return { prompt: choice.prompt, answer: choice.answer };
  }

  function ex2ShuffleHighlightedWords(){
    if(!isExtraStage2()) return;
    const stage = STAGES[stageIndex];
    const targets = wordsOnField.filter(w => w && w.ex2Highlighted);
    if(targets.length === 0) return;

    for(const w of targets){
      const nw = pickRandomDifferent(stage, w.prompt, w.answer);
      w.prompt = nw.prompt;
      w.answer = nw.answer;
      w.answerNorm = normalizeAnswer(w.answer);

      if(w.promptEl){
        w.promptEl.textContent = w.prompt;
      }
      const aEl = w.answerEl || (w.el ? w.el.querySelector(".answer") : null);
      if(aEl){
        aEl.textContent = w.hidePromptWhileFalling ? makeUnreadableAnswer(w.answer) : w.answer;
      }
    }
  }

    let ex2TimerLastText = "";
    let ex2EndTimerLastText = "";

  function updateEx2Mechanic(){
    if(!(gameState === "playing" && isExtraStage2() && ex2Active)){
      showEx2Timer(false);
      showEx2EndTimer(false);
      return;
    }

    // Ensure the timers are visible again after pauses/continues
    showEx2Timer(true);

    // EX2 stage-end countdown (clears when the EX2 BGM ends)
    if(ex2ClearOnBgmEndActive){
      showEx2EndTimer(true);
      let txt = "残り --:--";
      if(Number.isFinite(bgm.duration) && bgm.duration > 0){
        const ct = (Number.isFinite(bgm.currentTime) ? bgm.currentTime : 0);
        const remain = Math.max(0, bgm.duration - ct);
        txt = `残り ${formatTime(remain)}`;
      }
      if(ex2EndTimer && txt !== ex2EndTimerLastText){
        ex2EndTimerLastText = txt;
        ex2EndTimer.textContent = txt;
      }
    }else{
      showEx2EndTimer(false);
      ex2EndTimerLastText = "";
    }

    const now = nowMs();
    const desired = ex2CycleSeconds() || 5;

    // If we switched into the "below half HP" mode mid-cycle, shorten the remaining time if needed
    if(desired !== ex2CycleSec){
      const remaining = (ex2NextShuffleAtMs - now) / 1000;
      if(remaining > desired){
        ex2NextShuffleAtMs = now + desired * 1000;
      }
      ex2CycleSec = desired;
    }

    const left = Math.max(0, (ex2NextShuffleAtMs - now) / 1000);
    if(ex2Timer){
      const txt = `変化まで ${Math.ceil(left)}秒`;
      if(txt !== ex2TimerLastText){
        ex2TimerLastText = txt;
        ex2Timer.textContent = txt;
      }
    }

    if(now >= ex2NextShuffleAtMs){
      ex2ShuffleHighlightedWords();
      ex2CycleSec = ex2CycleSeconds() || desired || 5;
      ex2NextShuffleAtMs = nowMs() + ex2CycleSec * 1000;
    }
  }


  // ---- Extra Stage 2 mechanic: hacked freeze cycle ----
  // Every 4 active seconds, existing words are hacked/frozen for 4 seconds.
  // After each freeze, hacked words become the longest available word.
  // A word can only be hacked once, and each freeze can hack at most 2 words.
  // Below half boss HP, each completed freeze ramps spawn/fall speed upward.
  const EX2_HACK_ACTIVE_SEC = 4;
  const EX2_HACK_FREEZE_SEC = 4;
  const EX2_HACK_MAX_WORDS = 2;
  const EX2_HACK_SPAWN_RAMP = 1.12;
  const EX2_HACK_FALL_RAMP = 1.08;
  const EX2_HACK_MAX_SPAWN_MULT = 2.35;
  const EX2_HACK_MAX_FALL_MULT = 1.85;

  let ex2HackActive = false;
  let ex2HackNextStartMs = 0;
  let ex2HackReleaseMs = 0;
  let ex2HackSpawnMult = 1;
  let ex2HackFallMult = 1;

  function isExtraStage2Hack(){
    return (currentMode === "extra" && stageIndex === 1 && gameState === "playing");
  }

  function ex2HackLongestWord(){
    const stage = STAGES[stageIndex] || {};
    const arr = Array.isArray(stage.words) ? stage.words : [];
    if(arr.length === 0) return null;

    let best = null;
    let bestLen = -1;
    for(const w of arr){
      if(!w || !w.prompt || !w.answer) continue;
      const len = String(w.answer || "").replace(/[^A-Za-z]/g, "").length || String(w.answer || "").length;
      if(len > bestLen){
        best = w;
        bestLen = len;
      }
    }
    return best || arr[0] || null;
  }

  function ex2HackSetWord(w, hacked){
    if(!w || !w.el) return;
    w.ex2Hacked = !!hacked;
    w.el.classList.toggle("ex2Hacked", !!hacked);
    if(w.tagEl){
      w.tagEl.textContent = hacked ? "HACKED" : "";
    }
  }

  function ex2HackApplyLongestWord(w){
    const longest = ex2HackLongestWord();
    if(!w || !longest) return;

    w.prompt = longest.prompt;
    w.answer = longest.answer;
    w.answerNorm = normalizeAnswer(w.answer);
    w.hidePromptWhileFalling = false;
    w.ex2Obscured = false;

    try{ w.el && w.el.classList.remove("obscured"); }catch(_){}
    if(w.promptEl) w.promptEl.textContent = w.prompt;
    if(w.answerEl) w.answerEl.textContent = w.answer;
  }

  function ex2HackStartFreeze(){
    if(!isExtraStage2Hack()) return;

    const targets = wordsOnField
      .filter(w => w && !w.foxfireHidden && !w.ex2Hacked && !w.ex2HackUsed && (w.state === "falling" || w.state === "landed"))
      .sort((a,b) => (b.y || 0) - (a.y || 0))
      .slice(0, EX2_HACK_MAX_WORDS);
    ex2HackActive = true;
    ex2HackReleaseMs = nowMs() + EX2_HACK_FREEZE_SEC * 1000;

    for(const w of targets){
      w.ex2HackUsed = true;
      ex2HackSetWord(w, true);
    }

    showEx2Timer(true);
    pushMsg(`⚡ HACKED! ${targets.length} word(s) frozen.`, true);
  }

  function ex2HackEndFreeze(){
    const hacked = wordsOnField.filter(w => w && w.ex2Hacked);

    for(const w of hacked){
      ex2HackApplyLongestWord(w);
      ex2HackSetWord(w, false);
    }

    ex2HackActive = false;
    ex2HackReleaseMs = 0;
    ex2HackNextStartMs = nowMs() + EX2_HACK_ACTIVE_SEC * 1000;

    if(bossMaxHp > 0 && bossHp < (bossMaxHp / 2)){
      ex2HackSpawnMult = Math.min(EX2_HACK_MAX_SPAWN_MULT, ex2HackSpawnMult * EX2_HACK_SPAWN_RAMP);
      ex2HackFallMult = Math.min(EX2_HACK_MAX_FALL_MULT, ex2HackFallMult * EX2_HACK_FALL_RAMP);
      pushMsg("⚡ Syntax's hack speeds up the stage!", true);
    }

    showEx2Timer(true);
    restackDirty = true;
  }

  function resetEx2HackMechanic(){
    ex2HackActive = false;
    ex2HackNextStartMs = 0;
    ex2HackReleaseMs = 0;
    ex2HackSpawnMult = 1;
    ex2HackFallMult = 1;

    for(const w of wordsOnField){
      if(!w) continue;
      w.ex2HackUsed = false;
      if(w.ex2Hacked) ex2HackSetWord(w, false);
    }
    showEx2Timer(false);
  }

  function startEx2HackMechanic(){
    resetEx2HackMechanic();
    if(!isExtraStage2Hack()) return;
    ex2HackNextStartMs = nowMs() + EX2_HACK_ACTIVE_SEC * 1000;
    showEx2Timer(true);
  }

  function updateEx2HackMechanic(){
    if(!(gameState === "playing" && currentMode === "extra" && stageIndex === 1)){
      if(ex2HackActive || ex2HackNextStartMs || ex2HackReleaseMs) resetEx2HackMechanic();
      return;
    }

    const now = nowMs();

    if(ex2HackActive){
      const left = Math.max(0, (ex2HackReleaseMs - now) / 1000);
      showEx2Timer(true);
      if(ex2Timer){
        ex2Timer.textContent = `解除まで ${Math.ceil(left)}秒`;
      }
      if(now >= ex2HackReleaseMs){
        ex2HackEndFreeze();
      }
      return;
    }

    if(!ex2HackNextStartMs){
      ex2HackNextStartMs = now + EX2_HACK_ACTIVE_SEC * 1000;
    }

    const left = Math.max(0, (ex2HackNextStartMs - now) / 1000);
    showEx2Timer(true);
    if(ex2Timer){
      ex2Timer.textContent = `HACKまで ${Math.ceil(left)}秒`;
    }

    if(now >= ex2HackNextStartMs){
      ex2HackStartFreeze();
    }
  }


  // ---- Extra Stage 4 mechanic: survive phases until BGM ends ----
  function isExtraStage4(){
    return false;
  }

  let ex4Phase = 0; // 1..5
  let ex4SpawnEnabled = false;

  // Shuffle queue: every 2 doubles/triples, shuffle those words after 5 seconds
  let ex4BatchIds = [];
  let ex4ShuffleQueue = []; // {atMs:number, ids:number[]}

  // EX4 constants (seconds from stage start)
  const EX4_T_PHASE2 = 25;
  const EX4_T_PHASE3 = 71;
  const EX4_T_PHASE4 = 134;
  const EX4_T_PHASE5 = 157;

  let nextGroupId = 1;

  function showEx4Timer(show){
    if(!ex4Timer) return;
    ex4Timer.classList.toggle("show", !!show);
  }

  function ex4GroupSize(){
    if(!isExtraStage4()) return 1;
    if(ex4Phase === 2 || ex4Phase === 3) return 2;
    if(ex4Phase === 5) return 3;
    return 1;
  }

  function ex4ClearShuffleState(){
    ex4BatchIds = [];
    ex4ShuffleQueue = [];
  }

  function ex4QueueShuffleIfReady(){
    const need = (ex4Phase === 3) ? 4 : (ex4Phase === 5 ? 6 : 0);
    if(!need) return;

    while(ex4BatchIds.length >= need){
      const ids = ex4BatchIds.splice(0, need);
      ex4ShuffleQueue.push({ atMs: nowMs() + 5000, ids });
    }
  }

  function ex4DoShuffle(ids){
    for(const id of ids){
      const w = wordsOnField.find(x => x.id === id);
      if(!w || w.foxfireOrigin) continue; // Preserve Foxfire's original shortest-first order.
      // pick a different word if possible
      const before = `${w.prompt}||${w.answer}`;
      let picked = null;
      for(let tries=0; tries<8; tries++){
        const cand = pickStageWord();
        if(!cand) continue;
        const after = `${cand.prompt}||${cand.answer}`;
        if(after !== before){
          picked = cand;
          break;
        }
      }
      if(!picked) picked = pickStageWord();
      if(!picked) continue;

      w.prompt = picked.prompt;
      w.answer = picked.answer;
      w.answerNorm = normalizeAnswer(w.answer);

      const pEl = w.promptEl || w.el.querySelector(".prompt");
      if(pEl) pEl.textContent = w.prompt;

      // IMPORTANT: update the visible English too, otherwise players will type what they see
      // and the internal answer may have already changed (EX4 shuffle phases).
      const aEl = w.answerEl || w.el.querySelector(".answer");
      if(aEl){
        aEl.textContent = w.hidePromptWhileFalling ? makeUnreadableAnswer(w.answer) : w.answer;
      }
    }
  }

  function ex4UpdateShuffleQueue(){
    if(!isExtraStage4()) return;
    if(!(gameState === "playing")) return;
    const now = nowMs();
    for(let i=ex4ShuffleQueue.length - 1; i>=0; i--){
      const ev = ex4ShuffleQueue[i];
      if(now >= ev.atMs){
        ex4DoShuffle(ev.ids);
        ex4ShuffleQueue.splice(i, 1);
      }
    }
  }

    let ex4TimerLastText = "";

  function updateEx4Timer(){
    if(!(gameState === "playing" && isExtraStage4())){
      showEx4Timer(false);
      return;
    }
    showEx4Timer(true);

    let txt = "残り --:--";
    if(Number.isFinite(bgm.duration) && bgm.duration > 0){
      const ct = (Number.isFinite(bgm.currentTime) ? bgm.currentTime : 0);
      const remain = Math.max(0, bgm.duration - ct);
      txt = `残り ${formatTime(remain)}`;
    }
    if(txt !== ex4TimerLastText){
      ex4TimerLastText = txt;
      ex4Timer.textContent = txt;
    }
  }

    function ex4Prestack(n){
      const h = laneHeight();
  
      // Extra Stage 4 Phase 1: randomly obscure 3 of the pre-stacked English answers
      const obscureCount = (isExtraStage4() && ex4Phase === 1) ? Math.min(3, n) : 0;
      const obscureSet = new Set();
      while(obscureSet.size < obscureCount){
        obscureSet.add(Math.floor(Math.random() * n));
      }
  
      for(let i=0;i<n;i++){
        const cand = pickStageWord();
        if(!cand) continue;
  
        const shouldObscure = obscureSet.has(i);
        const shownAnswer = shouldObscure ? makeUnreadableAnswer(cand.answer) : cand.answer;
  
        const el = document.createElement("div");
        el.className = "word landed" + (shouldObscure ? " obscured" : "");
        el.innerHTML = `<div class="prompt" title="${escapeHtml(cand.prompt)}">${escapeHtml(cand.prompt)}</div>
          <div class="right">
            <span class="tag"></span>
            <span class="answer muted" title="${escapeHtml(shownAnswer)}">${escapeHtml(shownAnswer)}</span>
          </div>`;
        wordLane.appendChild(el);
  
        const y = h - 30 * (i + 1);
        const obj = {
          id: nextWordId++,
          prompt: cand.prompt,
          answer: cand.answer,
          answerNorm: normalizeAnswer(cand.answer),
          y,
          state: "landed",
          el,
          promptEl: el.querySelector(".prompt"),
          answerEl: el.querySelector(".answer"),
          tagEl: el.querySelector(".tag"),
          hidePromptWhileFalling: shouldObscure, // keep obscured even while landed
          ex2Highlighted: false,
          fallMult: 1,
          ex3Ghost: false,
        };
        setWordY(el, y);
        wordsOnField.push(obj);
        fitAnswerToRight(el);
      }
      restackLanded();
    }

  function ex4ShowFakeDeath(show){
    if(!show){
      showOverlay(false);
      return;
    }
    // Fake death overlay that doesn't clear
    setOverlayText("GIVE UP", "", "");
    overlay.style.cursor = "default";
    showOverlay(true);
  }

  const ex4Laugh = new Audio();
  ex4Laugh.preload = "auto";

  // EX4 Phase 4: reset scare image overlay (sync to ex4 laugh BGM duration)
  let ex4ResetAnim = null;

  function ex4PrepareLaugh(){
    const stage = STAGES[stageIndex];
    const src = stage?.ex4LaughBgm || "";
    if(!src) return;
    if(ex4Laugh.src !== src){
      ex4Laugh.src = src;
    }
    try{ ex4Laugh.load(); }catch(_){}
  }

  function ex4WaitLaughDurationMs(timeoutMs = 300){
    return new Promise((resolve) => {
      const d0 = ex4Laugh.duration;
      if(Number.isFinite(d0) && d0 > 0){
        resolve(Math.round(d0 * 1000));
        return;
      }

      let done = false;
      const finish = (ms) => {
        if(done) return;
        done = true;
        ex4Laugh.removeEventListener("loadedmetadata", onMeta);
        ex4Laugh.removeEventListener("durationchange", onMeta);
        resolve(ms);
      };

      const onMeta = () => {
        const d = ex4Laugh.duration;
        finish((Number.isFinite(d) && d > 0) ? Math.round(d * 1000) : 2500);
      };

      ex4Laugh.addEventListener("loadedmetadata", onMeta, { once:true });
      ex4Laugh.addEventListener("durationchange", onMeta, { once:true });
      setTimeout(() => finish(2500), timeoutMs);
    });
  }

  function ex4StopResetScare(fast = false){
    if(!ex4ResetScare) return;

    if(ex4ResetAnim){
      try{ ex4ResetAnim.cancel(); }catch(_){}
      ex4ResetAnim = null;
    }

    if(fast){
      // Requirement: fade out immediately when entering phase 5
      ex4ResetScare.style.transition = "none";
      ex4ResetScare.style.opacity = "0";
      return;
    }

    ex4ResetScare.style.opacity = "0";
  }

  async function ex4PlayResetScare(){
    if(!ex4ResetScare) return;

    // Ensure metadata is available so the fade matches the laugh BGM duration
    ex4PrepareLaugh();
    playEx4Laugh();

    const durationMs = await ex4WaitLaughDurationMs(350);

    // Restart animation from 0 every time
    ex4StopResetScare(false);
    ex4ResetScare.style.transition = "none";
    ex4ResetScare.style.opacity = "0";
    void ex4ResetScare.offsetWidth;

    ex4ResetAnim = ex4ResetScare.animate(
      [{opacity:0},{opacity:0.8, offset:0.5},{opacity:0}],
      {duration: Math.max(300, durationMs), easing:"linear", fill:"forwards"}
    );
    ex4ResetAnim.onfinish = () => {
      ex4ResetAnim = null;
      ex4ResetScare.style.opacity = "0";
    };
  }

  function playEx4Laugh(){
    const stage = STAGES[stageIndex];
    const src = stage?.ex4LaughBgm || "";
    if(!src) return;
    if(isMuted) return;

    try{
      ex4Laugh.pause();
      ex4Laugh.currentTime = 0;
    }catch(_){}

    ex4Laugh.src = src;
    ex4Laugh.loop = false;
    ex4Laugh.volume = clamp(lastVol * 2.5, 0, 1); // 2.5x louder for EX4 laugh BGM

    ex4Laugh.play().catch(()=>{});
  }

  function ex4HandlePhaseEnter(newPhase){
    ex4Phase = newPhase;

    // EX4: swap boss art by phase group (1–2 / 3–4 / 5)
    const ex4Stage = STAGES[stageIndex];
    if(ex4Stage && isExtraStage4()){
      const desiredVariant = (ex4Phase === 5) ? 3 : (ex4Phase >= 3 ? 2 : 1);
      if(bossVariantPhase !== desiredVariant){
        bossVariantPhase = desiredVariant;
        // async swap; no need to await
        setBossVariant(ex4Stage, desiredVariant);
      }
    }

    // Always reset shuffle batch when switching phases
    ex4ClearShuffleState();

    if(ex4Phase === 1){
      // Phase 1: start with 5 words already stacked; no spawns
      ex4SpawnEnabled = false;
      showOverlay(false);
      setInputsEnabled(true);
      resetField({ preservePermafrost: isNormalStage5() });
      ex4Prestack(5);
      spawnAccMs = 0;
      return;
    }

    if(ex4Phase === 2){
      ex4SpawnEnabled = true;
      showOverlay(false);
      setInputsEnabled(true);
      spawnAccMs = 0;
      return;
    }

    if(ex4Phase === 3){
      ex4SpawnEnabled = true;
      showOverlay(false);
      setInputsEnabled(true);
      spawnAccMs = 0;
      showBossBubble("I\'ll show you crazy!", 5000);
      return;
    }

    if(ex4Phase === 4){
      // Clear stack + stop spawns + fake death overlay
      ex4SpawnEnabled = false;
      resetField();
      spawnAccMs = 0;
      setInputsEnabled(false);
      ex4PrepareLaugh();
      ex4ShowFakeDeath(true);
      return;
    }

    if(ex4Phase === 5){
      // Resume play, remove fake death prompts
      ex4SpawnEnabled = true;
      // If the reset scare image is showing, fade it out immediately on Phase 5
      ex4StopResetScare(true);
      showOverlay(false);
      setInputsEnabled(true);
      spawnAccMs = 0;
      showBossBubble("Let\'s end this!", 5000);
      return;
    }
  }

  function ex4HandlePhaseTriggers(elapsedSec){
    if(!(gameState === "playing" && isExtraStage4())) return;

    let target = 1;
    if(elapsedSec >= EX4_T_PHASE5) target = 5;
    else if(elapsedSec >= EX4_T_PHASE4) target = 4;
    else if(elapsedSec >= EX4_T_PHASE3) target = 3;
    else if(elapsedSec >= EX4_T_PHASE2) target = 2;

    if(target !== ex4Phase){
      ex4HandlePhaseEnter(target);
    }
  }

  function ex4OnGroupSpawn(ids){
    if(!(isExtraStage4() && (ex4Phase === 3 || ex4Phase === 5))) return;
    ex4BatchIds.push(...ids);
    ex4QueueShuffleIfReady();
  }

  function updateEx4Mechanic(){
    updateEx4Timer();
    ex4UpdateShuffleQueue();

    // Keep EX4 overlay text correct if blocked reset got triggered
    if(gameState === "playing" && isExtraStage4() && ex4Phase === 4){
      // ensure overlay stays on
      showOverlay(true);
      overlayTitle.textContent = "GIVE UP";
    }
  }


  function spawnOneWord(opts = {}){
    if(gameState !== "playing") return null;
    if(!opts.forceOperatorSpawn && operatorSpawnPaused() && (opts.state||'falling')==='falling')return null;

    const state = opts.state || "falling";
    const operatorHexSummoned=!!opts.operatorHexSummoned;
    const countSpawn = (opts.countSpawn !== false);
    const nextSpawnCount = spawnCountThisStage + ((countSpawn && state === "falling") ? 1 : 0);
    const willBeChallengeComet = challengeWouldBeCometForCount(nextSpawnCount);

    const stagePick = (opts.prompt != null && opts.answer != null)
      ? {prompt: opts.prompt, answer: opts.answer}
      : pickStageWord({ preferShort: willBeChallengeComet });

    if(!stagePick) return null;
    const {prompt, answer} = stagePick;

    if(countSpawn && state === "falling") spawnCountThisStage++;
    // Extra Stage 1: every 3rd spawned word becomes a shooting star.
    const ex1Freq = ex1HighlightFrequency();
    const ex1Highlighted = (!operatorHexSummoned && state === "falling" && ex1Freq > 0 && (spawnCountThisStage % ex1Freq === 0));

    // Old EX1 variable-speed/ghost phase mechanics are removed.
    const ex1FallMult = 1;
    const ex1FallSpeedOverride = null;
    const ex1Ghost = false;
    const ex1FrostTarget = ex1Highlighted;

    // Extra Stage 2: time-based phases obscure the English every N spawns (per-phase cadence)
    let ex2ShouldObscure = false;
    if(!operatorHexSummoned && isExtraStage2() && state === "falling" && countSpawn){
      const n = (ex2Phase === 1) ? 3 : (ex2Phase >= 2 ? 2 : 0);
      if(n > 0){
        ex2PhaseSpawnCount++;
        ex2ShouldObscure = (ex2PhaseSpawnCount % n === 0);
      }
    }

    let hidePromptWhileFalling = ex2ShouldObscure;
    const shouldObscureAnswer = hidePromptWhileFalling;

// Extra Stage 2 Phase 4+: all words ignore collision while falling and fall at different rates
const ex2Phase4Plus = (!operatorHexSummoned && isExtraStage2() && ex2Phase >= 4 && state === "falling");
const ex2IgnoreCollision = ex2Phase4Plus;
const ex2FallMult = ex2Phase4Plus ? ex2RandomFallMult() : 1;

    // Extra Stage 2: every Nth word highlighted (phase mechanics removed: constant frequency)
    const ex2Freq = ex2HighlightFrequency();
    const ex2Highlighted = (!operatorHexSummoned && state === "falling" && ex2Freq > 0 && (spawnCountThisStage % ex2Freq === 0));

    // Normal Stage 5 mechanic removed: no special highlighted/frozen words.
    const s5Highlighted = false;

    // Extra Stage 3: every other word becomes a ghost word.
    const ex3Freq = ex3SpecialFrequency();
    const ex3Special = (!operatorHexSummoned && state === "falling" && ex3Freq > 0 && (spawnCountThisStage % ex3Freq === 0));
    const ex3FallMult = ex3Special ? ex3RandomFallMult() : 1;

    // Extra Stage 4: every Nth spawned word becomes infected.
    const ex4Freq = ex4InfectFrequency();
    const ex4Infected = (!operatorHexSummoned && state === "falling" && countSpawn && !opts.preventEx4Infection && ex4Freq > 0 && (spawnCountThisStage % ex4Freq === 0));

    // Challenge: star-struck every 3, comet every 4; after 60s special words become both; after 120s all words become both.
    const challengeComet = (!operatorHexSummoned && state === "falling" && countSpawn && challengeIsCometSpawn());
    const challengeStarStruck = (!operatorHexSummoned && state === "falling" && countSpawn && challengeIsStarStruckSpawn());

    // Extra Stage 5: every Nth spawned word becomes star-struck.
    const ex5Freq = ex5StarStruckFrequency();
    const ex5StarStruck = challengeStarStruck || (!operatorHexSummoned && state === "falling" && countSpawn && ex5Freq > 0 &&
      (window.RPG_BALANCE?.mechanic('star_struck','enabled',true)!==false) &&
      (()=>{const pct=window.RPG_BALANCE?.mechanic('star_struck','chancePct',-1)??-1;
        return pct>=0?Math.random()*100<pct:(((spawnCountThisStage-1)%ex5Freq)===0)})());

    const el = document.createElement("div");
    el.className = "word"
            + (shouldObscureAnswer ? " obscured" : "")
      + ((ex1Ghost || ex3Special) ? " ghost" : "")
      + (ex3Special ? " ex3GhostWord" : "")
      + (ex4Infected ? " ex4Infected" : "")
      + (ex5StarStruck ? " ex5StarStruck" : "")
      + (challengeComet ? " challengeComet" : "")
      + (ex1FrostTarget ? " ex1Target ex1ShootingStar" : "")
      + (ex2Highlighted ? " ex2Target" : "");

    const shownPrompt = prompt;
    const shownAnswer = shouldObscureAnswer ? makeUnreadableAnswer(answer) : answer;
    el.innerHTML = `<div class="prompt">${escapeHtml(shownPrompt)}</div>
      <div class="right">
        <span class="tag"></span>
        <span class="answer muted">${escapeHtml(shownAnswer)}</span>
      </div>`;
    wordLane.appendChild(el);

    const y = (opts.y != null) ? opts.y : -30;

    const obj = {
      id: nextWordId++,
      prompt,
      answer,
      answerNorm: normalizeAnswer(answer),
      y,
      state,
      el,
      promptEl: el.querySelector(".prompt"),
      answerEl: el.querySelector(".answer"),
      tagEl: el.querySelector(".tag"),
      hidePromptWhileFalling: shouldObscureAnswer,
      ex1Highlighted: ex1FrostTarget,
      ex1DeadlineMs: 0,
      ex1CountdownMs: 0,
      ex1Permafrost: false,
      ex1DamageArmed: false,
      ex1Ghost,
      ex2Obscured: hidePromptWhileFalling,
      ex2Highlighted,
      ex2Hacked: false,
      ex2HackUsed: false,
      s5Highlighted,
      s5FrostArmed: false,
      s5FrostDeadlineSec: 0,
      s5FrostLastShown: null,
      s5Permafrost: false,
      ignoreCollision: (ex2IgnoreCollision || challengeComet),
      challengeComet,
      challengeStarStruck,
      ex2FallMult: ex2FallMult,
      fallMult: ex3FallMult,
      fallSpeedOverride: ex1FallSpeedOverride,
      ex3Ghost: ex3Special,
      ex3DeadlineMs: 0,
      ex3CountdownMs: 0,
      ex3ExpiredGhost: false,
      ex4Infected,
      ex4DeadlineMs: 0,
      ex4CountdownMs: 0,
      ex4Multiplied: false,
      ex5StarStruck,
      groupId: opts.groupId || 0,
      groupIndex: opts.groupIndex || 0,
      spawnBaseCount: (Number.isFinite(opts.spawnBaseCount) ? opts.spawnBaseCount : undefined),
    };
if(state === "landed"){
      obj.hidePromptWhileFalling = (obj.hidePromptWhileFalling || (obj.ex2Obscured ? true : false));
      if(obj.ex3Ghost){
        obj.el.classList.add("ex3GhostWord");
        ex3ArmGhostTimer(obj);
      }
      if(obj.ex4Infected){
        obj.el.classList.add("ex4Infected");
        ex4ArmInfectionTimer(obj);
      }
      if(obj.ex5StarStruck){
        obj.el.classList.add("ex5StarStruck");
      }
      if(obj.challengeComet){
        obj.el.classList.add("challengeComet");
      }
      obj.ex2Highlighted = false;
      el.classList.add("landed");
      // ensure prompt is readable
      const pEl = obj.promptEl || el.querySelector(".prompt");
      if(pEl) pEl.textContent = obj.prompt;
      const tEl = obj.tagEl || el.querySelector(".tag");
      if(tEl) tEl.textContent = "";
    }
    // EX1 shooting star: visible marker while falling.
    if(ex1FrostTarget){
      try{ obj.tagEl && (obj.tagEl.textContent = "★"); }catch(_){/* ignore */}
    }
    if(ex4Infected){
      try{ obj.tagEl && (obj.tagEl.textContent = "⚠️"); }catch(_){/* ignore */}
    }
    if(challengeComet && ex5StarStruck){
      try{ obj.tagEl && (obj.tagEl.textContent = "☄️☀️"); }catch(_){/* ignore */}
    }else if(challengeComet){
      try{ obj.tagEl && (obj.tagEl.textContent = "☄️"); }catch(_){/* ignore */}
    }else if(ex5StarStruck){
      try{ obj.tagEl && (obj.tagEl.textContent = "☀️"); }catch(_){/* ignore */}
    }
    if(obj.challengeComet) challengeUpdateCometGlow(obj, 0);
    setWordY(el, obj.y);
    wordsOnField.push(obj);
    const nitrateSpawnMark=operatorPassive?.onWordSpawn?.(obj,playerHp);
    if(nitrateSpawnMark?.type==='nitrate-mark')applyOperatorFieldEffect(nitrateSpawnMark);
    // Hex new timed spawns immediately, without modifying the spawn schedule.
    if(!operatorHexSummoned&&operatorPassive?.isChainCleaveActive(stageElapsedSec()))hexWord(obj);
    if(state==='falling'&&!opts.skipMechanicHooks && currentMode!=='shared')mechanicEvent('onSpawn',obj,{spawnCount:spawnCountThisStage});
    // Panic consumes a normal spawn; never generate extra words or interfere with operator marks.
    if(state==='falling'&&countSpawn&&!opts.skipMechanicHooks&&currentMode==='story')window.RPG_CH1_SPECIAL?.markSpawn(obj,stageElapsedSec(),wordsOnField);
    return obj;
  }

  function spawnWordGroup(size){
    if(gameState !== "playing") return;
    const gid = nextGroupId++;

    // include current falling words (non-ghost) so groups don't overlap them
    const baseCount = wordsOnField.filter(w => (w.state === "landed") || (w.state === "falling" && !w.ex3Ghost)).length;

    const ids = [];
    for(let i=0;i<size;i++){
      const obj = spawnOneWord({
        state: "falling",
        y: -30 - 30 * i,
        groupId: gid,
        groupIndex: i,
        spawnBaseCount: baseCount,
      });
      if(obj) ids.push(obj.id);
    }
    ex4OnGroupSpawn(ids);
  }

  function spawnWord(){
    if(gameState !== "playing") return;

    // Extra Stage 4: phase-based spawning (none / doubles / triples)
    if(isExtraStage4()){
      if(!ex4SpawnEnabled) return;
      const size = ex4GroupSize();
      if(size > 1){
        spawnWordGroup(size);
      }else{
        spawnOneWord();
      }
      return;
    }

    // Default: single word
    spawnOneWord();
  }

  function normalizeAnswer(s){
    // Normalize input/answers to reduce "correct but marked wrong" edge cases
    // (mobile punctuation, full-width characters, zero-width spaces, etc.)
    return String(s)
      .normalize("NFKC")
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[.,!?;:]+$/g, "");
  }

  function removeWord(id){
    const idx = wordsOnField.findIndex(w => w.id === id);
    if(idx === -1) return;

    wordsOnField[idx].el.remove();
    wordsOnField.splice(idx,1);
    restackDirty = true; // defer restack to next frame for performance
  }

  
  async function setBossVariant(stage, phase){
    let normal = stage.bossFile || "";

    if(phase === 2){
      normal = stage.bossFile2 || stage.bossFile || "";
    }else if(phase === 3){
      normal = stage.bossFile3 || stage.bossFile2 || stage.bossFile || "";
    }

    bossNormalSrc = normal;
    // Chapter artwork may be illustrated rather than pixel art.
    bossImg.style.imageRendering = currentMode === "story" ? "auto" : "";

    bossImg.style.display = "none";
    bossFallback.style.display = "grid";
    bossFallback.textContent = stage.bossName || "BOSS";

    const nextBossSrc = bossNormalSrc || "";
    const prevBossAttr = bossImg.dataset.sourceSrc || bossImg.getAttribute("src") || "";
    setImageSource(bossImg, nextBossSrc, {
      onload: () => { bossImg.style.display = "block"; bossFallback.style.display = "none"; },
      onerror: () => { bossImg.style.display = "none"; bossFallback.style.display = "grid"; }
    });

    // If the source didn't change, some browsers won't fire onload again.
    // In that case, immediately sync visibility based on the already-loaded image.
    if(prevBossAttr === nextBossSrc && bossImg.complete){
      if(bossImg.naturalWidth > 0){
        bossImg.style.display = "block";
        bossFallback.style.display = "none";
      }else{
        bossImg.style.display = "none";
        bossFallback.style.display = "grid";
      }
    }
  }

  function showBossDamagedBriefly(){
    if(bossImg.style.display !== "block") return;

    // Flash once brightly (no sprite swapping).
    bossImg.classList.remove("bossFlash");
    void bossImg.offsetWidth;
    bossImg.classList.add("bossFlash");
  }

  async function setStageArt(stage){
    bgImg.style.display = "none";
    bgFallback.style.display = "block";
    bgImg.onload = () => { bgImg.style.display = "block"; bgFallback.style.display = "none"; };
    bgImg.onerror = () => { bgImg.style.display = "none"; bgFallback.style.display = "block"; };
    const nextBgSrc = stage.bgFile || "";
    setImageSource(bgImg, nextBgSrc, {
      onload: () => { bgImg.style.display = "block"; bgFallback.style.display = "none"; },
      onerror: () => { bgImg.style.display = "none"; bgFallback.style.display = "block"; }
    });

    await setBossVariant(stage, 1);
  }

  function nowMs(){ return performance.now(); }

  function stageElapsedSec(){
    if(!stagePlayStartMs) return 0;
    const base = nowMs() - stagePlayStartMs;
    const pausedSoFar = stagePausedTotalMs + (stagePauseStartMs ? (nowMs() - stagePauseStartMs) : 0);
    return Math.max(0, (base - pausedSoFar) / 1000);
  }

  function stage5DurationSec(){ return null; }

  function stage5ResetPhase3Ramp(){
    s5p3SpawnMs = null;
    s5p3FallSpeed = null;
  }

  function stage5InitPhase3Ramp(){ /* Stage 5 mechanic removed. */ }
  function stage5Phase3RampOnBossHit(){ /* Stage 5 mechanic removed. */ }

  function stage5CurrentFallSpeed(_elapsed){
    const s = STAGES[stageIndex] || STAGES[4];
    return window.RPG_BALANCE?.get('fallSpeedPxPerSec',s ? s.fallSpeedPxPerSec : 50) ?? (s ? s.fallSpeedPxPerSec : 50);
  }

  function stage5CurrentSpawnMs(_elapsed){
    const s = STAGES[stageIndex] || STAGES[4];
    return window.RPG_BALANCE?.get('spawnEveryMs',s ? s.spawnEveryMs : 3000) ?? (s ? s.spawnEveryMs : 3000);
  }

  async function stage5SetPhase(_targetPhase){ /* Stage 5 mechanic removed. */ }
  function handleStage5PhaseTriggers(){ /* Stage 5 mechanic removed. */ }
  async function stage5WinByBgmEnd(){ /* Stage 5 mechanic removed. */ }

  bgm.addEventListener("ended", () => {
    if(gameState !== "playing") return;

    const stage = STAGES[stageIndex];

    // Stage 5 clears by boss HP, not BGM ending.
    if(stageIndex === 4){
      return;
    }


    // EX Stage 4: win by BGM end
    if(stage && stage.endStageOnBgmEnd){
      (async () => {
        if(gameState !== "playing") return;
        setInputsEnabled(false);
        hideBossBubble();
        showStage5Timer(false);
        showEx4Timer(false);

        await showStageClearScreen(stage);
        try{ requestCloudCheckpointSave("stage-clear"); }catch(_){/* ignore */}
        onVictory();
      })();
    }
  });

  function findMatchAndClear(input){
    const norm = normalizeAnswer(input);
    if(!norm) return false;

    let best = null;
    let bestRank = -1;

    for(const w of wordsOnField){
      if(!w) continue;
      if(w.ex2Hacked) continue;
      if(w.foxfireHidden) continue;
      if(w.ex3ExpiredGhost) continue;
      if(isExtraStage1() && w.s5Permafrost) continue;
      // answerNorm is cached on spawn/shuffle for speed + reliability
      if((w.answerNorm || normalizeAnswer(w.answer)) !== norm) continue;

      let rank = 0;
      if(rank > bestRank || (rank === bestRank && (!best || w.y > best.y))){
        best = w;
        bestRank = rank;
      }
    }

    if(!best){
      // Extra Stage 2: hacked words are intentionally non-interactive.
      // If the player types a hacked word's answer while it is frozen,
      // ignore the input without counting it as a miss or dealing damage.
      const hackedMatch = wordsOnField.some(w =>
        w && w.ex2Hacked && ((w.answerNorm || normalizeAnswer(w.answer)) === norm)
      );
      if(hackedMatch){
        pushMsg("HACKED — input ignored", true);
        return true;
      }

      const expiredGhostMatch = wordsOnField.some(w =>
        w && w.ex3ExpiredGhost && ((w.ex3ExpiredAnswerNorm || "") === norm)
      );
      if(expiredGhostMatch){
        pushMsg("👻 GHOST — input ignored", true);
        return true;
      }

      if(stage5IsFrozenInput(norm) || ex1IsFrozenInput(norm)){
        pushMsg("FROZEN", true);
        return true;
      }
      return false;
    }

    const pts = best.chainHexed ? calcMaximumHexWordScore(best) : calcWordScore(best);
    guildCorrectThisRun++; // Counts real successful submitted words only.
    addScore(pts);
    // XP gain: 1 XP per correct word
    if(currentMode !== "shared") addXp(1);
    // Validate real answer events against the server reward ledger.
    if(!["story","shared"].includes(currentMode)) try{ window.RPG_REWARDS?.correctWord(best.prompt,best.answer); }catch(_){}

    if(best.ex5StarStruck){
      ex5CreateSunSpotAt(best.y);
    }

    if(currentMode !== 'shared') mechanicEvent('onCorrect',best);
    removeWord(best.id);
    const passiveEffect=operatorOnCorrect(best);
    let bonusDamage=0;
    // Show-Off and Adrenaline Rush can both bonus the same manually typed word.
    // Only manual onCorrect awards these, never automatic clears or spawns.
    if(passiveEffect?.bonusDamage)bonusDamage+=passiveEffect.bonusDamage;
    if(passiveEffect?.type==='boss-bonus')bonusDamage+=passiveEffect.damage;
    if(passiveEffect?.type==='nitrate-release')bonusDamage+=passiveEffect.damage||0;
    if(passiveEffect?.type==='lupa-hit'||passiveEffect?.type==='lupa-complete')bonusDamage+=passiveEffect.damage||0;
    if(passiveEffect?.type==='aveline-cleave'){
      bossHpText?.classList?.remove('operator-weak-point-ready');
      operatorCleaveLowest();
    }
    if(passiveEffect?.type==='auto-eliminate')bonusDamage+=operatorAutoEliminate(passiveEffect.wordId,true);
    if(passiveEffect?.type==='hound-next'||passiveEffect?.type==='hound-complete'){
      bonusDamage+=passiveEffect.damage||0;
    }
    if(passiveEffect?.type==='cassian-decree'){
      bonusDamage+=passiveEffect.missingDamage;
      // Each word actually removed contributes one normal boss hit; missing
      // slots always deal exactly 1 direct damage.
      for(const id of passiveEffect.wordIds){
        bonusDamage+=operatorAutoEliminate(id,true,'cassian');
      }
    }
    // Combine manual and instant secondary damage into ONE boss hit. Otherwise
    // the first hit could finish the stage before the automatic hit is awarded.
    const dmg = baseHitDamage+bonusDamage;
    damageBoss(dmg);
    if(passiveEffect?.forceSpawn && gameState==='playing' && (bossHp>0||operatorStageWithoutBoss())){
      applyOperatorFieldEffect({type:'hound-force-spawn'});
    }

    pushMsg(`HIT! 「${best.prompt}」→ ${best.answer} (+${pts})`);

    // Boss can be invulnerable (EX4), so ensure score UI updates even if no HP changes.
    if(dmg <= 0) updateUI();
    return true;
  }

  function damageBoss(amount){
    if(amount <= 0) return;
    // Extra Stage 2: boss takes no damage (stage clears when BGM ends)
    if(isExtraStage2()) return;

    const stage = STAGES[stageIndex] || null;
    if(currentMode === "practice" || (stage && stage.bossInvulnerable)){
      // Keep feedback, but do not change HP or clear the stage.
      playBossHitSfx();
      showBossDamagedBriefly();
      updateUI();
      return;
    }
    playBossHitSfx();
    showBossDamagedBriefly();

    bossHp = Math.max(0, bossHp - amount);

    // Swap boss art when HP drops strictly below half (if stage.bossFile2 exists).
    // Disabled for Normal mode so boss sprites do not change at half HP.
    // Keep this available for non-Normal modes if you reuse it later.
    const shouldAutoSwapBelowHalf =
      (currentMode !== "normal" && stageIndex >= 0 && stageIndex <= 3);

    if(shouldAutoSwapBelowHalf &&
       bossVariantPhase === 1 && bossHp > 0 && bossHp < (bossMaxHp / 2) &&
       (stage?.bossFile2)){
      bossVariantPhase = 2;
      // async swap; no need to await here
      setBossVariant(stage, 2);
    }

    if(!midFightBubbleShown && stageIndex >= 0 && stageIndex <= 3){
      if(stage?.midFightDialogue && bossHp > 0 && bossHp <= (bossMaxHp / 2)){
        midFightBubbleShown = true;
        showBossBubble(stage.midFightDialogue, 5000);
      }
    }

    updateUI();

    if(bossHp === 0){
      // Extra Stage 2: survival stage — ignore boss HP (clear ONLY on BGM end)
      if(isExtraStage2()){
        return;
      }
      // Extra Stage 1 clears normally by boss HP; old phase-revive mechanic removed.
      onBossDefeated();
    }
  }


  function pauseStageClock(){
    if(stagePauseStartMs == null) stagePauseStartMs = nowMs();
  }
  function resumeStageClock(){
    if(stagePauseStartMs != null){
      stagePausedTotalMs += (nowMs() - stagePauseStartMs);
      stagePauseStartMs = null;
    }
  }

  function cleanupPauseListeners(){
    if(!pauseListeners) return;
    try{ overlayChoices.removeEventListener("click", pauseListeners.onChoiceClick); }catch(_){/* ignore */}
    pauseListeners = null;
  }

  function showPauseOverlay(){
    showOverlay(true);
    overlay.style.cursor = "default";
    overlayTitle.textContent = "Paused";
    overlayDesc.textContent = "";
    overlayHint.textContent = "ESC to resume";
    countdownText.textContent = "";

    overlayChoices.classList.add("show");
    overlayChoices.innerHTML = `
      <button type="button" class="choiceBtn" data-act="resume"><span class="title">RESUME</span></button>
      <button type="button" class="choiceBtn" data-act="modes"><span class="title">← MODE SELECT</span></button>
    `;

    const onChoiceClick = (e) => {
      const btn = e.target.closest(".choiceBtn");
      if(!btn) return;
      const act = btn.getAttribute("data-act");
      if(act === "resume") resumeGame(true);
      if(act === "modes"){
        // Leave from pause deliberately; cancel must keep the current battle paused.
        if(window.confirm('Leave this run and return to Mode Select?')) resetGame(false);
      }
    };

    cleanupPauseListeners();
    pauseListeners = { onChoiceClick };
    overlayChoices.addEventListener("click", onChoiceClick);
  }

  function pauseGame(){
    if(gameState !== "playing") return;

    // Safety: if a resume countdown was somehow running, stop it.
    clearResumeCountdown();
    if(isExtraStage2()){
      pushMsg("⛔ Pause disabled in EX Stage 2", true);
      return;
    }

    gameState = "paused";
    window.RPG_CH1_SPECIAL?.suspend(); // Paused UI must remain visible even during blackout.
    setSleepyBgmGain(1);
    pauseStageClock();

    pausedBgmState = {
      src: currentBgm || (bgm.currentSrc || ""),
      time: Number.isFinite(bgm.currentTime) ? bgm.currentTime : 0,
      loop: !!bgm.loop,
      wasPlaying: !bgm.paused
    };
    try{ bgm.pause(); }catch(_){/* ignore */}

    // Disable input but keep what the user already typed.
    setInputsEnabledSoft(false);

    pushMsg("⏸ PAUSED", true);
    showPauseOverlay();
    updateUI();
  }

  function finishResumeGame(fromGesture=false){
    if(gameState !== "paused") return;

    clearResumeCountdown();

    cleanupPauseListeners();

    gameState = "playing";
    resumeStageClock();

    showOverlay(false);
    try{
      overlayChoices.classList.remove("show");
      overlayChoices.innerHTML = "";
    }catch(_){/* ignore */}
    overlay.style.cursor = "pointer";

    setInputsEnabledSoft(true);

    // Restore BGM (resume same track/time)
    try{
      if(pausedBgmState && pausedBgmState.src){
        const wantSrc = pausedBgmState.src;
        const curSrc = currentBgm || (bgm.currentSrc || "");
        if(curSrc !== wantSrc){
          setBgm(wantSrc, pausedBgmState.loop, false);
        }
        try{ bgm.currentTime = Math.max(0, pausedBgmState.time || 0); }catch(_){/* ignore */}
        if(pausedBgmState.wasPlaying){
          if(fromGesture) tryPlayBgmFromGesture();
          else tryPlayBgm();
        }
      }
    }catch(_){/* ignore */}
    pausedBgmState = null;

    pushMsg("▶ RESUME", true);
    updateUI();
  }

  
  // --- Resume countdown (3s) ---
  let resumeCountdownTimer = null;
  function clearResumeCountdown(){
    if(resumeCountdownTimer){
      clearInterval(resumeCountdownTimer);
      resumeCountdownTimer = null;
    }
    try{ countdownText.textContent = ""; }catch(_){/* ignore */}
  }


  function startResumeCountdown(fromGesture=false){
    if(gameState !== "paused") return;
    if(resumeCountdownTimer) return;

    // The user already "unpaused" — hide the Paused message and show a countdown.
    try{
      overlayTitle.textContent = "";
      overlayDesc.textContent  = "";
      overlayHint.textContent  = "Resuming in...";
      overlayChoices.classList.remove("show");
      overlayChoices.innerHTML = "";
      overlay.style.cursor = "default";
    }catch(_){/* ignore */}

    // Prime audio during the gesture tick so iOS/Safari is less likely to block resume later.
    if(fromGesture){
      try{
        const t = (Number.isFinite(bgm.currentTime) ? bgm.currentTime : 0);
        const wasMuted = !!bgm.muted;
        const wasVol = Number.isFinite(bgm.volume) ? bgm.volume : 1;
        try{ bgm.muted = true; }catch(_){/* ignore */}
        try{ bgm.play(); }catch(_){/* ignore */}
        try{ bgm.pause(); }catch(_){/* ignore */}
        try{ bgm.currentTime = t; }catch(_){/* ignore */}
        try{ bgm.muted = wasMuted; }catch(_){/* ignore */}
        try{ bgm.volume = wasVol; }catch(_){/* ignore */}
      }catch(_){/* ignore */}
    }

    let n = 3;
    countdownText.textContent = String(n);

    resumeCountdownTimer = setInterval(() => {
      if(gameState !== "paused"){
        clearInterval(resumeCountdownTimer);
        resumeCountdownTimer = null;
        countdownText.textContent = "";
        return;
      }

      n -= 1;
      if(n <= 0){
        clearInterval(resumeCountdownTimer);
        resumeCountdownTimer = null;
        countdownText.textContent = "";
        // Not a gesture anymore: rely on the earlier prime + normal play().
        finishResumeGame(false);
      }else{
        countdownText.textContent = String(n);
      }
    }, 1000);
  }

  function resumeGame(fromGesture=false){
    startResumeCountdown(fromGesture);
  }

function togglePause(fromGesture=false){
    if(gameState === "paused") resumeGame(fromGesture);
    else if(gameState === "playing") pauseGame();
  }

function nitrateReleaseVisual(){
    if(!wordLane)return;
    const hit=document.createElement('div');
    hit.className='operator-nitrate-release';
    hit.setAttribute('aria-hidden','true');
    hit.textContent='WRATH · +7';
    wordLane.appendChild(hit);
    setTimeout(()=>hit.remove(),800);
  }
  function nitrateBlockVisual(blocked){
    if(!nitrateShieldEl)return;
    nitrateShieldEl.classList.remove('nitrate-block-impact');
    void nitrateShieldEl.offsetWidth;
    nitrateShieldEl.classList.add('nitrate-block-impact');
    pushMsg(`NITRATE · SHIELD BLOCKED ${blocked} DAMAGE`,true);
  }
function damagePlayer(amount, reason){
    if(amount <= 0) return;
    if(storySquad.enabled&&(gameState==='squad-deploy'||(gameState==='playing'&&stageElapsedSec()<storySquadGraceUntil)))return;
    if(operatorPassive?.isInvulnerable(stageElapsedSec())&&gameState==='playing'){
      // Invulnerability means no lost HP and no recorded damage (including
      // special mechanics, overflow and incorrect submissions).
      return;
    }

    const scaled = Math.max(1, Math.round(amount));
    // Wrath's Shield HP absorbs first; only the remainder reaches ordinary HP.
    // No player-damage stage hooks fire on a fully shielded hit.
    const shieldAbsorbed=operatorPassive?.nitrateAbsorbDamage?.(scaled)||0;
    const hpDamage=scaled-shieldAbsorbed;
    if(shieldAbsorbed)nitrateBlockVisual(shieldAbsorbed);
    if(hpDamage<=0){updateUI();return;}
    damageTakenThisStage += hpDamage;
    damageTakenThisRun += hpDamage;
    const previousHp=playerHp;
    playerHp = Math.max(0, playerHp - hpDamage);
    const passiveEffect=operatorPassive?.onPlayerDamage(previousHp,playerHp,stageElapsedSec(),wordsOnField);
    if(passiveEffect?.type==='slowdown')pushMsg('ALDEN · SECOND WIND (5s)',true);
    else if(passiveEffect?.type==='shield-advance')applyOperatorFieldEffect(passiveEffect);
    else if(passiveEffect?.type==='fletcher-last-stand'){
      // Discard accumulated spawn time: no delayed spawn burst when the phase changes.
      spawnAccMs=0;
      pushMsg('FLETCHER · LAST STAND (3s INVULNERABLE)',true);
      renderFletcherStatus(stageElapsedSec());
    }
    if(currentMode !== 'shared') mechanicEvent('onPlayerDamage',null,{damage:hpDamage,reason});
    playPlayerHitSfx();
    flashPlayerDamage();
    pushMsg(`Player takes ${hpDamage} dmg (${reason})`, true);
    updateUI();

    if(playerHp === 0) onPlayerDeath();
  }

  // v58 - Minimal defeat UI. A continue is a one-use heart, not player HP.
  let defeatFadeTimer = null;
  let defeatFinishTimer = null;
  let gameOverKeyHandler = null;

  function cancelDefeatAnimation(){
    if(defeatFadeTimer !== null) clearTimeout(defeatFadeTimer);
    if(defeatFinishTimer !== null) clearTimeout(defeatFinishTimer);
    defeatFadeTimer = null;
    defeatFinishTimer = null;
  }
  function cleanupContinueListeners(){
    if(!continueListeners) return;
    window.removeEventListener("keydown", continueListeners.onKey);
    overlayChoices.removeEventListener("click", continueListeners.onChoiceClick);
    continueListeners = null;
  }
  function cleanupGameOverKey(){
    if(gameOverKeyHandler){
      window.removeEventListener("keydown", gameOverKeyHandler);
      gameOverKeyHandler = null;
    }
  }
  function stopDefeatUI(){
    cancelDefeatAnimation();
    cleanupContinueListeners();
    cleanupGameOverKey();
    overlay.classList.remove("defeat-active");
    if(overlayBox) overlayBox.classList.remove("defeat-card", "hearts-phase");
  }
  function heartIcon(filled){
    // Screen-reader-only labels are allowed; the visible screen stays text-free.
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"/></svg>`;
  }
  function heartRow(count, hollow=false){
    const items = Array.from({length:count}, (_,i)=>`<span class="defeat-heart${hollow ? ' hollow' : ''}" aria-hidden="true">${heartIcon(!hollow)}</span>`).join("");
    return `<div class="defeat-hearts" role="img" aria-label="${hollow ? 'No continues remaining' : count + ' continues available'}">${items}</div>`;
  }
  function prepareDefeatScreen(title){
    showOverlay(true);
    overlay.classList.remove("mode-select-active");
    overlay.classList.add("defeat-active");
    overlay.style.cursor = "default";
    if(overlayBox) overlayBox.classList.remove("modeSelectMenu", "debugSmall", "hearts-phase");
    if(overlayBox) overlayBox.classList.add("defeat-card");
    overlayTitle.textContent = title;
    overlayDesc.textContent = "";
    overlayHint.textContent = "";
    countdownText.textContent = "";
    overlayChoices.classList.add("show");
    overlayChoices.innerHTML = "";
  }
  function returnFromDefeatToModes(){
    stopDefeatUI();
    // Do not reopen Story's map or the login screen. Keep the active card signed in.
    resetGame(false);
  }
  function showContinuePrompt(){
    cancelDefeatAnimation();
    cleanupGameOverKey();
    gameState = "continuePrompt";
    setInputsEnabled(false);
    showStage5Timer(false);
    pauseStageClock();
    saveBgmState();
    setBgm(AUDIO.deathBgm, true);
    continuePromptUntilMs = nowMs() + (CONTINUE_DECISION_SEC * 1000);
    prepareDefeatScreen("CONTINUE?");
    overlayChoices.innerHTML = `
      <button type="button" class="choiceBtn defeat-answer" data-act="yes">YES</button>
      <button type="button" class="choiceBtn defeat-answer" data-act="no">NO</button>`;

    const onChoiceClick = (e)=>{
      const btn = e.target.closest(".defeat-answer");
      if(!btn) return;
      e.stopPropagation();
      if(btn.dataset.act === "yes") useContinue();
      else if(btn.dataset.act === "no") returnFromDefeatToModes();
    };
    const onKey = (e)=>{
      if(gameState !== "continuePrompt") return;
      if(e.key === "Enter"){
        e.preventDefault();
        useContinue();
      } else if(e.key === "Escape"){
        e.preventDefault();
        returnFromDefeatToModes();
      }
    };
    continueListeners = {onChoiceClick,onKey};
    overlayChoices.addEventListener("click",onChoiceClick);
    window.addEventListener("keydown",onKey);
    updateContinueCountdownText();
  }
  function updateContinueCountdownText(){
    if(gameState !== "continuePrompt") return;
    const rem = Math.max(0,Math.ceil((continuePromptUntilMs-nowMs())/1000));
    countdownText.textContent = String(rem);
    if(rem === 0) returnFromDefeatToModes();
  }
  function resumeAfterContinue(){
    if(gameState !== "continueHearts") return;
    cancelDefeatAnimation();
    showOverlay(false);
    resetField({ preservePermafrost: isNormalStage5() });
    playerHp = Math.min(playerMaxHp,CONTINUE_HP);
    // Revive restores 3 HP in the same stage. Explicitly clear Fletcher's
    // previous-life effects. Mara also clears pending pushes and frozen marks
    // without restoring the once-per-stage threshold charges.
    const reviveEffect=operatorPassive?.onRevive?.(playerHp,stageElapsedSec(),wordsOnField);
    lastFletcherPhase='off';
    renderFletcherStatus(stageElapsedSec());
    if(reviveEffect?.type==='fletcher-last-stand'){
      pushMsg('FLETCHER · LAST STAND (3s INVULNERABLE)',true);
      renderFletcherStatus(stageElapsedSec());
    }
    spawnAccMs=0;
    overflowAcc = 0;
    overflow = false;
    overflowSpawnGraceUntilMs = 0;
    resumeStageClock();
    // Continue clears the field; start a fresh Chapter 1 blink/Panic cycle
    // using the CURRENT stage clock, not the original stage start time.
    setSleepyBgmGain(1);
    window.RPG_CH1_SPECIAL?.start(currentMode,storySelectedStage?.id||'',stageElapsedSec());
    restoreBgmState();
    gameState = "playing";
    if(window.RPG_V66_DISCONNECTED||!navigator.onLine)setLocalOnlyRun(true);
    setInputsEnabled(true);
    updateUI();
  }
  function useContinue(){
    if(gameState !== "continuePrompt") return;
    if(continuesLeft <= 0){ hardLoseNoContinues(); return; }
    const beforeCount = Number.isFinite(continuesLeft) ? continuesLeft : MAX_CONTINUES;
    if(currentMode !== "practice"){
      continuesLeft -= 1;
      continuesUsedThisRun += 1;
    }
    cleanupContinueListeners();
    gameState = "continueHearts";
    continuePromptUntilMs = 0;
    prepareDefeatScreen("");
    if(overlayBox) overlayBox.classList.add("hearts-phase");
    overlayChoices.innerHTML = heartRow(Math.max(1,Math.min(MAX_CONTINUES,beforeCount)));
    // Wait exactly 2 seconds with the original heart count, then spend one.
    defeatFadeTimer = setTimeout(()=>{
      if(gameState !== "continueHearts") return;
      const hearts = overlayChoices.querySelectorAll(".defeat-heart");
      const spent = hearts[hearts.length-1];
      if(spent) spent.classList.add("spent");
    },2000);
    defeatFinishTimer = setTimeout(resumeAfterContinue,2800);
  }
  function hardLoseNoContinues(){
    cleanupContinueListeners();
    cancelDefeatAnimation();
    gameState = "gameover";
    setInputsEnabled(false);
    hideBossBubble();
    showStage5Timer(false);
    pauseStageClock();
    setBgm(AUDIO.deathBgm, true);
    prepareDefeatScreen("GAME OVER");
    overlayChoices.innerHTML = (currentMode==='shared'||storySquad.enabled?'':heartRow(MAX_CONTINUES,true)) +
      `<button type="button" class="choiceBtn defeat-okay">OK</button>`;
    if(storySquad.enabled){
      const fallen=document.createElement('div');fallen.className='storySquadFallen';
      for(const id of storySquad.ids){
        const cell=document.createElement('div');cell.className='storySquadFallenCell';
        const face=document.createElement('img');face.src=storyIconUrl(id);face.alt='';
        const label=document.createElement('span');label.textContent=storyOperatorName(id);
        cell.append(face,label);fallen.appendChild(cell);
      }
      overlayChoices.prepend(fallen);
    }
    overlayChoices.querySelector('.defeat-okay').addEventListener('click',(e)=>{
      e.stopPropagation();returnFromDefeatToModes();
    });
    cleanupGameOverKey();
    gameOverKeyHandler = (e)=>{
      if(gameState !== "gameover") return;
      if(e.key === "Enter" || e.key === "Escape"){
        e.preventDefault();returnFromDefeatToModes();
      }
    };
    window.addEventListener("keydown",gameOverKeyHandler);
  }
  function hardLoseToReset(){ returnFromDefeatToModes(); }
  function onPlayerDeath(){
    window.RPG_CH1_SPECIAL?.suspend(); // Never obscure Continue / Game Over.
    setSleepyBgmGain(1);
    if(gameState !== "playing") return;
    if(storySquad.enabled){
      if(swapToNextStoryOperator())return;
      hardLoseNoContinues();return;
    }
    if(continuesLeft > 0){ showContinuePrompt(); return; }
    hardLoseNoContinues();
  }

  function showBossDialogue(stage, flowToken){
    return new Promise((resolve) => {
      const token = (typeof flowToken === "number") ? flowToken : uiFlowToken;
      if(!isUiFlow(token)) return resolve(false);

      gameState = "dialogue";
      setInputsEnabled(false);

      setBgm(stage.dialogueBgmFile, true);

      showOverlay(true);
      setOverlayText(stage.bossName, stage.bossDialogue || "……", "▶ Enter または クリックで進む");
      countdownText.textContent = "";

      let done = false;
      const finish = (ok) => {
        if(done) return;
        done = true;
        removeCancel();
        cleanup();
        try{ showOverlay(false); }catch(_){/* ignore */}
        resolve(!!ok);
      };

      const proceed = () => finish(true);
      const onKey = (e) => { if(e.key === "Enter"){ e.preventDefault(); proceed(); } };
      const onClick = () => proceed();

      const cleanup = () => {
        window.removeEventListener("keydown", onKey);
        overlay.removeEventListener("click", onClick);
      };

      const removeCancel = addUiFlowCleanup(() => finish(false));

      window.addEventListener("keydown", onKey);
      overlay.addEventListener("click", onClick);
    });
  }

  async function countdown(seconds, flowToken){
    const token = (typeof flowToken === "number") ? flowToken : uiFlowToken;
    if(!isUiFlow(token)) return false;

    gameState = "countdown";
    setInputsEnabled(false);

    showOverlay(true);
    setOverlayText("READY?", "カウントダウン後に開始", "");
    for(let s=seconds; s>=1; s--){
      if(!isUiFlow(token) || gameState !== "countdown") return false;
      countdownText.textContent = String(s);
      await sleep(650);
    }
    if(!isUiFlow(token) || gameState !== "countdown") return false;
    countdownText.textContent = "GO!";
    await sleep(420);
    if(!isUiFlow(token) || gameState !== "countdown") return false;
    showOverlay(false);
    return true;
  }

  function showStageClearScreen(stage){
    return new Promise((resolve) => {
      gameState = "stageclear";
      setInputsEnabled(false);

      const stageClearBgm = (currentMode === "extra") ? AUDIO.extraVictoryBgm : AUDIO.victoryBgm;
      setBgm(stageClearBgm, true);

      showOverlay(true);
      setOverlayTitleStageClear(stage.stageName);
      overlayDesc.textContent = `${stage.stageName} クリア！`;
      overlayHint.textContent = "";
      countdownText.textContent = "";
      overlayChoices.classList.remove("show");
      overlayChoices.innerHTML = "";

      let allowSkip = false;
      const minShowT = setTimeout(() => { allowSkip = true; }, 450);

      let done = false;
      const finish = () => {
        if(done) return;
        done = true;
        cleanup();
        showOverlay(false);
        resolve();
      };

      const autoT = setTimeout(() => { allowSkip = true; finish(); }, 2200);

      const onKey = (e) => {
        if(e.key === "Enter"){
          e.preventDefault();
          if(!allowSkip) return;
          clearTimeout(autoT);
          finish();
        }
      };
      const onClick = () => {
        if(!allowSkip) return;
        clearTimeout(autoT);
        finish();
      };

      const cleanup = () => {
        clearTimeout(minShowT);
        window.removeEventListener("keydown", onKey);
        overlay.removeEventListener("click", onClick);
      };

      window.addEventListener("keydown", onKey);
      overlay.addEventListener("click", onClick);
    });
  }

  async function startStage(idx){
    const stageLoadStart=performance.now();
    if(currentMode !== "shared") applyCachedStageConfigToStageLists();
    const flow = cancelUiFlow();
    // Failsafe: clamp stage index to available stages (prevents undefined stage crashes)
    const maxIdx = Math.max(0, ((STAGES && STAGES.length) ? STAGES.length : 1) - 1);
    idx = Math.max(0, Math.min(maxIdx, Math.trunc(Number(idx) || 0)));
    stageIndex = clamp(idx, 0, Math.max(0, STAGES.length - 1));
    resetGradedBuckets();
    resetField();
    resetOperatorForStage();
    damageTakenThisStage = 0;
    hideBossBubble();

    spawnAccMs = 0;
    autoSpawnEnabled = true;
    spawnCountThisStage = 0;
    midFightBubbleShown = false;
    showStage5Timer(false);

    const stage = STAGES[idx];
    if(currentMode !== "shared") try{window.RPG_BALANCE?.setActive(currentMode,currentMode==='story'?String(storySelectedStage?.id||'1-1'):String(idx+1),currentMode==='story'?String(storySelectedStage?.id||'1').split('-')[0]:null);}catch(_){}

    stagePlayStartMs = 0;
    stagePausedTotalMs = 0;
    stagePauseStartMs = null;

    if(idx === 4){
      stage5Phase = 1;
    stage5EndedHandled = false;
    stage5Phase2At = null;
    stage5Phase3At = null;
    stage5ResetPhase3Ramp();
      stage5ResetPhase3Ramp();
      showStage5Timer(false);
    }

    bossMaxHp = currentMode === 'shared' ? stage.bossMaxHp : (window.RPG_BALANCE?.get('bossMaxHp',stage.bossMaxHp) ?? stage.bossMaxHp);
    bossHp = bossMaxHp;
    bossVariantPhase = 1;
    baseHitDamage = currentMode === 'shared' ? stage.hitDamage : (window.RPG_BALANCE?.get('hitDamage',stage.hitDamage) ?? stage.hitDamage);
    // Extra Stage 1 uses the stage/Google Sheets boss HP; shooting-star timer checks half HP dynamically.

    // Let already-prefetched artwork decode; never stall gameplay indefinitely for art.
    const artReady=window.RPG_MEDIA?.stage(stage,true);
    if(artReady){
      await Promise.race([artReady,new Promise(resolve=>setTimeout(resolve,650))]);
      if(!isUiFlow(flow)) return;
    }
    await setStageArt(stage);
    window.RPG_PERF?.track(`Stage ${idx+1} art`,performance.now()-stageLoadStart);
    if(!isUiFlow(flow)) return;

    updateUI();

    msgBox.innerHTML = "";

    const okDialogue = await showBossDialogue(stage, flow);
    if(!okDialogue || !isUiFlow(flow)) return;

    const okCountdown = await countdown(3, flow);
    if(!okCountdown || !isUiFlow(flow)) return;

    // Consume the freshest cached Firestore values after the intro/countdown,
    // rather than only when the slideshow first opened.
    const newMaxHp=currentMode === 'shared' ? stage.bossMaxHp : (window.RPG_BALANCE?.get('bossMaxHp',stage.bossMaxHp) ?? stage.bossMaxHp);
    if(newMaxHp!==bossMaxHp){bossMaxHp=newMaxHp;bossHp=newMaxHp;updateUI();}
    baseHitDamage=currentMode === 'shared' ? stage.hitDamage : (window.RPG_BALANCE?.get('hitDamage',stage.hitDamage) ?? stage.hitDamage);
    gameState = "playing";
    setInputsEnabled(true);
    // Download/decode only the NEXT stage's art in idle time. The current stage stays responsive.
    window.RPG_MEDIA?.next(STAGES[stageIndex+1]);
    recordRankedStage();
    if(currentMode !== "shared") mechanicEvent('onStageStart');

    stagePlayStartMs = nowMs();
    setSleepyBgmGain(1);
    window.RPG_CH1_SPECIAL?.start(currentMode,storySelectedStage?.id||'');
    // Normal/Extra carry HP. Fletcher can activate Last Stand at 1 HP;
    // Mara queues Emergency Readiness if already below her HP threshold.
    // Both are initialized after the countdown, with a fresh stage clock.
    const fletcherStageEffect=operatorPassive?.onStageStart?.(playerHp,stageElapsedSec(),wordsOnField);
    if(fletcherStageEffect?.type==='fletcher-last-stand'){
      spawnAccMs=0;
      pushMsg('FLETCHER · LAST STAND (3s INVULNERABLE)',true);
      renderFletcherStatus(stageElapsedSec());
    }
    if(!["story","shared"].includes(currentMode)) try{ window.RPG_REWARDS?.startStage(currentMode,stageIndex); }catch(_){}

    // Normal Stage 4 mechanic removed.

    // Extra Stage 2: time-based phases
    // Phase 1: 0–40s, Phase 2: 40–68s, Phase 3: 68–98s, Phase 4: 98–130s, Phase 5: 130s+
    if(isExtraStage2()){
      ex2Phase = 1;
      ex2Phase2Announced = false;
      ex2Phase3Announced = false;
      ex2Phase4Announced = false;ex2PhaseSpawnCount = 0;
    }else{
      ex2Phase = 0;
      ex2Phase2Announced = false;
      ex2Phase3Announced = false;
      ex2Phase4Announced = false;ex2PhaseSpawnCount = 0;
    }

    // Extra Stage 4: always reset + enter Phase 1 right after the countdown
    if(isExtraStage4()){
      ex4Phase = 0;
      ex4SpawnEnabled = false;
      ex4ClearShuffleState();
      ex4ShowFakeDeath(false);
      showEx4Timer(true);
      ex4HandlePhaseEnter(1);
    }else{
      showEx4Timer(false);
      ex4Phase = 0;
      ex4SpawnEnabled = false;
      ex4ClearShuffleState();
      ex4ShowFakeDeath(false);
    }

    startEx2Mechanic();
    startEx2HackMechanic();
    stagePausedTotalMs = 0;
    stagePauseStartMs = null;

    spawnAccMs = 0;

    setBgm(stage.playBgmFile, stage.playBgmLoop !== false);

    // Extra Stage 2: survival clear — activate "clear on BGM end"
    if(isExtraStage2()){
      ex2ClearOnBgmEndActive = true;
      ex2ClearOnBgmEndSrc = stage.playBgmFile || "";
    }else{
      ex2ClearOnBgmEndActive = false;
      ex2ClearOnBgmEndSrc = "";
    }
  }

  async function startGame(){
    window.RPG_PERF?.begin('Start run (cloud + art)');
    // Overlap the first stage's static assets with the required Firebase data request.
    void window.RPG_MEDIA?.stage(STAGES[0],true);
    window.__adventureChallengeClearing = false;
    cleanupContinueListeners();
    resetField();
    resetEx2HackMechanic();
    hideBossBubble();
    showStage5Timer(false);

    stageIndex = 0;
    mistakes = 0;guildCorrectThisRun = 0;guildStoryAttemptId = currentMode === "story" ? crypto.randomUUID() : null;
    // A fresh Firebase check is mandatory for ranked modes. Practice/Story reuse
    // the last verified session snapshot for five minutes, refreshing when stale.
    // The sign-in prefetch stores verified vocabulary but does not populate WORDS.
    // Restore it before deciding a recent server download can be reused.
    if(vocabLastServerSuccess && !assignedVocabPool && !restoreVerifiedVocab())vocabLastServerSuccess=false;
    const modeNeedsRank=['normal','extra','challenge','shared'].includes(currentMode);
    const supportsCache=['practice','story','normal','extra'].includes(currentMode);
    const connectionOkay=Boolean(ADVENTURE_CONTEXT.online&&!window.RPG_V66_DISCONNECTED&&navigator.onLine);
    const needsRefresh=modeNeedsRank||vocabRefreshedForMode!=='normal'||!vocabLastServerSuccess||Date.now()-vocabRefreshedAt>VOCAB_REFRESH_INTERVAL_MS;
    let live=false;
    if(connectionOkay){
      if(!needsRefresh&&currentMode!=='shared')live=true;
      else live=await refreshVocabFromServer(currentMode);
    }
    // A connection interrupted after successful loading is still unranked.
    const canRank=Boolean(live&&!window.RPG_V66_DISCONNECTED&&navigator.onLine);
    if(!canRank){
      // A successful authoritative rejection must not be overridden by an older cache.
      if(vocabServerRejected || !supportsCache || !restoreVerifiedVocab()){
        showModeSelectScreen();
        const reason=vocabServerRejected?vocabLastError:
          (!connectionOkay?'No verified class vocabulary is stored on this Chromebook. Reconnect and sign in once.':
          (vocabLastError||'Class vocabulary has not downloaded. Check your class assignment in the Teacher Dashboard and try again.'));
        alert(reason);
        return;
      }
      setLocalOnlyRun(true);
    }else setLocalOnlyRun(false);
    if(currentMode==='story'&&storyBattleStage)storyBattleStage.words=WORDS;
    if(currentMode==='shared'?SHARED_WORDS.length===0:WORDS.length===0){
      setLocalOnlyRun(false);
      showModeSelectScreen();
      alert('No active vocabulary in this group. Ask your teacher to add words in Vocabulary Manager.');
      return;
    }
    // Do not pretend a cached/unverified snapshot is an official ranked game.
    if(['normal','extra'].includes(currentMode)&&!runLocalOnly){
      try{await window.RPG_V66.prepareBalanceRun(currentMode,['1','2','3','4','5']);}
      catch(e){
        if(supportsCache&&restoreVerifiedVocab())setLocalOnlyRun(true);
        else{showModeSelectScreen();alert('Cannot load game settings. '+String(e.message||e));return;}
      }
    }
    if(['practice','story'].includes(currentMode)&&!runLocalOnly){
      const storyId=storySelectedStage?.id||'1-1';
      const stageIds=currentMode==='story'?[storyId]:['1','2','3','4','5'];
      const chapterId=currentMode==='story'?storyId.split('-')[0]:null;
      try{await window.RPG_V66?.fetchSoloBalance?.(currentMode,stageIds,chapterId);}catch(e){
        console.info('Using saved teacher difficulty settings:',e?.message||e);
      }
      if(window.RPG_V66_DISCONNECTED||!navigator.onLine)setLocalOnlyRun(true);
    }
    continuesLeft = (currentMode === "practice") ? Infinity : (currentMode === "shared" ? 0 : MAX_CONTINUES);
    resetRunScoring();
    if(currentMode === "shared") resetSharedBuckets();
    prepareOperatorForRun();
    if(storySquad.enabled)document.body.classList.add('story-squad-layout');
    startRankedRun();
    playerMaxHp = BASE_PLAYER_MAX_HP + (operatorPassive?.getMaxHpBonus()||0);
    playerHp = playerMaxHp;
    if(storySquad.enabled)renderStorySquad();

    showOverlay(false);
    if(runLocalOnly)pushMsg('CACHED VOCAB · UNRANKED · NOT SAVED',true);
    await startStage(0);
    window.RPG_PERF?.end('Start run (cloud + art)');
  }

  // ---- Global jump to the *first launch* intro screen (LOAD → START) ----
  // Used by the memory wipe cheat and can be safely called from anywhere.
  function hardResetCoreToIdle(){
    stopStorySquad();
    stopDefeatUI();
    cleanupPauseListeners();
    clearResumeCountdown();
    pausedBgmState = null;
setMode("normal");
    normalCleared = loadNormalCleared();

    // Restart resets score + penalty
    resetAllRunScoring();

    gameState = "idle";
    resetField();
    resetEx2HackMechanic();
    hideBossBubble();
    showStage5Timer(false);

    spawnAccMs = 0;
    spawnCountThisStage = 0;

    midFightBubbleShown = false;


    playerMaxHp = BASE_PLAYER_MAX_HP;
    playerHp = playerMaxHp;
    mistakes = 0;
    stageIndex = 0;
    bossHp = 0;
    bossMaxHp = 0;
    bossVariantPhase = 1;

    continuesLeft = (currentMode === "practice") ? Infinity : MAX_CONTINUES;
    continuePromptUntilMs = 0;

    stagePlayStartMs = 0;
    stagePausedTotalMs = 0;
    stagePauseStartMs = null;

    stage5Phase = 1;
    stage5EndedHandled = false;
    stage5Phase2At = null;
    stage5Phase3At = null;

    stopBgm();
    try{ setStageArt(STAGES[0]); }catch(_){/* ignore */}

    // Hide the in-game overlay (mode select, dialogue, etc.) so the intro can be seen.
    showOverlay(false);
    try{
      overlayChoices.classList.remove("show");
      overlayChoices.innerHTML = "";
    }catch(_){/* ignore */}

    setInputsEnabled(false);
    updateUI();
  }

  function goToFirstLaunchScreen(noteText){
    hardResetCoreToIdle();

    // Clear message log (optional)
    try{ msgBox.innerHTML = ""; }catch(_){/* ignore */}
    
    

    // Force-show the intro overlay even if it has already been shown once.
    showIntroStartScreen(true);

    // Show a note to confirm the wipe happened.
    try{
      if(noteText) introNote.textContent = noteText;
    }catch(_){/* ignore */}
  }


  function resetGame(reopenStoryMap = true){
    stopStorySquad();
    const returnToStoryMap = currentMode === "story" && reopenStoryMap;
    stopDefeatUI();
    cleanupPauseListeners();
    clearResumeCountdown();
    pausedBgmState = null;
if(gameState === "paused"){ try{ showOverlay(false); }catch(_){/* ignore */} }
    // EX4 Phase 4: completely block reset/run (fake death lockout)
    if(gameState === "playing" && isExtraStage4() && ex4Phase === 4){
      ex4ShowFakeDeath(true);
      overlayDesc.textContent = "HAHAHAHAHAHA";
      ex4PlayResetScare();
      return;
    }

    // Cancel any in-progress async UI flow (countdown/dialogue/etc.) so it can’t resume after reset.
    cancelUiFlow();

    // Helper: wipe state back to a clean idle baseline (no screen shown yet)
    function hardResetCore(){
      setLocalOnlyRun(false);
      setMode("normal");
      normalCleared = loadNormalCleared();

      // Restart resets score + penalty
      resetAllRunScoring();

      gameState = "idle";
      resetField();
      hideBossBubble();
      showStage5Timer(false);

      spawnAccMs = 0;
      spawnCountThisStage = 0;
      midFightBubbleShown = false;


      playerMaxHp = BASE_PLAYER_MAX_HP;
      playerHp = playerMaxHp;
      mistakes = 0;
      stageIndex = 0;
      bossHp = 0;
      bossMaxHp = 0;
      bossVariantPhase = 1;

      continuesLeft = (currentMode === "practice") ? Infinity : MAX_CONTINUES;
      continuePromptUntilMs = 0;

      stagePlayStartMs = 0;
      stagePausedTotalMs = 0;
      stagePauseStartMs = null;

      stage5Phase = 1;
      stage5EndedHandled = false;
      stage5Phase2At = null;
      stage5Phase3At = null;

      stopBgm();
      setStageArt(STAGES[0]);

      setInputsEnabled(false);
      updateUI();
    }

    function goToModeSelect(){
      hardResetCore();

      msgBox.innerHTML = "";
      
      
      pushMsg(normalCleared ? "Extra Mode: UNLOCKED" : "Extra Mode: LOCKED（Normal クリアで解放）", true);

      showModeSelectScreen();
    }

    // Every victory returns to Mode Select when the player chooses MENU.
    // First-clear unlocks and score submission are handled before this navigation.
    if(gameState === "victory"){
      goToModeSelect();
      return;
    }

    // Default reset path: back to MODE SELECT (Story reopens its stage map).
    goToModeSelect();
    if(returnToStoryMap && window.RPG_STORY) window.RPG_STORY.openMap(launchStoryStage);
  }

  function onBossDefeated(){
    if(gameState !== "playing") return;
    window.RPG_CH1_SPECIAL?.suspend(); // Never obscure the clear screen.
    setSleepyBgmGain(1);
    if(window.RPG_V66_DISCONNECTED||!navigator.onLine)setLocalOnlyRun(true);
    // Ensure EX2 survival flag doesn't linger into clear screens/next stages
    resetEx2HackMechanic();
    ex2ClearOnBgmEndActive = false;
    ex2ClearOnBgmEndSrc = "";

    setInputsEnabled(false);
    hideBossBubble();
    pushMsg("✅ Boss defeated!");

    (async () => {
      const clearedStage = STAGES[stageIndex];
      const isFinal = (stageIndex === STAGES.length - 1);
      if(currentMode === "story"){
        await showStageClearScreen(clearedStage);
        await completeStoryStage(storySelectedStage,damageTakenThisStage);
        return;
      }
      try{ window.RPG_REWARDS?.stageClear(); }catch(_){}

      await showStageClearScreen(clearedStage);
      try{ requestCloudCheckpointSave("stage-clear"); }catch(_){/* ignore */}

      try{ checkChallengeAchievementsAfterStageClear(); }catch(_){/* ignore */}


      if(isFinal){
        onVictory();
      }else{
        stageIndex++;
        await startStage(stageIndex);
      }
    })();
  }

  function onVictory(){
  if(window.RPG_V66_DISCONNECTED||!navigator.onLine||!ADVENTURE_CONTEXT.online)setLocalOnlyRun(true);
  if(runLocalOnly){try{window.RPG_LOCAL_PRACTICE?.record({mode:currentMode,score:getActiveScore()});}catch(_){}}
  cleanupContinueListeners();
  gameState = "victory";
  setInputsEnabled(false);
  hideBossBubble();
  showStage5Timer(false);

  // Coin payment requires a successfully submitted, non-cheat, online ranked run.
  // Each rank token is redeemable for Guild Coins only once in Firestore.
  const guildEligible=!runLocalOnly&&['normal','extra'].includes(currentMode);
  const guildMode=currentMode,guildCorrect=guildCorrectThisRun,guildMisses=mistakes;
  const guildSync=guildEligible ? (async()=>{
    const ranked=await submitRankedCompletion();
    if(!ranked?.ok || window.RPG_V66_DISCONNECTED)return {awarded:0,error:'RANK NOT VERIFIED'};
    try{return await window.RPG_GUILD.claim({mode:guildMode,runToken:ranked.token,correct:guildCorrect,incorrect:guildMisses});}
    catch(e){console.warn('Guild Coin claim:',e);return {awarded:0,error:'COINS NOT SAVED'};}
  })() : submitRankedCompletion();

  // Keep first-clear unlocks, but never change victory navigation based on them.
  const firstNormalClear = currentMode === "normal" && !normalCleared;
  const firstExtraClear = currentMode === "extra" && !extraCleared;

  // If Normal mode was cleared, unlock Extra permanently
  if(currentMode === "normal" && !normalCleared && !runLocalOnly){
    normalCleared = true;
    saveNormalCleared();
    try{ unlockAchievement("normal_clear"); }catch(_){/* ignore */}
    try{ if(loadExtraCleared()) unlockAchievement("master_clear"); }catch(_){/* ignore */}
    pushMsg("EXTRA UNLOCKED", true);
    try{ requestCloudCheckpointSave("normal-mode-clear"); }catch(_){/* ignore */}
  }

  // If Extra mode was cleared for the first time, unlock the Master intro (Normal + Extra clear).
  // (Extra is normally only accessible after Normal clear, but debug mode may bypass that.)
  if(currentMode === "extra" && !extraCleared && !runLocalOnly){
    extraCleared = true;
    saveExtraCleared();
    try{ unlockAchievement("extra_clear"); }catch(_){/* ignore */}
    try{ if(loadNormalCleared()) unlockAchievement("master_clear"); }catch(_){/* ignore */}
    pushMsg("MASTER INTRO UNLOCKED", true);
    try{ requestCloudCheckpointSave("extra-mode-clear"); }catch(_){/* ignore */}
  }


  const victoryBgmFile = (currentMode === "extra") ? AUDIO.extraVictoryBgm : AUDIO.victoryBgm;
  setBgm(victoryBgmFile, true);

  const clearedCount = STAGES.length;
  const unlocked = firstNormalClear ? " · EXTRA UNLOCKED" :
                   firstExtraClear ? " · MASTER INTRO UNLOCKED" : "";
  const desc = runLocalOnly?`${clearedCount} STAGES CLEARED · UNRANKED · NOT SAVED`:`${clearedCount} STAGES CLEARED${unlocked}`;

  showOverlay(true);
  setOverlayText("VICTORY!", desc, "");
  // The old instruction pointed to a Reset control underneath this modal.
  // Place the real action inside the modal so it works on Chromebooks and touchscreens.
  overlay.style.cursor = "default";
  overlayChoices.classList.add("show");
  overlayChoices.innerHTML = `${guildEligible?'<div class="guild-result" id="guildResult" role="status">SAVING GUILD COINS…</div>':''}<button type="button" class="choiceBtn victory-continue" ${guildEligible?'disabled':''}>MENU</button>`;
  const menuButton=overlayChoices.querySelector('.victory-continue');
  menuButton?.addEventListener('click',event=>{event.stopPropagation();if(gameState==='victory')resetGame();});
  if(guildEligible)void Promise.resolve(guildSync).then(data=>{
    if(gameState!=='victory')return;
    const msg=overlayChoices.querySelector('#guildResult');
    if(msg)msg.textContent=data?.awarded?`+${data.awarded} GUILD COINS · ${data.coins} TOTAL`:data?.duplicate?`ALREADY CLAIMED · ${data.coins} TOTAL`:(data?.error||'COINS NOT SAVED');
  }).catch(e=>{const msg=overlayChoices.querySelector('#guildResult');if(msg)msg.textContent='COINS NOT SAVED';console.warn(e)}).finally(()=>{menuButton.disabled=false;});
  pushMsg("🏆 VICTORY!");
}

  async function cheatSkipToStage5(){
    if(currentMode !== "normal" || STAGES.length < 5){
      pushMsg("CHEAT: Normal Mode のみ対応", true);
      return;
    }
    if(stageIndex === 4){
      pushMsg("CHEAT: すでにStage 5です", true);
      return;
    }

    pushMsg("CHEAT: Stage 5へスキップ！", true);

    resetField();
    hideBossBubble();
    showStage5Timer(false);
    showOverlay(false);

    playerHp = clamp(playerHp, 1, playerMaxHp);
    updateUI();

    stageIndex = 4;
    await startStage(4);
  }

  function submitAnswer(){
    if(gameState !== "playing") return;
    // A blackout never penalizes a word the player could not see.
    if(window.RPG_CH1_SPECIAL?.isFullyClosed()){answerInput.value="";return;}
    const raw = answerInput.value.trim();
    answerInput.value = "";

    const rawLower = raw.toLowerCase();
    if(DEV_CHEATS_ENABLED && rawLower === DEBUG_MODE_CODE){
      debugMode = true;
      saveDebugMode(true);
      pushMsg("🛠 DEBUG MODE ON", true);
      showDebugStagePicker();
      return;
    }


    // Cheat: wipe all saved memory (unlock + hi-scores + debug flags)
    if(DEV_CHEATS_ENABLED && rawLower === CHEAT_MEMORY_WIPE){
      wipeGameMemory();
      pushMsg("🧹 MEMORY WIPED (bossTyping_*)", true);

      // Return to the *very first launch* intro screen (LOAD → START).
      // NOTE: This must be a top-level helper (not inside resetGame), so cheats can call it from anywhere.
      goToFirstLaunchScreen("🧹 セーブデータを削除しました (MEMORY WIPED)");
      return;
    }

    // Cheat: +100,000 coins
    if(DEV_CHEATS_ENABLED && rawLower === CHEAT_MONEY){
      try{ addCoins(CHEAT_MONEY_AMOUNT); }catch(_){/* ignore */}
      try{ pushMsg(`💰 +${fmtCoins(CHEAT_MONEY_AMOUNT)} coins!`, true); }catch(_){/* ignore */}
      try{ renderProfileHeader(); }catch(_){/* ignore */}
      return;
    }

    if(DEV_CHEATS_ENABLED && raw === CHEAT_SKIP_STAGE5){
      cheatSkipToStage5();
      return;
    }
    const norm = normalizeAnswer(raw);

    const ok = findMatchAndClear(raw);
    if(!ok){
      mechanicEvent('onMistake',null,{input:raw});
      mistakes++;
      pushMsg(`MISS: ${raw || "(blank)"}`);
      if(!operatorOnMistake())damagePlayer(1, "input miss");
      updateUI();
    }

    answerInput.focus();
  }

  // Throttle the main loop while in menus/paused states to reduce CPU/GPU usage.
  const IDLE_TICK_MS = 120; // ~8fps
  function scheduleTick(idle){
    if(idle) setTimeout(() => requestAnimationFrame(tick), IDLE_TICK_MS);
    else requestAnimationFrame(tick);
  }

  function tick(ts){
    let dt = 0;
    if(lastTs){
      const rawDt = (ts - lastTs) / 1000;
      const MAX_DT = 0.2;
      dt = Math.min(rawDt, MAX_DT);
      const lost = rawDt - dt;
      if(lost > 0 && gameState === "playing" && stagePlayStartMs){
        // Keep stage timers in sync with simulation when frames hitch.
        stagePausedTotalMs += lost * 1000;
      }
    }
    lastTs = ts;

    const dtReal = dt;
if(gameState === "continuePrompt"){
      updateContinueCountdownText();
      updateUIThrottled();
      scheduleTick(true);
      return;
    }

if(gameState === "paused"){
  // Freeze simulation & mechanics while paused.
  scheduleTick(true);
  return;
}

    if(gameState === "playing"){
      const stage = STAGES[stageIndex];
      const elapsed = stageElapsedSec();
      if(rankedRun && rankedRun.mode === currentMode && Math.floor(elapsed)!==rankedRun.lastAuditSec){
        rankedRun.lastAuditSec=Math.floor(elapsed);auditRankedStage();
      }
      // The original Challenge ended with the BGM; the combined game has no bundled songs.
      // A 120-second survival clear replaces the BGM-end trigger.
      if((currentMode === "challenge" || currentMode === "shared") && elapsed >= 120 && !window.__adventureChallengeClearing){
        window.__adventureChallengeClearing = true;
        gameState = "stageClearing";
        setInputsEnabled(false);
        (async()=>{ await showStageClearScreen(stage); onVictory(); })();
        scheduleTick(true);
        return;
      }
      // Sleepy runs on the pause-aware stage clock. Delirium changes text once at full closure.
      // Falling words and impacts CONTINUE even while the eyelids are fully closed.
      // Only fresh normal spawns wait until the eyes start opening.
      const chapterBlackout=!!window.RPG_CH1_SPECIAL?.frame(elapsed,{
        words:wordsOnField,vocabulary:currentMode==='story'?operatorStageWordEntries():[],
        normalize:normalizeAnswer,onClosed:()=>{answerInput.value='';}
      });
      setSleepyBgmGain(window.RPG_CH1_SPECIAL?.bgmGain?.() ?? 1);
      const battleDt=dt; // No word-motion freeze during Sleepy darkness.
      const spawnDt=chapterBlackout?0:dt; // Do not spawn new, unseen words during the blackout.
      ex4HandlePhaseTriggers(elapsed);
      ex2HandlePhaseTriggers(elapsed);
      updateEx2HackMechanic();
      operatorPassive?.tick(elapsed);
      syncChainCleaveHex(elapsed);
      operatorPassive?.syncAdrenaline?.(wordsOnField,playerHp);
      const fletcherPhase=operatorPassive?.getAdrenalinePhase?.(elapsed)||'off';
      if(fletcherPhase!==lastFletcherPhase){
        spawnAccMs=0; // never burst pending words after switching phases
        if(lastFletcherPhase==='last-stand'&&fletcherPhase==='overdrive')pushMsg('FLETCHER · OVERDRIVE (+25% FALL / +20% SPAWNS)',true);
        lastFletcherPhase=fletcherPhase;
      }
      renderFletcherStatus(elapsed);
      // Low-cost arena status indication, cleared when the timed freeze expires.
      wordLane?.classList?.toggle('operator-frozen-domain',!!operatorPassive?.isFieldFrozen(elapsed));
      wordLane?.classList?.toggle('operator-sovereign-guard',operatorPassive?.rule?.id==='cassian'&&!!operatorPassive?.isInvulnerable(elapsed));
      const overflowSpawnPaused = overflow || (ts < overflowSpawnGraceUntilMs);
      const operatorPause = operatorSpawnPaused(elapsed);
      if(!overflowSpawnPaused && !operatorPause){
        spawnAccMs += spawnDt * 1000;
      }else{
        spawnAccMs = 0;
      }
      let spawnMs = currentMode === 'shared' ? stage.spawnEveryMs : (window.RPG_BALANCE?.get('spawnEveryMs',stage.spawnEveryMs) ?? stage.spawnEveryMs);
      if(stageIndex === 4){
        spawnMs = stage5CurrentSpawnMs(elapsed);
      }

      // EX Stage 4: Phase-based spawn rate adjustment
      // Phases 2–3: 55% of original spawn rate (=> longer interval)
      // Phase 5: 2x 10% slower than phases 2–3 (i.e., 44.55% of original)
      const isEx4 = isExtraStage4();
      const ex4Adj = isEx4 && (ex4Phase === 2 || ex4Phase === 3 || ex4Phase === 5);
      if(isEx4 && (ex4Phase === 2 || ex4Phase === 3)){
        spawnMs = Math.round(spawnMs / 0.55);
      }else if(isEx4 && ex4Phase === 5){
        spawnMs = Math.round(spawnMs / 0.55 / 0.9 / 0.9);
      }


      // Extra Stage 3 keeps the base spawn rate; below half HP only ghost fall speed/timer change.
      if(currentMode === "extra" && stageIndex === 1){
        spawnMs = Math.max(250, Math.round(spawnMs / Math.max(1, ex2HackSpawnMult || 1)));
      }
      if(currentMode === "challenge"){
        spawnMs = Math.max(220, Math.round(spawnMs / challengeRampMultiplier(elapsed)));
      }
      // Spawn frequency: Last Stand -90% => 10x interval; Overdrive +20% => /1.2 interval.
      // Apply after stage mechanics so both phases scale the actual stage pace.
      spawnMs = Math.max(80, Math.round(spawnMs * (operatorPassive?.getSpawnIntervalMultiplier?.(elapsed)||1)));
        let loops = 0;
        if(!overflowSpawnPaused && !operatorPause && !chapterBlackout){
          while(spawnAccMs >= spawnMs && loops < 6){
            spawnWord();
            spawnAccMs -= spawnMs;
            loops++;
          }
        }

      // Operator effects advance after new spawns. Hidden Foxfire words cannot
      // be typed/moved until their turn, and Hound can force a chain target.
      const fieldEffect=operatorPassive?.updateField(wordsOnField,elapsed,{hp:playerHp,laneHeight:laneHeight()});
      // Lupa's focus/6-second countdown must advance with the live stage clock.
      // Do this AFTER updateField so a timeout removes the marks immediately.
      operatorRefreshLupaVisuals(elapsed);
      if(fieldEffect?.type==='auto-eliminate'){
        const autoDamage=operatorAutoEliminate(fieldEffect.wordId,true);
        if(autoDamage>0)damageBoss(autoDamage);
        if(gameState!=='playing'){scheduleTick(true);return;}
      }else{
        applyOperatorFieldEffect(fieldEffect);
        if(fieldEffect?.type==='lupa-timeout'&&fieldEffect.selfDamage>0){
          damagePlayer(fieldEffect.selfDamage,'Moonlit Ambush timeout');
          if(gameState!=='playing'){scheduleTick(true);return;}
        }
      }

      const h = laneHeight();
      let fallSpeed = (stageIndex === 4)
        ? stage5CurrentFallSpeed(elapsed)
        : (currentMode === 'shared' ? stage.fallSpeedPxPerSec : (window.RPG_BALANCE?.get('fallSpeedPxPerSec',stage.fallSpeedPxPerSec) ?? stage.fallSpeedPxPerSec));

      // EX Stage 4: Phase 2/3/5 fall speed adjustment (+10% of original)
      if(ex4Adj){
        fallSpeed *= 1.10;
      }
      if(currentMode === "extra" && stageIndex === 1){
        fallSpeed *= Math.max(1, ex2HackFallMult || 1);
      }
      if(currentMode === "challenge"){
        fallSpeed *= challengeRampMultiplier(elapsed);
      }
      // PERF: Avoid repeated .filter() inside the per-word loop.
      const words = wordsOnField;
      let landedCount = 0;
      for(let i=0;i<words.length;i++){
        if(words[i].state === "landed") landedCount++;
      }

      let needsRestack = restackDirty;
      restackDirty = false;
      const challengeCometImpactIds = [];

      for(let i=0;i<words.length;i++){
        const w = words[i];
        if(w.ex2Hacked) continue;
        if(w.foxfireHidden) continue; // Hidden rewind queue is in stasis.
        if(w.state !== "falling") continue;

        const v = (Number.isFinite(w.fallSpeedOverride)
          ? w.fallSpeedOverride
          : (fallSpeed * (w.fallMult || 1) * (w.ex2FallMult || 1))) * (operatorPassive?.getFallMultiplier(elapsed)||1);
        const frozenByOperator=!!operatorPassive?.isWordFrozen(w,elapsed);
        if(!frozenByOperator)w.y += v * battleDt;
        // Word-specific Shield Advance holds also suspend custom movement hooks.
        if(!frozenByOperator&&!operatorPassive?.isFieldFrozen(elapsed))mechanicEvent('onTick',w,{dt:battleDt});

        const baseCount = Number.isFinite(w.spawnBaseCount) ? w.spawnBaseCount : landedCount;
        const gIdx = (w.groupIndex || 0);
        const ignoreCollide = !!w.ex3Ghost || !!w.ignoreCollision;
        const targetY = ignoreCollide ? (h - 30) : (h - 30 * (baseCount + gIdx + 1));

        if(w.challengeComet){
          challengeUpdateCometGlow(w, (w.y || 0) / Math.max(1, h - 30));
        }

        if(w.y >= targetY){
          w.y = targetY;
          // Panic is a falling hazard, never a stacked word. Exactly one hit at the floor.
          if(w.chapterPanic){
            const panicDamage=window.RPG_CH1_SPECIAL?.panicDamage()||1;
            removeWord(w.id);
            damagePlayer(panicDamage,'Panic word');
            if(gameState!=='playing'){scheduleTick(true);return;}
            i--;continue;
          }

          if(w.challengeComet){
            challengeUpdateCometGlow(w, 1);
            challengeCometImpactIds.push(w.id);
            setWordY(w.el, w.y);
            continue;
          }

          w.state = "landed";
          w.el.classList.add("landed");
          mechanicEvent('onLand',w);
          if(isExtraStage1() && w.ex1Highlighted){
            ex1ArmPermafrost(w);
          }
          if(isExtraStage2() && ex2Phase >= 3){
            ex2ToggleObscureOnLand(w);
          }
          if(isExtraStage3() && w.ex3Ghost){
            ex3ArmGhostTimer(w);
          }
          if(isExtraStage4Infection() && w.ex4Infected){
            ex4ArmInfectionTimer(w);
          }

          landedCount++;
          needsRestack = true;
        }

        setWordY(w.el, w.y);
      }

      if(challengeCometImpactIds.length){
        challengeCometImpactIds.forEach(id => {
          const w = wordsOnField.find(x => x && x.id === id);
          if(w) challengeHandleCometLanding(w);
        });
      }

      stage5UpdateFrost();
      ex1UpdatePermafrost();
      ex3UpdateGhostTimers();
      ex4UpdateInfectionTimers();


      if(needsRestack) restackLanded();

      const wasOverflowing = overflow;
      overflow = landedCount >= laneCapacity();
      if(overflow){
        overflowSpawnGraceUntilMs = 0;
        overflowAcc += battleDt;
        if(overflowAcc >= 1){
          const ticks = Math.floor(overflowAcc);
          overflowAcc -= ticks;
          damagePlayer(ticks, "overflow");
        }
      }else{
        if(wasOverflowing){
          overflowSpawnGraceUntilMs = ts + OVERFLOW_SPAWN_RESUME_GRACE_MS;
          spawnAccMs = 0;
        }
        overflowAcc = 0;
      }

      handleStage5PhaseTriggers();
      updateStage5Timer();
      updateEx2Mechanic();
      updateEx4Mechanic();
      updateUIThrottled();
    } else {
      updateStage5Timer();
      updateStage4Timer();
      updateEx2Mechanic();
      updateEx2HackMechanic();
      updateUIThrottled();
    }

    requestAnimationFrame(tick);
  }

  startCmd && startCmd.addEventListener("click", () => {
    if(["playing","countdown","dialogue","stageclear","continuePrompt","modeselect"].includes(gameState)) return;
    try{ tryPlayBgmFromGesture(); }catch(_){/* ignore */}
    showModeSelectScreen();

  });


pauseCmd && pauseCmd.addEventListener("click", (e) => {
  if(gameState === "playing" && isExtraStage2()){
    pushMsg("⛔ Pause disabled in EX Stage 2", true);
    return;
  }
  // A click is a real user gesture: make resuming audio reliable on Safari/iPad.
  try{ tryPlayBgmFromGesture(); }catch(_){/* ignore */}
  togglePause(true);
});

// Global Pause hotkey (ESC): pause/resume.
window.addEventListener("keydown", (e) => {
  if(e.key !== "Escape") return;
  if(gameState === "playing"){
    if(isExtraStage2()){
      pushMsg("⛔ Pause disabled in EX Stage 2", true);
      return;
    }
    e.preventDefault();
    pauseGame();
  }else if(gameState === "paused"){
    e.preventDefault();
    resumeGame(true);
  }
});

  resetCmd && resetCmd.addEventListener("click", () => {
    if(gameState === "playing" && isExtraStage4() && ex4Phase === 4){
      // Block reset during the fake death phase
      ex4ShowFakeDeath(true);
      overlayDesc.textContent = "HAHAHAHAHAHA";
      ex4PlayResetScare();
      return;
    }
    resetGame();
  });
runCmd.addEventListener("click", () => {
    if(gameState === "playing" && isExtraStage4() && ex4Phase === 4){
      ex4ShowFakeDeath(true);
      overlayDesc.textContent = "HAHAHAHAHAHA";
      ex4PlayResetScare();
      return;
    }
    if(gameState === 'playing' && !window.confirm('Leave this run and return to Mode Select?')) return;
    resetGame();
  });

  answerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    submitAnswer();
  });

  bgmVol.addEventListener("input", () => {
    const v = Number(bgmVol.value) / 100;
    isMuted = false;
    try{ bgm.muted = false; }catch(_){/* ignore */}
    bgmMuteBtn.textContent = "MUTE";
    setBgmVolume(v);
    // Slider movement is a user gesture on most browsers: retry play.
    tryPlayBgm();
  });
  bgmMuteBtn.addEventListener("click", toggleMute);

  document.documentElement.style.setProperty("--wordH", String(30));
  initSfxPool();
  setBgmVolume(0.35);
  function bootGame(){
    try{ renderProfileHeader(); }catch(_){/* ignore */}
    resetGame();
    if(window.RPG_RESUME_MODE_SELECT === true && Number(window.ADVENTURE_PLAYER?.tutorial?.version)!==0){
      window.RPG_RESUME_MODE_SELECT = false;
      showModeSelectScreen();
    }else{
      showIntroStartScreen();
    }
  }

  bootGame();

  requestAnimationFrame(tick);
})();