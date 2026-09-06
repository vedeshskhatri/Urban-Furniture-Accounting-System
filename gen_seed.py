#!/usr/bin/env python3
"""
Urban Furniture — seed data generator.
Produces db/seed_data.sql: products, contacts, and ~4 months of balanced
transaction history.

Every journal entry it emits balances. Run verify at the end.
"""
import random
import hashlib
from decimal import Decimal, ROUND_HALF_UP
from datetime import date, timedelta

random.seed(20260905)          # deterministic — same output every run

D = lambda x: Decimal(str(x)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

# ── account / journal ids (must match seed.sql) ───────────────────────────
BANK, CASH, DEBTORS, CREDITORS = 1, 2, 3, 4
SALES_INC, PURCH_EXP, OTHER_EXP, CAPITAL = 5, 6, 7, 8
INPUT_TAX, OUTPUT_TAX = 9, 10
J_SALES, J_PURCHASE, J_BANK, J_CASH = 1, 2, 3, 4

TAX = D('18.00')
START = date(2026, 5, 1)
END   = date(2026, 8, 31)

# ── product catalogue ─────────────────────────────────────────────────────
BASE = [
    # (name, category, base_price, variant_group)
    ("Aspen Lounge Sofa",       "Seating", 42000, "sofa"),
    ("Meridian Sectional",      "Seating", 68000, "sofa"),
    ("Bramble Accent Chair",    "Seating", 14500, "chair"),
    ("Kestrel Armchair",        "Seating", 18900, "chair"),
    ("Nordic Recliner",         "Seating", 34500, "chair"),
    ("Verona Chesterfield",     "Seating", 76000, "sofa"),
    ("Atlas Office Chair",      "Seating",  9800, "chair"),
    ("Ridgeway Bench",          "Seating", 11200, "chair"),
    ("Cove Loveseat",           "Seating", 31000, "sofa"),
    ("Ellis Wingback",          "Seating", 22400, "chair"),
    ("Tamsin Slipper Chair",    "Seating", 12600, "chair"),
    ("Grove Ottoman",           "Seating",  8900, "chair"),

    ("Harrow Dining Table",     "Tables",  38000, "dining"),
    ("Fenwick Extending Table", "Tables",  54000, "dining"),
    ("Juniper Coffee Table",    "Tables",  12800, "small"),
    ("Marlow Console",          "Tables",  16500, "small"),
    ("Oakridge Writing Desk",   "Tables",  24000, "small"),
    ("Sable Side Table",        "Tables",   6400, "small"),
    ("Thatcher Farmhouse Table","Tables",  46500, "dining"),
    ("Linden Nesting Tables",   "Tables",   9200, "small"),
    ("Bexley Bar Table",        "Tables",  19800, "dining"),
    ("Wren Bedside Table",      "Tables",   7600, "small"),
    ("Pell Nest Stool",         "Tables",   4800, "small"),

    ("Ashford Wardrobe",        "Storage", 52000, "storage"),
    ("Calder Bookcase",         "Storage", 18400, "storage"),
    ("Hollis Sideboard",        "Storage", 34000, "storage"),
    ("Pike Chest of Drawers",   "Storage", 26500, "storage"),
    ("Rowan Shoe Cabinet",      "Storage", 11800, "storage"),
    ("Thornbury Display Unit",  "Storage", 29000, "storage"),
    ("Quill Filing Cabinet",    "Storage", 14200, "storage"),
    ("Alder TV Unit",           "Storage", 21500, "storage"),
    ("Merrick Sideboard Tall",  "Storage", 31200, "storage"),

    ("Solstice Bed Frame",      "Beds",    44000, "bed"),
    ("Halcyon Platform Bed",    "Beds",    38500, "bed"),
    ("Wexford Upholstered Bed", "Beds",    58000, "bed"),
    ("Drift Storage Bed",       "Beds",    62000, "bed"),
    ("Cirrus Mattress",         "Beds",    28000, "bed"),
    ("Nimbus Memory Mattress",  "Beds",    36500, "bed"),

    ("Lumen Floor Lamp",        "Lighting", 8400, "finish"),
    ("Beacon Pendant Light",    "Lighting", 6900, "finish"),
    ("Ember Table Lamp",        "Lighting", 4200, "finish"),
    ("Halo Arc Lamp",           "Lighting",11500, "finish"),
    ("Corbel Wall Sconce",      "Lighting", 5200, "finish"),

    ("Loom Area Rug",           "Decor",   15800, "finish"),
    ("Tessel Wall Mirror",      "Decor",    9400, "finish"),
    ("Fen Cushion Set",         "Decor",    2800, "finish"),
    ("Brook Throw Blanket",     "Decor",    3400, "finish"),
    ("Cairn Planter",           "Decor",    2200, "finish"),
    ("Vale Table Runner",       "Decor",    1900, "finish"),
]

VARIANTS = {
    "sofa":    [("Leather", 1.28), ("Velvet", 1.12), ("Linen", 1.00)],
    "chair":   [("Leather", 1.24), ("Fabric", 1.00), ("Cane", 1.08)],
    "dining":  [("Teak", 1.30), ("Sheesham", 1.14), ("Mango Wood", 1.00)],
    "small":   [("Walnut", 1.18), ("Oak", 1.06), ("White Ash", 1.00)],
    "storage": [("Walnut", 1.20), ("Oak", 1.08), ("Matte White", 1.00)],
    "bed":     [("Upholstered", 1.16), ("Solid Wood", 1.00)],
    "finish":  [("Brass", 1.14), ("Matte Black", 1.00), ("Brushed Nickel", 1.07)],
}
SIZES = {
    "sofa":    [("2 Seater", 0.82), ("3 Seater", 1.00), ("4 Seater", 1.22)],
    "dining":  [("4 Seater", 0.86), ("6 Seater", 1.00), ("8 Seater", 1.24)],
    "storage": [("2 Door", 0.88), ("3 Door", 1.00), ("4 Door", 1.18)],
    "chair":   [("Standard", 1.00), ("Wide", 1.14)],
    "small":   [("Compact", 0.88), ("Standard", 1.00)],
    "bed":     [("Single", 1.00), ("Queen", 1.12), ("King", 1.28)],
}
COST_RATIO = {"Seating": 0.58, "Tables": 0.62, "Storage": 0.60,
              "Beds": 0.55, "Lighting": 0.52, "Decor": 0.48}
PREFIX = {"Seating": "SEA", "Tables": "TAB", "Storage": "STO",
          "Beds": "BED", "Lighting": "LIT", "Decor": "DEC"}

FIRST = ["Nimesh","Rahul","Priya","Anand","Kavita","Devesh","Meera","Sanjay",
         "Rhea","Vikram","Ananya","Harsh","Ishita","Rohan","Tara","Kunal",
         "Neha","Arjun","Divya","Manav","Sneha","Aditya","Pooja","Nikhil"]
LAST  = ["Pathak","Sharma","Desai","Mehta","Iyer","Rao","Kulkarni","Bhatt",
         "Nair","Joshi","Shah","Reddy","Chauhan","Gupta","Menon","Trivedi"]
FIRMS = ["Azure Furniture","Teakwood Traders","Sunrise Timber Co",
         "Meridian Fabrics","Ironwood Hardware","Lakeside Upholstery",
         "Granite Fittings","Cedar & Co","Northline Foam","Vertex Glassworks"]
CITIES = [("Ahmedabad","Gujarat","380001"),("Gandhinagar","Gujarat","382010"),
          ("Surat","Gujarat","395003"),("Vadodara","Gujarat","390001"),
          ("Mumbai","Maharashtra","400001"),("Pune","Maharashtra","411001"),
          ("Bengaluru","Karnataka","560001"),("Jaipur","Rajasthan","302001")]

ANALYTICS = [(1,"Showroom - Gandhinagar","income"),(2,"Showroom - Ahmedabad","income"),
             (3,"Online Channel","income"),(4,"Raw Material Purchase","expense"),
             (5,"Workshop Operations","expense"),(6,"Showroom Fitout","expense")]

def esc(s): return s.replace("'", "''")
def rd():   return START + timedelta(days=random.randint(0, (END-START).days))

# ── build products ────────────────────────────────────────────────────────
products, pid = [], 0
seq = {k: 0 for k in PREFIX}
for name, cat, price, grp in BASE:
    combos = [("", 1.0)]
    if grp:
        combos = [(m, mm) for m, mm in VARIANTS[grp]]
        if grp in SIZES:
            combos = [(f"{m}, {s}", mm*sm) for m, mm in VARIANTS[grp]
                                            for s, sm in SIZES[grp]]
    for label, mult in combos:
        pid += 1
        seq[cat] += 1
        full = f"{name} — {label}" if label else name
        sp = D(price * mult)
        products.append({
            "id": pid, "name": full, "cat": cat,
            "sku": f"{PREFIX[cat]}-{seq[cat]:04d}",
            "sales": sp,
            "cost": D(sp * Decimal(str(COST_RATIO[cat]))),
            "mrp": D(sp * Decimal('1.15')),
        })

# ── build contacts ────────────────────────────────────────────────────────
contacts, cid = [], 0
for f in FIRMS:                                   # vendors
    cid += 1; c = random.choice(CITIES)
    contacts.append({"id": cid, "name": f, "type": "vendor", "city": c})
for i in range(34):                               # customers
    cid += 1; c = random.choice(CITIES)
    nm = f"{random.choice(FIRST)} {random.choice(LAST)}"
    contacts.append({"id": cid, "name": nm, "type": "customer", "city": c})
vendors   = [c for c in contacts if c["type"] == "vendor"]
customers = [c for c in contacts if c["type"] == "customer"]

# ── GSTIN registration (state code + plausible PAN block) ─────────────────
_STATE_CODE = {"Maharashtra": "27", "Gujarat": "24", "Rajasthan": "08",
               "Karnataka": "29", "Tamil Nadu": "33", "Delhi": "07"}
def _assign_gstin(c):
    # suppliers almost always registered; ~35% of customers (corporate buyers)
    reg_pct = 85 if c["type"] in ("vendor", "both") else 35
    if (c["id"] * 7 + 3) % 100 >= reg_pct:
        c["gstin"] = None
        return
    st = c["city"][1] if isinstance(c["city"], (list, tuple)) else ""
    code = _STATE_CODE.get(st, "27")
    h = hashlib.md5(c["name"].encode()).hexdigest()
    letters = "ABCDEFGHIJKLMNOP"
    p1 = "".join(letters[int(ch, 16)] for ch in h[:5])
    p3 = letters[int(h[5], 16)]
    chk = letters[int(hashlib.md5((c["name"] + ":chk").encode()).hexdigest()[0], 16)]
    c["gstin"] = f"{code}{p1}{(c['id'] * 137 + 11) % 10000:04d}{p3}1Z{chk}"
for c in contacts:
    _assign_gstin(c)

# ── ledger accumulators ───────────────────────────────────────────────────
sql, entries, lines = [], [], []
eid = 0

def entry(dt, journal, src_type, src_id, number, ls):
    """ls = [(account, partner, analytic, debit, credit)]"""
    global eid
    eid += 1
    if not number:
        number = f"JE/2026/{eid:04d}"
    d = sum(l[3] for l in ls); c = sum(l[4] for l in ls)
    assert d == c, f"UNBALANCED entry {eid}: {d} vs {c}"
    entries.append((eid, number, dt, journal, src_type, src_id))
    for a, p, an, db, cr in ls:
        lines.append((eid, a, p, an, db, cr))
    return eid

# ── opening capital ───────────────────────────────────────────────────────
entry(date(2026,4,1), J_BANK, None, None, 'JE/2026/0001',
      [(BANK, None, None, D(1800000), D(0)),
       (CASH, None, None, D(200000),  D(0)),
       (CAPITAL, None, None, D(0), D(2000000))])

# ── purchase cycle ────────────────────────────────────────────────────────
bills, po_n, bill_n = [], 0, 0
for i in range(180):
    v = random.choice(vendors)
    dt = rd()
    items = random.sample(products, random.randint(1, 4))
    an = random.choice([4, 5])
    ls_doc, sub = [], D(0)
    for p in items:
        q = random.randint(2, 12)
        up = D(p["cost"] * Decimal('0.97'))
        ls_doc.append((p["id"], q, up, an))
        sub += D(up * q)
    tax = D(sub * TAX / 100); tot = sub + tax
    bill_n += 1
    has_po = random.random() < 0.65
    po_id = None
    if has_po:
        po_n += 1; po_id = po_n
        sql.append(f"INSERT INTO purchase_orders (id,number,vendor_id,order_date,status,total) "
                   f"OVERRIDING SYSTEM VALUE VALUES ({po_id},'P{po_n:05d}',{v['id']},'{dt - timedelta(days=random.randint(2,10))}','confirmed',{sub});")
        for n,(pr,q,up,a) in enumerate(ls_doc,1):
            line_total = D(up * q)
            sql.append(f"INSERT INTO purchase_order_lines (po_id,line_no,product_id,analytic_account_id,qty,unit_price,total) "
                       f"VALUES ({po_id},{n},{pr},{a},{q},{up},{line_total});")
    num = f"Bill/2026/{bill_n:04d}"
    sql.append(f"INSERT INTO vendor_bills (id,number,bill_reference,vendor_id,po_id,bill_date,due_date,status,subtotal,tax_total,total) "
               f"OVERRIDING SYSTEM VALUE VALUES ({bill_n},'{num}','{v['name'][:3].upper()}-26-{bill_n:03d}',{v['id']},"
               f"{po_id if po_id else 'NULL'},'{dt}','{dt+timedelta(days=30)}','confirmed',{sub},{tax},{tot});")
    for n,(pr,q,up,a) in enumerate(ls_doc,1):
        line_sub = D(up * q); line_tax = D(line_sub * TAX / 100); line_tot = line_sub + line_tax
        sql.append(f"INSERT INTO vendor_bill_lines (bill_id,line_no,product_id,account_id,analytic_account_id,qty,unit_price,tax_rate,subtotal,tax_amount,total) "
                   f"VALUES ({bill_n},{n},{pr},{PURCH_EXP},{a},{q},{up},{TAX},{line_sub},{line_tax},{line_tot});")
        sql.append(f"INSERT INTO stock_moves (product_id,qty_change,source_type,source_id,move_date) "
                   f"VALUES ({pr},{q},'bill',{bill_n},'{dt}');")
    e = entry(dt, J_PURCHASE, 'bill', bill_n, num,
              [(PURCH_EXP, v['id'], an, sub, D(0)),
               (INPUT_TAX, None, None, tax, D(0)),
               (CREDITORS, v['id'], None, D(0), tot)])
    sql.append(f"UPDATE vendor_bills SET journal_entry_id={e} WHERE id={bill_n};")
    bills.append({"id": bill_n, "vendor": v, "total": tot, "date": dt})

# ── sales cycle ───────────────────────────────────────────────────────────
invoices, so_n, inv_n = [], 0, 0
for i in range(300):
    cu = random.choice(customers)
    dt = rd()
    items = random.sample(products, random.randint(1, 5))
    an = random.choice([1, 2, 3])
    ls_doc, sub = [], D(0)
    for p in items:
        q = random.randint(1, 4)
        disc = Decimal(str(random.choice([1.0, 1.0, 1.0, 0.95, 0.92])))
        up = D(p["sales"] * disc)
        ls_doc.append((p["id"], q, up, an))
        sub += D(up * q)
    tax = D(sub * TAX / 100); tot = sub + tax
    inv_n += 1
    has_so = random.random() < 0.7
    so_id = None
    if has_so:
        so_n += 1; so_id = so_n
        sql.append(f"INSERT INTO sales_orders (id,number,customer_id,order_date,status,total) "
                   f"OVERRIDING SYSTEM VALUE VALUES ({so_id},'SO/2026/{so_n:04d}',{cu['id']},'{dt - timedelta(days=random.randint(1,7))}','confirmed',{sub});")
        for n,(pr,q,up,a) in enumerate(ls_doc,1):
            line_sub = D(up * q); line_tax = D(line_sub * TAX / 100); line_tot = line_sub + line_tax
            sql.append(f"INSERT INTO sales_order_lines (so_id,line_no,product_id,analytic_account_id,qty,unit_price,tax_rate,subtotal,tax_amount,total) "
                       f"VALUES ({so_id},{n},{pr},{a},{q},{up},{TAX},{line_sub},{line_tax},{line_tot});")
    num = f"Inv/2026/{inv_n:04d}"
    sql.append(f"INSERT INTO customer_invoices (id,number,customer_id,so_id,invoice_date,due_date,status,subtotal,tax_total,total) "
               f"OVERRIDING SYSTEM VALUE VALUES ({inv_n},'{num}',{cu['id']},{so_id if so_id else 'NULL'},'{dt}','{dt+timedelta(days=random.choice([15,30,45,60]))}','confirmed',{sub},{tax},{tot});")
    for n,(pr,q,up,a) in enumerate(ls_doc,1):
        line_sub = D(up * q); line_tax = D(line_sub * TAX / 100); line_tot = line_sub + line_tax
        sql.append(f"INSERT INTO customer_invoice_lines (invoice_id,line_no,product_id,account_id,analytic_account_id,qty,unit_price,tax_rate,subtotal,tax_amount,total) "
                   f"VALUES ({inv_n},{n},{pr},{SALES_INC},{a},{q},{up},{TAX},{line_sub},{line_tax},{line_tot});")
        sql.append(f"INSERT INTO stock_moves (product_id,qty_change,source_type,source_id,move_date) "
                   f"VALUES ({pr},-{q},'invoice',{inv_n},'{dt}');")
    e = entry(dt, J_SALES, 'invoice', inv_n, num,
              [(DEBTORS, cu['id'], None, tot, D(0)),
               (SALES_INC, cu['id'], an, D(0), sub),
               (OUTPUT_TAX, None, None, D(0), tax)])
    sql.append(f"UPDATE customer_invoices SET journal_entry_id={e} WHERE id={inv_n};")
    invoices.append({"id": inv_n, "cust": cu, "total": tot, "date": dt})

# ── payments: mix of full / partial / instalment / unpaid ─────────────────
pay_n = 0
def pay(direction, partner, method, dt, amount, inv=None, bill=None):
    global pay_n
    pay_n += 1
    j = J_BANK if method == 'bank' else J_CASH
    acct = BANK if method == 'bank' else CASH
    num = f"PAY/2026/{pay_n:04d}"
    sql.append(f"INSERT INTO payments (id,number,direction,partner_id,method,payment_date,amount) "
               f"OVERRIDING SYSTEM VALUE VALUES ({pay_n},'{num}','{direction}',{partner},'{method}','{dt}',{amount});")
    sql.append(f"INSERT INTO payment_allocations (payment_id,invoice_id,bill_id,amount) "
               f"VALUES ({pay_n},{inv if inv else 'NULL'},{bill if bill else 'NULL'},{amount});")
    if direction == 'inbound':
        ls = [(acct, None, None, amount, D(0)), (DEBTORS, partner, None, D(0), amount)]
    else:
        ls = [(CREDITORS, partner, None, amount, D(0)), (acct, None, None, D(0), amount)]
    e = entry(dt, j, 'payment', pay_n, num, ls)
    sql.append(f"UPDATE payments SET journal_entry_id={e} WHERE id={pay_n};")

for inv in invoices:
    r = random.random()
    m = random.choice(['bank', 'bank', 'bank', 'cash'])
    if r < 0.55:                                    # paid in full
        pay('inbound', inv['cust']['id'], m,
            inv['date'] + timedelta(days=random.randint(0, 25)), inv['total'], inv=inv['id'])
    elif r < 0.75:                                  # two instalments
        h = D(inv['total'] / 2)
        pay('inbound', inv['cust']['id'], m,
            inv['date'] + timedelta(days=random.randint(1, 15)), h, inv=inv['id'])
        pay('inbound', inv['cust']['id'], m,
            inv['date'] + timedelta(days=random.randint(40, 90)), inv['total'] - h, inv=inv['id'])
    elif r < 0.88:                                  # partial only — still outstanding
        part = D(inv['total'] * Decimal(str(random.choice([0.3, 0.4, 0.5, 0.6]))))
        pay('inbound', inv['cust']['id'], m,
            inv['date'] + timedelta(days=random.randint(5, 30)), part, inv=inv['id'])
    # else: unpaid

for b in bills:
    r = random.random()
    m = random.choice(['bank', 'bank', 'cash'])
    if r < 0.7:
        pay('outbound', b['vendor']['id'], m,
            b['date'] + timedelta(days=random.randint(5, 35)), b['total'], bill=b['id'])
    elif r < 0.85:
        part = D(b['total'] * Decimal('0.5'))
        pay('outbound', b['vendor']['id'], m,
            b['date'] + timedelta(days=random.randint(5, 30)), part, bill=b['id'])

# ── operating expenses (manual entries, no source document) ───────────────
EXPENSES = [("Showroom rent", 85000), ("Staff salaries", 240000),
            ("Electricity", 18500), ("Transport & delivery", 32000),
            ("Marketing", 45000), ("Workshop consumables", 27500)]
for month in range(4):
    d0 = date(2026, 5 + month, 28)
    for label, amt in EXPENSES:
        a = D(amt * Decimal(str(random.uniform(0.9, 1.1))))
        entry(d0, J_BANK, None, None, None,
              [(OTHER_EXP, None, 5, a, D(0)), (BANK, None, None, D(0), a)])

# ── one reversal, to prove corrections work ───────────────────────────────
orig = entry(date(2026, 7, 12), J_BANK, None, None, None,
             [(OTHER_EXP, None, 5, D(12000), D(0)), (BANK, None, None, D(0), D(12000))])
rev = entry(date(2026, 7, 13), J_BANK, None, None, None,
            [(BANK, None, None, D(12000), D(0)), (OTHER_EXP, None, 5, D(0), D(12000))])
reversal_of = {rev: orig}

# ── emit ──────────────────────────────────────────────────────────────────
out = ["-- Urban Furniture — generated seed data",
       "-- Deterministic (seed 20260905). Regenerate with tools/gen_seed.py",
       "-- cost_price and tax rates are synthetic; catalogue prices are retail only.",
       "BEGIN;", ""]

out.append("-- analytic accounts")
for i, n, t in ANALYTICS:
    out.append(f"INSERT INTO analytic_accounts (id,name,type) OVERRIDING SYSTEM VALUE VALUES ({i},'{esc(n)}','{t}');")

out.append("\n-- contacts")
for c in contacts:
    city, st, pin = c["city"]
    em = c["name"].lower().replace(" ", ".").replace("&", "and") + "@example.com"
    g = c.get("gstin")
    gcol = ",gstin" if g else ""
    gval = f",'{g}'" if g else ""
    out.append(f"INSERT INTO contacts (id,name,type,email,mobile,city,state,pincode{gcol}) "
               f"OVERRIDING SYSTEM VALUE VALUES ({c['id']},'{esc(c['name'])}','{c['type']}','{esc(em)}',"
               f"'9{random.randint(100000000,999999999)}','{city}','{st}','{pin}'{gval});")

out.append("\n-- products")
for p in products:
    out.append(f"INSERT INTO products (id,sku,name,type,category,sales_price,cost_price,mrp,tax_rate,stock_qty) "
               f"OVERRIDING SYSTEM VALUE VALUES ({p['id']},'{p['sku']}','{esc(p['name'])}','goods','{p['cat']}',"
               f"{p['sales']},{p['cost']},{p['mrp']},{TAX},0);")

out.append("\n-- budgets")
out.append("INSERT INTO budgets (id,name,period_start,period_end,responsible_user_id,status) OVERRIDING SYSTEM VALUE VALUES "
           "(1,'Q2 Showroom Revenue','2026-05-01','2026-07-31',1,'confirmed'),"
           "(2,'Q2 Raw Material','2026-05-01','2026-07-31',1,'confirmed'),"
           "(3,'Showroom Fitout','2026-06-01','2026-08-31',1,'draft');")
out.append("INSERT INTO budget_lines (budget_id,analytic_account_id,committed_amount) VALUES "
           "(1,1,4500000),(1,2,3200000),(1,3,1800000),"
           "(2,4,2800000),(2,5,900000),(3,6,1200000);")

out.append("\n-- ledger")
for i, num, dt, j, st, sid in entries:
    n = f"'{num}'" if num else "NULL"
    s = f"'{st}'" if st else "NULL"
    ro = reversal_of.get(i)
    out.append(f"INSERT INTO journal_entries (id,number,entry_date,journal_id,status,source_type,source_id,reversal_of) "
               f"OVERRIDING SYSTEM VALUE VALUES ({i},{n},'{dt}',{j},'posted',{s},{sid if sid else 'NULL'},{ro if ro else 'NULL'});")
for e, a, p, an, db, cr in lines:
    out.append(f"INSERT INTO journal_entry_lines (entry_id,account_id,partner_id,analytic_account_id,debit,credit) "
               f"VALUES ({e},{a},{p if p else 'NULL'},{an if an else 'NULL'},{db},{cr});")

out.append("\n-- documents")
out.extend(sql)

out.append("\n-- resync sequences")
for t in ["contacts","products","analytic_accounts","budgets","budget_lines",
          "purchase_orders","purchase_order_lines","vendor_bills","vendor_bill_lines",
          "sales_orders","sales_order_lines","customer_invoices","customer_invoice_lines",
          "payments","payment_allocations","journal_entries","journal_entry_lines","stock_moves"]:
    out.append(f"SELECT setval(pg_get_serial_sequence('{t}','id'), COALESCE((SELECT MAX(id) FROM {t}),1));")
out.append(f"UPDATE doc_sequences SET current_number={po_n}   WHERE code='PO';")
out.append(f"UPDATE doc_sequences SET current_number={bill_n} WHERE code='BILL';")
out.append(f"UPDATE doc_sequences SET current_number={inv_n}  WHERE code='INV';")
out.append(f"UPDATE doc_sequences SET current_number={so_n}   WHERE code='SO';")
out.append(f"UPDATE doc_sequences SET current_number={pay_n}  WHERE code='PAY';")
out.append(f"UPDATE doc_sequences SET current_number={eid}    WHERE code='JE';")
out.append("\n-- refresh cached stock")
out.append("UPDATE products p SET stock_qty = COALESCE("
           "(SELECT SUM(qty_change) FROM stock_moves m WHERE m.product_id=p.id),0);")
out.append("\nCOMMIT;")

open("seed_data.sql", "w", encoding="utf-8").write("\n".join(out) + "\n")

td = sum(l[4] for l in lines); tc = sum(l[5] for l in lines)
print(f"products            {len(products)}")
print(f"contacts            {len(contacts)}  ({len(vendors)} vendors / {len(customers)} customers)")
print(f"purchase orders     {po_n}")
print(f"vendor bills        {bill_n}")
print(f"sales orders        {so_n}")
print(f"customer invoices   {inv_n}")
print(f"payments            {pay_n}")
print(f"journal entries     {eid}")
print(f"journal lines       {len(lines)}")
print(f"SQL statements      {len(out)}")
print(f"\ntotal debit  {td}")
print(f"total credit {tc}")
print(f"DIFFERENCE   {td - tc}")
assert td == tc, "LEDGER OUT OF BALANCE"
