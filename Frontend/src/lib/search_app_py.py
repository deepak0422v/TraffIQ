import sys

with open(r"c:\Users\HP\Desktop\Round 2 new\Backend\app.py", 'r', encoding='utf-8') as f:
    lines = f.readlines()

out_lines = ["--- MAP AND COORDINATES IN APP.PY ---"]
for idx, line in enumerate(lines):
    if any(k in line for k in ['folium.Map', 'Marker', 'latitude', 'longitude', 'lat', 'lng', 'coord', 'BENGALURU_CENTER']):
        out_lines.append(f"Line {idx+1}: {line.strip()}")

with open("search_results.txt", "w", encoding="utf-8") as out:
    out.write("\n".join(out_lines))

print("Search results written to search_results.txt")
