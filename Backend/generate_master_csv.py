import os
import re
import pandas as pd
import numpy as np

# Define base directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def main():
    print("Starting generation of junction_master.csv...")
    
    # 1. Load PDI data
    pdi_path = os.path.join(BASE_DIR, "junction_pdi_final.csv")
    if not os.path.exists(pdi_path):
        print(f"Error: PDI file not found at {pdi_path}")
        return
    pdi_df = pd.read_csv(pdi_path)
    print(f"Loaded PDI data: {pdi_df.shape[0]} rows")
    
    # 2. Load Behavior data
    behavior_path = os.path.join(BASE_DIR, "junction_behavior_final.csv")
    if not os.path.exists(behavior_path):
        print(f"Error: Behavior file not found at {behavior_path}")
        return
    behavior_df = pd.read_csv(behavior_path)
    print(f"Loaded Behavior data: {behavior_df.shape[0]} rows")
    
    # 3. Load Raw data for coordinates
    raw_path = os.path.join(BASE_DIR, "jan to may police violation_anonymized791b166.csv")
    if not os.path.exists(raw_path):
        print(f"Error: Raw dataset file not found at {raw_path}")
        return
        
    print("Reading raw dataset to extract coordinates (this might take a few seconds)...")
    # Read only required columns to save RAM and time
    raw_df = pd.read_csv(raw_path, usecols=["junction_name", "latitude", "longitude"])
    
    # Drop rows with null coordinates or invalid coordinate ranges for Bangalore (lat ~ 12.9, lon ~ 77.6)
    valid_geo = raw_df.dropna(subset=["latitude", "longitude"])
    valid_geo = valid_geo[
        (valid_geo["latitude"].between(12.7, 13.2)) & 
        (valid_geo["longitude"].between(77.3, 77.9))
    ]
    
    # Compute mean coordinates per junction
    print("Computing mean coordinates per junction...")
    geo_df = valid_geo.groupby("junction_name")[["latitude", "longitude"]].mean().reset_index()
    geo_df.rename(columns={"latitude": "lat", "longitude": "lng"}, inplace=True)
    print(f"Extracted coordinates for {geo_df.shape[0]} junctions")
    
    # 4. Merge datasets
    merged = pd.merge(pdi_df, behavior_df, on="junction_name", how="outer")
    merged = pd.merge(merged, geo_df, on="junction_name", how="left")
    
    # Drop any row without PDI or behavior data
    merged.dropna(subset=["PDI", "hotspot_type"], inplace=True)
    print(f"Merged PDI, Behavior, and Geo data: {merged.shape[0]} rows")
    
    # 5. Extract canonical IDs and clean names
    junction_ids = []
    clean_names = []
    
    id_pattern = re.compile(r'^(BTP\d{3})\s*-\s*(.*)$')
    
    for idx, row in merged.iterrows():
        name = str(row["junction_name"])
        match = id_pattern.match(name)
        if match:
            junction_ids.append(match.group(1))
            clean_names.append(match.group(2))
        else:
            # Fallback if name is in different format
            junction_ids.append(f"BTP{idx:03d}")
            clean_names.append(name)
            
    merged["junction_id"] = junction_ids
    merged["clean_name"] = clean_names
    
    # Use Bangalore center coordinate fallback only if no coordinates were found in the raw dataset
    merged["lat"] = merged["lat"].fillna(12.9716)
    merged["lng"] = merged["lng"].fillna(77.5946)
    
    # Sort by PDI descending to compute Rank
    merged.sort_values(by="PDI", ascending=False, inplace=True)
    merged.reset_index(drop=True, inplace=True)
    merged["rank"] = merged.index + 1
    
    # Select columns as requested by the plan
    cols = [
        "junction_id",
        "junction_name",  # keep original name column for easy reference/compatibility
        "clean_name",
        "PDI",
        "rank",
        "total_violations",
        "priority_level",
        "hotspot_type",
        "daily_avg",
        "growth_rate",
        "spike_ratio",
        "consistency",
        "freq_n",
        "peak_n",
        "heavy_n",
        "recur_n",
        "lat",
        "lng"
    ]
    
    final_df = merged[cols]
    
    # Make output folders if they do not exist
    frontend_data_dir = os.path.abspath(os.path.join(BASE_DIR, "..", "Frontend", "public", "data"))
    os.makedirs(frontend_data_dir, exist_ok=True)
    
    backend_data_dir = os.path.join(BASE_DIR, "data")
    os.makedirs(backend_data_dir, exist_ok=True)
    
    # Define output files
    out_files = [
        os.path.join(frontend_data_dir, "junction_master.csv"),
        os.path.join(backend_data_dir, "junction_master.csv"),
        os.path.join(BASE_DIR, "junction_master.csv")
    ]
    
    for out_path in out_files:
        final_df.to_csv(out_path, index=False)
        print(f"Saved master file to: {out_path}")
        
    # Save a dedicated junction_geo.csv file
    geo_cols = ["junction_id", "junction_name", "clean_name", "lat", "lng"]
    geo_only_df = final_df[geo_cols]
    
    geo_files = [
        os.path.join(frontend_data_dir, "junction_geo.csv"),
        os.path.join(backend_data_dir, "junction_geo.csv"),
        os.path.join(BASE_DIR, "junction_geo.csv")
    ]
    for geo_path in geo_files:
        geo_only_df.to_csv(geo_path, index=False)
        print(f"Saved geo file to: {geo_path}")
        
    print("Master CSV and Geo CSV generation completed successfully.")

if __name__ == "__main__":
    main()
