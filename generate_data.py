import json

mlas = [
    {"mla": "Manjula S.", "party": "BJP", "constituency": "Mahadevapura", "zone": "Mahadevapura"},
    {"mla": "Satish Reddy M.", "party": "BJP", "constituency": "Bommanahalli", "zone": "Bommanahalli"},
    {"mla": "Ramalinga Reddy", "party": "INC", "constituency": "BTM Layout", "zone": "South"},
    {"mla": "Munirathna", "party": "BJP", "constituency": "Raja Rajeshwari Nagar", "zone": "RR Nagar"},
    {"mla": "S. R. Vishwanath", "party": "BJP", "constituency": "Yelahanka", "zone": "Yelahanka"},
    {"mla": "Byrathi Suresh", "party": "INC", "constituency": "Hebbal", "zone": "East"},
    {"mla": "K. J. George", "party": "INC", "constituency": "Sarvagnanagar", "zone": "East"},
    {"mla": "C. K. Ramamurthy", "party": "BJP", "constituency": "Jayanagar", "zone": "South"},
    {"mla": "B. Z. Zameer Ahmed Khan", "party": "INC", "constituency": "Chamrajpet", "zone": "West"},
    {"mla": "Uday B. Garudachar", "party": "BJP", "constituency": "Chickpet", "zone": "South"},
    {"mla": "Aravind Limbavali", "party": "BJP", "constituency": "Mahadevapura", "zone": "Mahadevapura"}
]

wards = []
names = ["Aramane Nagar", "Mathikere", "Malleswaram", "Rajajinagar", "Basavanagudi", "Padmanabhanagar", "BTM Layout", "Jayanagar", "Madivala", "Koramangala", "HSR Layout", "Bommanahalli", "Arekere", "Bilekahalli", "Hongasandra", "Mangammanapalya", "Singasandra", "Arakere", "Hulimavu", "Gottigere", "Konanakunte", "Anjanapura", "Vidyaranyapura", "Yelahanka Satellite Town", "Chowdeshwari", "Attur", "Garudachar Palya", "Kadugodi", "Hagadur", "Doddanekkundi", "Marathahalli", "Varthur", "Bellandur"]

for i in range(1, 226):
    mla = mlas[i % len(mlas)]
    name = names[i % len(names)] + f" (Ward {i})"
    wards.append({
        "id": f"W{i}",
        "name": name,
        "mla": mla["mla"],
        "party": mla["party"],
        "constituency": mla["constituency"],
        "zone": mla["zone"]
    })

with open("data.js", "w") as f:
    f.write(f"const BBMP_WARDS = {json.dumps(wards, indent=2)};\n")

print("Generated data.js with 225 wards")
