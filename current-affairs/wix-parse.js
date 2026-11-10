// Run with Wix ExecuteWixAPI on site 7ff34594-5a64-472e-9de8-006ed28a887d.
// Returns data.json "day" objects for every "Daily Current Affairs" blog post published after AFTER.
// Set AFTER to the ISO date of the newest day already in data.json (e.g. "2026-11-09").
async () => {
  const AFTER = "__AFTER__";
  const body = {
    query: { sort: [{ fieldName: "firstPublishedDate", order: "DESC" }], paging: { limit: 30 } },
    fieldsets: ["RICH_CONTENT", "URL"]
  };
  const r = await wix.request({ method: "POST", url: "https://www.wixapis.com/blog/v3/posts/query", body: body });
  const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  const txt = n => (n.nodes || []).map(c => c.type === "TEXT" ? ((c.textData && c.textData.text) || "") : txt(c)).join("");
  const flat = (nodes, out) => {
    for (const n of nodes || []) {
      if (n.type === "HEADING") out.push(["H" + (n.headingData && n.headingData.level), txt(n)]);
      else if (n.type === "PARAGRAPH") { const t = txt(n); if (t.trim()) out.push(["P", t]); }
      else if (n.type === "BULLETED_LIST" || n.type === "ORDERED_LIST") { for (const li of n.nodes || []) out.push(["LI", txt(li)]); }
      else if (n.nodes) flat(n.nodes, out);
    }
    return out;
  };
  const cat = (en, ta) => {
    const s = en + " " + ta;
    if (/important days|\bday\b|நாள்கள்/i.test(en)) return "days";
    if (/award|prize|honour|honor/i.test(en)) return "awards";
    if (/grandmaster|chess|tennis|olympic|cricket|wrestl|hockey|football|badminton|athlet|medal|champion|tournament|retires/i.test(en)) return "sports";
    if (/director general|appointed|takes charge|sworn in|chief justice|\bceo\b|chairman|governor/i.test(en)) return "appt";
    if (/tamil nadu|chennai|vetri|\bTN\b|madurai|coimbatore|tnpsc/i.test(en) || /தமிழ்நாடு|சென்னை/.test(ta)) return "tn";
    if (/cop\d|climate|cyclone|wildlife|forest|pollution|monsoon|earthquake|tiger|elephant|biodiversity/i.test(en)) return "env";
    if (/₹|crore|export|import|gdp|rbi|bank|rice|omss|margin|loan|price|inflation|tax|gst|trade|economy|budget/i.test(en)) return "eco";
    if (/world|international|\bun\b|europe|\beu\b|türkiye|turkey|bulgaria|myanmar|china|usa|russia|japan|nepal|sri lanka|bangladesh|horizon|summit/i.test(en)) return "world";
    return "india";
  };
  const days = [];
  for (const p of r.posts || []) {
    const m = (p.title || "").match(/Daily Current Affairs\s*[–-]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
    if (!m) continue;
    const mi = MONTHS.indexOf(m[2].toLowerCase());
    if (mi < 0) continue;
    const d = m[3] + "-" + String(mi + 1).padStart(2, "0") + "-" + String(m[1]).padStart(2, "0");
    if (d <= AFTER) continue;
    const L = flat(p.richContent ? p.richContent.nodes : [], []);
    const n = [], q = [];
    let mode = "", cur = null, stage = 0, qbuf = [], ans = {};
    for (const [t, v] of L) {
      if (t === "H2") { mode = /practice|வினா/i.test(v) && !/answer|விடை/i.test(v) ? "q" : (/answer|விடைகள்/i.test(v) ? "a" : "n"); continue; }
      if (mode === "n") {
        if (t === "H3") { cur = { c: "", t: v.replace(/^\d+\.\s*/, ""), s: "", e: "", g: "" }; n.push(cur); stage = 1; continue; }
        if (!cur) continue;
        if (t === "LI" && stage === 1) {
          if (/^நிலையான பொது அறிவு\s*:/.test(v)) cur.g = v.replace(/^நிலையான பொது அறிவு\s*:\s*/, "");
          else if (!cur.s) cur.s = v;
        } else if (t === "P" && stage === 1) { cur.e = v; stage = 2; }
      } else if (mode === "q" && t === "P") {
        qbuf.push(v);
        if (qbuf.length === 3) {
          const opts = qbuf[2].split(/\([A-D]\)\s*/).slice(1).map(s => s.trim());
          q.push({ q: qbuf[0].replace(/^\d+\.\s*/, ""), qe: qbuf[1], o: opts, a: 0 });
          qbuf = [];
        }
      } else if (mode === "a" && t === "P") {
        for (const mm of v.matchAll(/(\d+)\s*-\s*([A-D])/g)) ans[Number(mm[1])] = "ABCD".indexOf(mm[2]);
      }
    }
    q.forEach((x, i) => { if (ans[i + 1] !== undefined) x.a = ans[i + 1]; });
    n.forEach(x => { x.c = cat(x.e, x.t); });
    const url = p.url ? (p.url.base || "") + (p.url.path || "") : "https://www.tnpscbestbooks.com/post/" + p.slug;
    days.push({ d: d, u: url, n: n, q: q, _check: { items: n.length, qs: q.length, answers: Object.keys(ans).length } });
  }
  return days;
}
