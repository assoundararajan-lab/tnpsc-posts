/* Live loader: reads new "Daily Current Affairs" posts straight from the Wix blog
   (anonymous visitor token) and turns them into the same day objects as data.json.
   window.tbbLive(afterISO) -> Promise<day[]> (newest first). */
(function(){
var API='https://www.wixapis.com',CID='2eb49247-2b3b-44dd-9e28-65fd8560b7c7';
var MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
function token(){
  try{var t=JSON.parse(sessionStorage.getItem('tbbTok')||'null');if(t&&t.exp>Date.now())return Promise.resolve(t.v)}catch(e){}
  return fetch(API+'/oauth2/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:CID,grantType:'anonymous'})})
    .then(function(r){return r.json()}).then(function(j){
      try{sessionStorage.setItem('tbbTok',JSON.stringify({v:j.access_token,exp:Date.now()+((j.expires_in||14400)-120)*1000}))}catch(e){}
      return j.access_token});
}
function txt(n){return (n.nodes||[]).map(function(c){return c.type==='TEXT'?((c.textData&&c.textData.text)||''):txt(c)}).join('')}
function flat(nodes,out){
  (nodes||[]).forEach(function(n){
    if(n.type==='HEADING')out.push(['H'+(n.headingData&&n.headingData.level),txt(n)]);
    else if(n.type==='PARAGRAPH'){var t=txt(n);if(t.trim())out.push(['P',t])}
    else if(n.type==='BULLETED_LIST'||n.type==='ORDERED_LIST'){(n.nodes||[]).forEach(function(li){out.push(['LI',txt(li)])})}
    else if(n.nodes)flat(n.nodes,out);
  });return out;
}
function cat(en,ta){
  if(/important days|\bday\b|நாள்கள்/i.test(en))return'days';
  if(/award|prize|honour|honor/i.test(en))return'awards';
  if(/grandmaster|chess|tennis|olympic|cricket|wrestl|hockey|football|badminton|athlet|medal|champion|tournament|retires/i.test(en))return'sports';
  if(/director general|appointed|takes charge|sworn in|chief justice|\bceo\b|chairman|governor/i.test(en))return'appt';
  if(/tamil nadu|chennai|vetri|\bTN\b|madurai|coimbatore|tnpsc/i.test(en)||/தமிழ்நாடு|சென்னை/.test(ta))return'tn';
  if(/cop\d|climate|cyclone|wildlife|forest|pollution|monsoon|earthquake|tiger|elephant|biodiversity/i.test(en))return'env';
  if(/₹|crore|export|import|gdp|rbi|bank|rice|omss|margin|loan|price|inflation|tax|gst|trade|economy|budget/i.test(en))return'eco';
  if(/world|international|\bun\b|europe|\beu\b|türkiye|turkey|bulgaria|myanmar|china|usa|russia|japan|nepal|sri lanka|bangladesh|horizon|summit/i.test(en))return'world';
  return'india';
}
function parse(p){
  var m=(p.title||'').match(/Daily Current Affairs\s*[–-]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);if(!m)return null;
  var mi=MONTHS.indexOf(m[2].toLowerCase());if(mi<0)return null;
  var d=m[3]+'-'+String(mi+1).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0');
  var L=flat(p.richContent?p.richContent.nodes:[],[]),n=[],q=[],mode='',cur=null,stage=0,qb=[],ans={};
  L.forEach(function(x){var t=x[0],v=x[1];
    if(t==='H2'){mode=/answer|விடைகள்/i.test(v)?'a':(/practice|வினா/i.test(v)?'q':'n');return}
    if(mode==='n'){
      if(t==='H3'){cur={c:'',t:v.replace(/^\d+\.\s*/,''),s:'',e:'',g:''};n.push(cur);stage=1;return}
      if(!cur)return;
      if(t==='LI'&&stage===1){if(/^நிலையான பொது அறிவு\s*:/.test(v))cur.g=v.replace(/^நிலையான பொது அறிவு\s*:\s*/,'');else if(!cur.s)cur.s=v}
      else if(t==='P'&&stage===1){cur.e=v;stage=2}
    }else if(mode==='q'&&t==='P'){qb.push(v);if(qb.length===3){q.push({q:qb[0].replace(/^\d+\.\s*/,''),qe:qb[1],o:qb[2].split(/\([A-D]\)\s*/).slice(1).map(function(s){return s.trim()}),a:0});qb=[]}}
    else if(mode==='a'&&t==='P'){var re=/(\d+)\s*-\s*([A-D])/g,mm;while((mm=re.exec(v)))ans[+mm[1]]='ABCD'.indexOf(mm[2])}
  });
  q.forEach(function(x,i){if(ans[i+1]!==undefined)x.a=ans[i+1]});
  n.forEach(function(x){x.c=cat(x.e,x.t)});
  if(!n.length)return null;
  var u=p.url?(p.url.base||'')+(p.url.path||''):'https://www.tnpscbestbooks.com/post/'+p.slug;
  return{d:d,u:u,n:n,q:q};
}
window.tbbLive=function(after){
  var out=[],seen={};
  function page(off){
    return token().then(function(tk){
      return fetch(API+'/blog/v3/posts/query',{method:'POST',headers:{'Content-Type':'application/json',Authorization:tk},
        body:JSON.stringify({query:{sort:[{fieldName:'firstPublishedDate',order:'DESC'}],paging:{limit:25,offset:off}},fieldsets:['RICH_CONTENT','URL']})});
    }).then(function(r){return r.json()}).then(function(j){
      var posts=j.posts||[],older=false;
      posts.forEach(function(p){var d=parse(p);if(!d)return;if(d.d<=after){older=true;return}if(!seen[d.d]){seen[d.d]=1;out.push(d)}});
      if(!older&&posts.length===25&&off<100)return page(off+25);
      return out.sort(function(a,b){return b.d.localeCompare(a.d)});
    });
  }
  return page(0).catch(function(){return out});
};
})();
