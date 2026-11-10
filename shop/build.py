#!/usr/bin/env python3
"""Build a fast static shop page (shop/index.html) from Wix product data (products.json)."""
import json, html, sys, re

RAW, OUT = sys.argv[1], sys.argv[2]
WA = "919994444678"
PHONE = "9600777509"

CATS = [
    ("all", "அனைத்தும்"),
    ("g4", "குரூப் 4 & VAO"),
    ("g2", "குரூப் 2 / 2A"),
    ("g1", "குரூப் 1"),
    ("pol", "காவல் / TNUSRB"),
    ("tet", "TET / TRB"),
    ("rly", "ரயில்வே / SSC"),
    ("mat", "கணிதம் & திறனறிவு"),
    ("tnp", "TNPSC பொது"),
    ("cmb", "காம்போ செட்"),
]


def cats_for(n):
    c = []
    if re.search(r"Group 4|CCSE-IV|VAO", n): c.append("g4")
    if re.search(r"Group 2|CCSE-II|2A", n): c.append("g2")
    if re.search(r"Group 1", n): c.append("g1")
    if re.search(r"TNUSRB|Police", n): c.append("pol")
    if re.search(r"TET|TRB", n): c.append("tet")
    if re.search(r"RRB|Railway|SSC", n): c.append("rly")
    if re.search(r"Maths|Aptitude|Arithmetic|Reasoning", n): c.append("mat")
    if "TNPSC" in n or "Samacheer" in n: c.append("tnp")
    if re.search(r"Combo|Set of", n): c.append("cmb")
    return c


def img(id_, w, h):
    return f"https://static.wixstatic.com/media/{id_}/v1/fill/w_{w},h_{h},al_c,q_75,enc_auto/b.jpg"


def money(a):
    v = float(a)
    return f"{v:,.0f}" if v == int(v) else f"{v:,.2f}"


items = [p for p in json.load(open(RAW)) if p.get("visible")]
# ribboned (best sellers) first, keep store order otherwise
items.sort(key=lambda p: 0 if p.get("ribbon") else 1)

prods, cards, ld = [], [], []
for i, p in enumerate(items):
    price = float(p["price"]["minValue"]["amount"])
    mrp = float((p.get("compare") or {}).get("minValue", {}).get("amount", 0) or 0)
    off = round((1 - price / mrp) * 100) if mrp > price else 0
    instock = p["stock"]["availabilityStatus"] != "OUT_OF_STOCK"
    rib = (p.get("ribbon") or {}).get("name", "")
    url = p["url"]["url"]
    c = cats_for(p["name"])
    prods.append({"i": i, "n": p["name"], "p": price, "u": url, "id": p["id"]})
    e = html.escape
    lazy = 'loading="lazy" decoding="async"' if i >= 4 else ('fetchpriority="high"' if i < 2 else "")
    im = p["img"]["id"]
    cards.append(f"""<article class="card" data-i="{i}" data-c="{' '.join(c)}" data-p="{price:g}" data-o="{off}">
<a class="ph" href="{e(url)}" aria-label="{e(p['name'])}"><img src="{img(im,300,384)}" srcset="{img(im,300,384)} 300w, {img(im,450,576)} 450w" sizes="(min-width:960px) 220px, 46vw" width="300" height="384" alt="{e(p['name'])}" {lazy}>{f'<span class="rib">{e(rib)}</span>' if rib else ''}{f'<span class="off">-{off}%</span>' if off else ''}</a>
<h3>{e(p['name'])}</h3>
<div class="pr"><b>₹{money(price)}</b>{f'<s>₹{money(mrp)}</s>' if mrp > price else ''}</div>
{'<button class="add" type="button">கார்ட்டில் சேர் +</button><a class="wa1" href="#" rel="nofollow">WhatsApp-ல் ஆர்டர்</a>' if instock else '<p class="oos">ஸ்டாக் இல்லை</p>'}
<a class="pay" href="{e(url)}">ஆன்லைனில் பணம் செலுத்த →</a>
</article>""")
    ld.append({"@type": "ListItem", "position": i + 1, "url": url, "name": p["name"]})

chips = "".join(
    f'<button type="button" class="chip{" on" if k == "all" else ""}" data-k="{k}">{v}</button>' for k, v in CATS
)
jsonld = json.dumps({"@context": "https://schema.org", "@type": "ItemList", "name": "TNPSC Best Books – Kaniyan Books", "itemListElement": ld}, ensure_ascii=False)
data = json.dumps(prods, ensure_ascii=False, separators=(",", ":"))

tpl = open(__file__.replace("build.py", "template.html")).read()
out = (tpl.replace("{{CHIPS}}", chips).replace("{{CARDS}}", "\n".join(cards))
       .replace("{{DATA}}", data).replace("{{JSONLD}}", jsonld)
       .replace("{{WA}}", WA).replace("{{PHONE}}", PHONE).replace("{{COUNT}}", str(len(items))))
open(OUT, "w").write(out)
print("built", len(items), "products,", len(out), "bytes")

pl = open(__file__.replace("build.py", "paylink-template.html")).read().replace("{{DATA}}", data)
open(OUT.replace("index.html", "paylink.html"), "w").write(pl)
print("built paylink.html")
