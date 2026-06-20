import json

for path in [r"c:\Users\HP\Desktop\Round 2 new\Backend\TraffIQ.ipynb", r"c:\Users\HP\Desktop\Round 2 new\Backend\tr2.ipynb"]:
    with open(path, 'r', encoding='utf-8') as f:
        nb = json.load(f)
    print(f"\n--- FILE: {path} ---")
    types = {}
    for idx, cell in enumerate(nb['cells']):
        t = cell['cell_type']
        types[t] = types.get(t, 0) + 1
    print("Cell types:", types)
