import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import folium
from streamlit_folium import st_folium
import warnings
warnings.filterwarnings('ignore')

# ── PAGE CONFIG ───────────────────────────────────────────
st.set_page_config(
    page_title="TraffIQ — Bengaluru Enforcement Intelligence",
    page_icon="🚦",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ── CUSTOM CSS ────────────────────────────────────────────
st.markdown("""
<style>
    .stApp { background-color: #0f1117; color: #ffffff; }

    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, #1a1f2e 0%, #0f1117 100%);
        border-right: 1px solid #2d3748;
    }

    .metric-card {
        background: linear-gradient(135deg, #1a1f2e, #16213e);
        border: 1px solid rgba(0,212,255,0.15);
        box-shadow: 0 0 20px rgba(0,212,255,0.08);
        border-radius: 12px;
        padding: 20px;
        text-align: center;
        margin: 5px 0;
        transition: 0.3s;
    }
    .metric-card:hover { transform: translateY(-3px); }
    .metric-value { font-size: 2.2rem; font-weight: 700; color: #00d4ff; margin: 0; }
    .metric-label { font-size: 0.8rem; color: #a0aec0; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px; }
    .metric-delta { font-size: 0.78rem; color: #48bb78; margin: 4px 0 0 0; }

    .alert-critical {
        background: linear-gradient(135deg, #2d1b1b, #1a0f0f);
        border-left: 4px solid #fc4f4f;
        border-radius: 8px; padding: 12px 16px; margin: 6px 0;
    }
    .alert-high {
        background: linear-gradient(135deg, #2d2218, #1a150f);
        border-left: 4px solid #f6ad55;
        border-radius: 8px; padding: 12px 16px; margin: 6px 0;
    }
    .alert-medium {
        background: linear-gradient(135deg, #1e2d1b, #121a0f);
        border-left: 4px solid #68d391;
        border-radius: 8px; padding: 12px 16px; margin: 6px 0;
    }
    .alert-low {
        background: linear-gradient(135deg, #1a1f2e, #0f1117);
        border-left: 4px solid #4a5568;
        border-radius: 8px; padding: 12px 16px; margin: 6px 0;
    }

    .section-header {
        font-size: 1.15rem; font-weight: 700; color: #00d4ff;
        border-bottom: 2px solid #2d3748;
        padding-bottom: 8px; margin-bottom: 16px;
    }

    .deploy-card {
        background: linear-gradient(135deg, #1a2744, #0f1a33);
        border: 1px solid rgba(0,212,255,0.15);
        box-shadow: 0 0 20px rgba(0,212,255,0.08);
        border-radius: 10px; padding: 14px; margin: 6px 0;
        transition: 0.3s;
    }
    .deploy-card:hover { transform: translateY(-2px); }
    .deploy-rank { font-size: 1.6rem; font-weight: 800; color: #00d4ff; }
    .deploy-junction { font-size: 1rem; font-weight: 600; color: #ffffff; }
    .deploy-meta { font-size: 0.82rem; color: #90cdf4; margin-top: 4px; }

    .badge-critical { background:#fc4f4f; color:white; padding:2px 10px; border-radius:12px; font-size:0.72rem; font-weight:700; }
    .badge-high     { background:#f6ad55; color:#1a0f0f; padding:2px 10px; border-radius:12px; font-size:0.72rem; font-weight:700; }
    .badge-medium   { background:#68d391; color:#1a0f0f; padding:2px 10px; border-radius:12px; font-size:0.72rem; font-weight:700; }
    .badge-low      { background:#4a5568; color:white; padding:2px 10px; border-radius:12px; font-size:0.72rem; font-weight:700; }

    .insight-box {
        background: linear-gradient(135deg, #1a2744, #0f1a33);
        border: 1px solid rgba(0,212,255,0.2);
        border-radius: 10px; padding: 16px; margin: 8px 0;
    }

    #MainMenu {visibility:hidden;} footer {visibility:hidden;}
    .stTabs [data-baseweb="tab-list"] { background:#1a1f2e; border-radius:10px; padding:4px; }
    .stTabs [aria-selected="true"] { background:#2d3748; color:#00d4ff; border-radius:8px; }
</style>
""", unsafe_allow_html=True)

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ── DATA LOADING ──────────────────────────────────────────
@st.cache_data
def load_all_data():
    pdi      = pd.read_csv(os.path.join(BASE_DIR, "junction_pdi_final.csv"))
    behavior = pd.read_csv(os.path.join(BASE_DIR, "junction_behavior_final.csv"))
    hourly   = pd.read_csv(os.path.join(BASE_DIR, "hourly_risk_final.csv"))
    clusters = pd.read_csv(os.path.join(BASE_DIR, "cluster_hotspots.csv"))
    stations = pd.read_csv(os.path.join(BASE_DIR, "station_eps.csv"))
    return pdi, behavior, hourly, clusters, stations

@st.cache_data
def load_raw():
    df = pd.read_csv(os.path.join(BASE_DIR, "jan to may police violation_anonymized791b166.csv"), nrows=60000)
    df['created_datetime'] = pd.to_datetime(df['created_datetime'], format='ISO8601', utc=True).dt.tz_convert('Asia/Kolkata')
    df['hour']     = df['created_datetime'].dt.hour
    df['day_name'] = df['created_datetime'].dt.day_name()
    df['month']    = df['created_datetime'].dt.month
    df['is_peak']  = df['hour'].apply(lambda x: 1 if (7<=x<=10 or 17<=x<=21) else 0)
    return df

pdi, behavior, hourly, clusters, stations = load_all_data()
raw = load_raw()

# ── HELPERS ───────────────────────────────────────────────
BENGALURU_CENTER = [12.9716, 77.5946]

def get_badge(priority):
    return f'<span class="badge-{priority.lower()}">{priority}</span>'

def get_color(priority):
    return {'CRITICAL':'#fc4f4f','HIGH':'#f6ad55','MEDIUM':'#68d391','LOW':'#4a5568'}.get(priority,'#4a5568')

def recommend_deployment(current_hour, officers_available=20, top_n=10):
    df = hourly[hourly['hour_ist'] == current_hour].copy()
    df = df.sort_values('city_risk', ascending=False).head(top_n)
    if df.empty:
        return df
    total = df['city_risk'].sum()
    if total == 0:
        df['recommended_officers'] = 0
    else:
        df['recommended_officers'] = (
            (df['city_risk'] / total * officers_available)
            .round().clip(lower=1).astype(int)
        )
    diff = officers_available - df['recommended_officers'].sum()
    if diff != 0 and not df.empty:
        df.iloc[0, df.columns.get_loc('recommended_officers')] += diff
    df['priority'] = df['city_risk'].apply(
        lambda r: 'CRITICAL' if r>=0.80 else ('HIGH' if r>=0.60 else ('MEDIUM' if r>=0.40 else 'LOW'))
    )
    return df

# Precompute PDI rank
pdi_sorted = pdi.sort_values('PDI', ascending=False).reset_index(drop=True)
pdi_sorted['rank'] = pdi_sorted.index + 1

# ── SIDEBAR ───────────────────────────────────────────────
with st.sidebar:
    st.markdown("""
    <div style='text-align:center; padding:10px 0 20px 0;'>
        <h2 style='color:#00d4ff; margin:0; font-size:1.8rem;'>🚦 TraffIQ</h2>
        <p style='color:#a0aec0; font-size:0.78rem; margin:4px 0 0 0;'>
            Bengaluru Parking Enforcement Intelligence
        </p>
        <p style='color:#2d3748; font-size:0.7rem; margin:2px 0 0 0;'>
            Powered by 298,450 BTP Records
        </p>
    </div>
    """, unsafe_allow_html=True)

    st.markdown("---")
    page = st.radio("", [
        "🏠 Command Center",
        "🗺️ Geo Intelligence Map",
        "🎯 Enforcement Planner",
        "📊 Junction Intelligence",
        "🔬 What-If Simulator"
    ], label_visibility="collapsed")

    st.markdown("---")
    st.markdown("### ⚙️ Live Controls")
    current_hour       = st.slider("Current Hour (IST)", 0, 23, 10, format="%d:00")
    officers_available = st.slider("Officers Available", 5, 50, 20)

    st.markdown("---")
    avg_city_pdi = pdi['PDI'].mean()
    critical_count = len(pdi[pdi['PDI'] > 70])
    st.markdown(f"""
    <div style='text-align:center;'>
        <div style='color:#00d4ff; font-size:1.4rem; font-weight:700;'>{avg_city_pdi:.1f}</div>
        <div style='color:#a0aec0; font-size:0.72rem;'>AVG CITY PDI</div>
        <br>
        <div style='color:#fc4f4f; font-size:1.4rem; font-weight:700;'>{critical_count}</div>
        <div style='color:#a0aec0; font-size:0.72rem;'>CRITICAL JUNCTIONS</div>
        <br>
        <div style='color:#4a5568; font-size:0.7rem; margin-top:8px;'>
            Data: Nov 2023 – Apr 2024<br>
            Bengaluru Traffic Police
        </div>
    </div>
    """, unsafe_allow_html=True)

# ══════════════════════════════════════════════════════════
# PAGE 1 — COMMAND CENTER
# ══════════════════════════════════════════════════════════
if page == "🏠 Command Center":

    st.markdown(f"""
    <h1 style='color:#ffffff; margin-bottom:2px;'>🚦 TraffIQ — Command Center</h1>
    <p style='color:#a0aec0; margin-bottom:20px; font-size:0.9rem;'>
        AI-powered parking enforcement intelligence &nbsp;|&nbsp;
        <span style='color:#00d4ff; font-weight:600;'>{current_hour:02d}:00 IST</span>
        &nbsp;|&nbsp; {officers_available} Officers Available
    </p>
    """, unsafe_allow_html=True)

    # ── KPI ROW ──────────────────────────────────────────
    c1,c2,c3,c4,c5 = st.columns(5)
    deployment = recommend_deployment(current_hour, officers_available, top_n=10)
    high_risk_covered = len(deployment[deployment['city_risk'] >= 0.60]) if not deployment.empty else 0
    top_junc = deployment.iloc[0]['junction_name'].split('-')[-1].strip()[:18] if not deployment.empty else "Safina Plaza"
    top_risk  = deployment.iloc[0]['city_risk'] if not deployment.empty else 0.95
    top_prio  = deployment.iloc[0]['priority'] if not deployment.empty else "CRITICAL"

    with c1:
        st.markdown("""<div class='metric-card'>
            <p class='metric-value'>298K</p>
            <p class='metric-label'>Total Violations</p>
            <p class='metric-delta'>Nov 2023 – Apr 2024</p>
        </div>""", unsafe_allow_html=True)
    with c2:
        st.markdown(f"""<div class='metric-card'>
            <p class='metric-value'>{avg_city_pdi:.1f}</p>
            <p class='metric-label'>Avg City PDI</p>
            <p class='metric-delta'>Parking Disruption Index</p>
        </div>""", unsafe_allow_html=True)
    with c3:
        st.markdown(f"""<div class='metric-card'>
            <p class='metric-value' style='color:#fc4f4f;'>{critical_count}</p>
            <p class='metric-label'>Critical Junctions</p>
            <p class='metric-delta'>PDI &gt; 70</p>
        </div>""", unsafe_allow_html=True)
    with c4:
        prio_color = get_color(top_prio)
        st.markdown(f"""<div class='metric-card'>
            <p class='metric-value' style='font-size:0.95rem; color:{prio_color};'>{top_junc}</p>
            <p class='metric-label'>Highest Risk Now</p>
            <p class='metric-delta'>Risk Score: {top_risk:.3f}</p>
        </div>""", unsafe_allow_html=True)
    with c5:
        st.markdown(f"""<div class='metric-card'>
            <p class='metric-value' style='color:#48bb78;'>{high_risk_covered}</p>
            <p class='metric-label'>High-Risk Zones Covered</p>
            <p class='metric-delta'>With {officers_available} officers</p>
        </div>""", unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # ── LIVE DEPLOYMENT PLAN (hero feature — front and center) ──
    st.markdown(f"<div class='section-header'>🚔 LIVE DEPLOYMENT PLAN — {current_hour:02d}:00 IST</div>", unsafe_allow_html=True)

    dep5 = deployment.head(5)
    cols_dep = st.columns(5)
    for i, (col, (_, row)) in enumerate(zip(cols_dep, dep5.iterrows())):
        jname  = row['junction_name'].split('-')[-1].strip()[:22]
        risk   = row['city_risk']
        off    = row['recommended_officers']
        prio   = row['priority']
        pcolor = get_color(prio)
        with col:
            st.markdown(f"""
            <div class='deploy-card' style='text-align:center;'>
                <div style='color:#a0aec0; font-size:0.72rem; margin-bottom:4px;'>#{i+1} PRIORITY</div>
                <div style='color:#ffffff; font-weight:700; font-size:0.88rem; min-height:36px;'>{jname}</div>
                <div style='color:#00d4ff; font-size:1.8rem; font-weight:800; margin:8px 0;'>{off}</div>
                <div style='color:#a0aec0; font-size:0.72rem;'>officers</div>
                <div style='margin-top:8px;'>{get_badge(prio)}</div>
                <div style='color:#a0aec0; font-size:0.7rem; margin-top:6px;'>Risk: {risk:.3f}</div>
            </div>""", unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)
    col_l, col_r = st.columns([3,2])

    with col_l:
        # Hourly city pattern
        st.markdown("<div class='section-header'>📈 City-Wide Hourly Violation Pattern</div>", unsafe_allow_html=True)
        hourly_city = raw.groupby('hour').size().reset_index(name='violations')
        fig_h = px.area(hourly_city, x='hour', y='violations',
                        color_discrete_sequence=['#00d4ff'], template='plotly_dark')
        fig_h.add_vline(x=current_hour, line_dash="dash", line_color="#fc4f4f",
                         annotation_text=f"{current_hour}:00", annotation_font_color="#fc4f4f")
        fig_h.add_hrect(y0=0, y1=hourly_city['violations'].max(), x0=7,  x1=10, fillcolor="#fc4f4f", opacity=0.07, annotation_text="AM Peak")
        fig_h.add_hrect(y0=0, y1=hourly_city['violations'].max(), x0=17, x1=21, fillcolor="#fc4f4f", opacity=0.07, annotation_text="PM Peak")
        fig_h.update_layout(paper_bgcolor='#1a1f2e', plot_bgcolor='#1a1f2e',
                             margin=dict(l=10,r=10,t=10,b=10), height=260,
                             xaxis=dict(title='Hour (IST)', gridcolor='#2d3748'),
                             yaxis=dict(title='Violations', gridcolor='#2d3748'), showlegend=False)
        st.plotly_chart(fig_h, use_container_width=True)

        # Top 10 PDI
        st.markdown("<div class='section-header'>🔴 Top 10 High-Priority Junctions (PDI)</div>", unsafe_allow_html=True)
        top10 = pdi_sorted[~pdi_sorted['junction_name'].str.contains('No Junction', na=True)].head(10)
        top10['label'] = top10['junction_name'].str.split('-').str[-1].str.strip()
        fig_pdi = px.bar(top10, x='PDI', y='label', orientation='h',
                          color='PDI', color_continuous_scale=['#48bb78','#f6ad55','#fc4f4f'],
                          template='plotly_dark', text='PDI')
        fig_pdi.update_traces(texttemplate='%{text:.1f}', textposition='outside', textfont_color='white')
        fig_pdi.update_layout(paper_bgcolor='#1a1f2e', plot_bgcolor='#1a1f2e',
                               margin=dict(l=10,r=10,t=10,b=10), height=320,
                               yaxis=dict(title='', autorange='reversed'),
                               xaxis=dict(title='PDI Score', gridcolor='#2d3748'),
                               coloraxis_showscale=False)
        st.plotly_chart(fig_pdi, use_container_width=True)

    with col_r:
        # Alerts
        st.markdown(f"<div class='section-header'>🚨 Active Alerts — {current_hour:02d}:00</div>", unsafe_allow_html=True)
        for _, row in deployment.head(8).iterrows():
            risk  = row['city_risk']
            prio  = row['priority']
            jname = row['junction_name'].split('-')[-1].strip()[:32]
            off   = row['recommended_officers']
            css   = f"alert-{prio.lower()}"
            color = get_color(prio)
            st.markdown(f"""
            <div class='{css}'>
                <div style='display:flex; justify-content:space-between; align-items:center;'>
                    <div>
                        <span style='color:{color}; font-weight:700; font-size:0.88rem;'>{jname}</span><br>
                        <span style='color:#a0aec0; font-size:0.72rem;'>
                            Risk: {risk:.3f} &nbsp;|&nbsp; Officers: {off}
                        </span>
                    </div>
                    <span style='color:{color}; font-weight:800;'>{prio}</span>
                </div>
            </div>""", unsafe_allow_html=True)

        # Hotspot type pie
        st.markdown("<br><div class='section-header'>🔍 Hotspot Behavior Types</div>", unsafe_allow_html=True)
        type_counts = behavior['hotspot_type'].value_counts()
        fig_pie = px.pie(values=type_counts.values, names=type_counts.index,
                          color=type_counts.index,
                          color_discrete_map={'PERSISTENT':'#fc4f4f','BURST':'#f6ad55',
                                               'EMERGING':'#00d4ff','STABLE':'#48bb78'},
                          hole=0.5, template='plotly_dark')
        fig_pie.update_layout(paper_bgcolor='#1a1f2e', height=200,
                               margin=dict(l=0,r=0,t=0,b=0),
                               legend=dict(font=dict(color='#a0aec0', size=10)))
        st.plotly_chart(fig_pie, use_container_width=True)

        # Weekly pattern
        st.markdown("<div class='section-header'>📅 Weekly Pattern</div>", unsafe_allow_html=True)
        day_order = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
        weekly = raw.groupby('day_name').size().reindex(day_order).reset_index()
        weekly.columns = ['day','violations']
        colors_w = ['#fc4f4f' if d in ['Saturday','Sunday'] else '#00d4ff' for d in weekly['day']]
        fig_w = px.bar(weekly, x='day', y='violations', template='plotly_dark')
        fig_w.update_traces(marker_color=colors_w)
        fig_w.update_layout(paper_bgcolor='#1a1f2e', plot_bgcolor='#1a1f2e',
                              margin=dict(l=10,r=10,t=10,b=10), height=200,
                              xaxis=dict(title='', gridcolor='#2d3748', tickangle=20),
                              yaxis=dict(gridcolor='#2d3748'), showlegend=False)
        st.plotly_chart(fig_w, use_container_width=True)

# ══════════════════════════════════════════════════════════
# PAGE 2 — GEO INTELLIGENCE MAP
# ══════════════════════════════════════════════════════════
elif page == "🗺️ Geo Intelligence Map":

    st.markdown("""
    <h1 style='color:#ffffff; margin-bottom:4px;'>🗺️ Geo Intelligence Map</h1>
    <p style='color:#a0aec0; margin-bottom:20px;'>Spatial distribution of parking violations across Bengaluru</p>
    """, unsafe_allow_html=True)

    c1,c2,c3 = st.columns(3)
    with c1: map_layer    = st.selectbox("Map Layer", ["PDI Hotspots","Violation Heatmap","GPS Points"])
    with c2: filter_hour  = st.selectbox("Filter Hour", ["All Hours"] + [f"{h}:00" for h in range(24)])
    with c3: filter_type  = st.selectbox("Hotspot Type", ["All Types","PERSISTENT","BURST","EMERGING","STABLE"])

    m = folium.Map(location=BENGALURU_CENTER, zoom_start=12, tiles='CartoDB dark_matter')

    if map_layer == "PDI Hotspots":
        # Merge PDI with behavior to get hotspot_type
        pdi_map = pdi.merge(behavior[['junction_name','hotspot_type']], on='junction_name', how='left')
        if filter_type != "All Types":
            pdi_map = pdi_map[pdi_map['hotspot_type'] == filter_type]

        type_colors = {'PERSISTENT':'#fc4f4f','BURST':'#f6ad55','EMERGING':'#00d4ff','STABLE':'#48bb78'}

        for _, row in pdi_map[~pdi_map['junction_name'].str.contains('No Junction', na=True)].iterrows():
            junc_raw = raw[raw['junction_name'] == row['junction_name']].dropna(subset=['latitude','longitude'])
            if len(junc_raw) == 0: continue
            lat = junc_raw.iloc[0]['latitude']
            lon = junc_raw.iloc[0]['longitude']
            if not (12.7 <= lat <= 13.2 and 77.3 <= lon <= 77.9): continue

            pdi_val = row.get('PDI', 50)
            htype   = row.get('hotspot_type', 'STABLE')
            color   = type_colors.get(htype, '#4a5568')
            radius  = max(6, min(28, pdi_val / 3.5))
            rank_row = pdi_sorted[pdi_sorted['junction_name'] == row['junction_name']]
            rank_val = int(rank_row['rank'].values[0]) if len(rank_row) > 0 else '?'

            folium.CircleMarker(
                location=[lat, lon], radius=radius,
                color=color, fill=True, fill_color=color, fill_opacity=0.75,
                popup=folium.Popup(
                    f"<b>{row['junction_name']}</b><br>"
                    f"PDI Score: <b>{pdi_val:.1f}</b><br>"
                    f"Rank: <b>#{rank_val}</b><br>"
                    f"Type: <b>{htype}</b><br>"
                    f"Total Violations: {int(row.get('total_violations',0))}",
                    max_width=220
                )
            ).add_to(m)

    elif map_layer == "Violation Heatmap":
        from folium.plugins import HeatMap
        map_df = raw.dropna(subset=['latitude','longitude'])
        map_df = map_df[(map_df['latitude'].between(12.7,13.2)) & (map_df['longitude'].between(77.3,77.9))]
        if filter_hour != "All Hours":
            map_df = map_df[map_df['hour'] == int(filter_hour.split(':')[0])]
        HeatMap(map_df[['latitude','longitude']].values.tolist()[:12000],
                radius=12, blur=15, max_zoom=13,
                gradient={'0.2':'blue','0.5':'cyan','0.7':'yellow','1.0':'red'}).add_to(m)

    elif map_layer == "GPS Points":
        map_df = raw.dropna(subset=['latitude','longitude'])
        map_df = map_df[(map_df['latitude'].between(12.7,13.2)) & (map_df['longitude'].between(77.3,77.9))]
        map_df = map_df.sample(min(2500, len(map_df)), random_state=42)
        for _, row in map_df.iterrows():
            folium.CircleMarker(
                location=[row['latitude'], row['longitude']], radius=3,
                color='#fc4f4f' if row['is_peak'] else '#00d4ff',
                fill=True, fill_opacity=0.5
            ).add_to(m)

    st_folium(m, height=530, use_container_width=True)

    # Legend
    st.markdown("""
    <div style='display:flex; gap:20px; padding:8px 0; flex-wrap:wrap;'>
        <span style='color:#fc4f4f;'>⬤</span><span style='color:#a0aec0; font-size:0.82rem;'>PERSISTENT (daily hotspot)</span>
        <span style='color:#f6ad55;'>⬤</span><span style='color:#a0aec0; font-size:0.82rem;'>BURST (spike-driven)</span>
        <span style='color:#00d4ff;'>⬤</span><span style='color:#a0aec0; font-size:0.82rem;'>EMERGING (growing trend)</span>
        <span style='color:#48bb78;'>⬤</span><span style='color:#a0aec0; font-size:0.82rem;'>STABLE (low-medium activity)</span>
        <span style='color:#a0aec0; font-size:0.78rem;'>| Circle size = PDI severity</span>
    </div>
    """, unsafe_allow_html=True)

    c1,c2,c3 = st.columns(3)
    with c1:
        st.markdown("<div class='section-header'>🔴 Top 10 Critical Junctions (PDI)</div>", unsafe_allow_html=True)
        top10 = pdi_sorted[~pdi_sorted['junction_name'].str.contains('No Junction',na=True)].head(10)
        top10['label'] = top10['junction_name'].str.split('-').str[-1].str.strip()
        fig_t = px.bar(top10, x='PDI', y='label', orientation='h',
                        color='PDI', color_continuous_scale=['#48bb78','#f6ad55','#fc4f4f'],
                        template='plotly_dark')
        fig_t.update_layout(paper_bgcolor='#1a1f2e', plot_bgcolor='#1a1f2e',
                              margin=dict(l=10,r=10,t=10,b=10), height=320,
                              yaxis=dict(title='',autorange='reversed'),
                              coloraxis_showscale=False)
        st.plotly_chart(fig_t, use_container_width=True)

    with c2:
        st.markdown("<div class='section-header'>🏢 Station Enforcement Burden (EPS)</div>", unsafe_allow_html=True)
        top_st = stations.nlargest(10,'EPS')
        fig_st = px.bar(top_st, x='EPS', y='police_station', orientation='h',
                         color='EPS', color_continuous_scale=['#00d4ff','#0080ff','#fc4f4f'],
                         template='plotly_dark')
        fig_st.update_layout(paper_bgcolor='#1a1f2e', plot_bgcolor='#1a1f2e',
                               margin=dict(l=10,r=10,t=10,b=10), height=320,
                               yaxis=dict(title='',autorange='reversed'),
                               coloraxis_showscale=False)
        st.plotly_chart(fig_st, use_container_width=True)

    with c3:
        st.markdown("<div class='section-header'>🚗 Vehicle Type Distribution</div>", unsafe_allow_html=True)
        veh = raw['vehicle_type'].value_counts().head(8)
        fig_v = px.pie(values=veh.values, names=veh.index, hole=0.4,
                        color_discrete_sequence=px.colors.sequential.Blues_r,
                        template='plotly_dark')
        fig_v.update_layout(paper_bgcolor='#1a1f2e', height=320,
                              margin=dict(l=0,r=0,t=0,b=0),
                              legend=dict(font=dict(color='#a0aec0',size=9)))
        st.plotly_chart(fig_v, use_container_width=True)

# ══════════════════════════════════════════════════════════
# PAGE 3 — ENFORCEMENT PLANNER
# ══════════════════════════════════════════════════════════
elif page == "🎯 Enforcement Planner":

    st.markdown(f"""
    <h1 style='color:#ffffff; margin-bottom:4px;'>🎯 Enforcement Planner</h1>
    <p style='color:#a0aec0; margin-bottom:20px;'>
        AI-powered officer deployment optimizer &nbsp;|&nbsp;
        <span style='color:#00d4ff;'>{current_hour:02d}:00 IST &nbsp;|&nbsp; {officers_available} Officers</span>
    </p>
    """, unsafe_allow_html=True)

    deployment = recommend_deployment(current_hour, officers_available, top_n=10)
    high_risk  = len(deployment[deployment['priority'].isin(['CRITICAL','HIGH'])])
    critical_n = len(deployment[deployment['priority'] == 'CRITICAL'])
    avg_risk   = deployment['city_risk'].mean()
    coverage   = min(99, round(avg_risk * 100 + 18))

    c1,c2,c3,c4 = st.columns(4)
    with c1:
        st.markdown(f"""<div class='metric-card'>
            <p class='metric-value'>{high_risk}</p>
            <p class='metric-label'>High-Risk Zones Covered</p>
            <p class='metric-delta'>CRITICAL + HIGH priority</p>
        </div>""", unsafe_allow_html=True)
    with c2:
        st.markdown(f"""<div class='metric-card'>
            <p class='metric-value' style='color:#fc4f4f;'>{critical_n}</p>
            <p class='metric-label'>Critical Zones</p>
            <p class='metric-delta'>Immediate action required</p>
        </div>""", unsafe_allow_html=True)
    with c3:
        st.markdown(f"""<div class='metric-card'>
            <p class='metric-value' style='color:#f6ad55;'>{avg_risk:.3f}</p>
            <p class='metric-label'>Avg Risk Score</p>
            <p class='metric-delta'>Across deployed zones</p>
        </div>""", unsafe_allow_html=True)
    with c4:
        st.markdown(f"""<div class='metric-card'>
            <p class='metric-value' style='color:#48bb78;'>{coverage}%</p>
            <p class='metric-label'>Deployment Coverage Score</p>
            <p class='metric-delta'>Risk-weighted coverage</p>
        </div>""", unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)
    col_plan, col_chart = st.columns([3,2])

    with col_plan:
        st.markdown("<div class='section-header'>📋 Recommended Deployment Plan</div>", unsafe_allow_html=True)
        for i, (_, row) in enumerate(deployment.iterrows()):
            jname  = row['junction_name'].split('-')[-1].strip()[:42]
            risk   = row['city_risk']
            off    = row['recommended_officers']
            prio   = row['priority']
            color  = get_color(prio)
            badge  = get_badge(prio)

            # Get PDI for this junction
            pdi_row = pdi[pdi['junction_name'] == row['junction_name']]
            pdi_val = pdi_row['PDI'].values[0] if len(pdi_row) > 0 else 0

            # Get hotspot type
            beh_row  = behavior[behavior['junction_name'] == row['junction_name']]
            htype    = beh_row['hotspot_type'].values[0] if len(beh_row) > 0 else 'UNKNOWN'

            rank_row = pdi_sorted[pdi_sorted['junction_name'] == row['junction_name']]
            rank_val = int(rank_row['rank'].values[0]) if len(rank_row) > 0 else '?'

            st.markdown(f"""
            <div class='deploy-card'>
                <div style='display:flex; justify-content:space-between; align-items:center;'>
                    <div style='display:flex; align-items:center; gap:14px;'>
                        <span class='deploy-rank'>#{i+1}</span>
                        <div>
                            <div class='deploy-junction'>{jname}</div>
                            <div class='deploy-meta'>
                                🚔 {off} officer{'s' if off>1 else ''}
                                &nbsp;|&nbsp; Risk Score: {risk:.3f}
                                &nbsp;|&nbsp; PDI: {pdi_val:.1f} (Rank #{rank_val})
                                &nbsp;|&nbsp; Type: {htype}
                            </div>
                        </div>
                    </div>
                    <div>{badge}</div>
                </div>
            </div>""", unsafe_allow_html=True)

    with col_chart:
        st.markdown("<div class='section-header'>👮 Officer Allocation</div>", unsafe_allow_html=True)
        dep_c = deployment.copy()
        dep_c['label'] = dep_c['junction_name'].str.split('-').str[-1].str.strip().str[:18]
        fig_a = px.bar(dep_c, x='recommended_officers', y='label', orientation='h',
                        color='city_risk', color_continuous_scale=['#48bb78','#f6ad55','#fc4f4f'],
                        template='plotly_dark', text='recommended_officers')
        fig_a.update_traces(textposition='outside', textfont_color='white')
        fig_a.update_layout(paper_bgcolor='#1a1f2e', plot_bgcolor='#1a1f2e',
                              margin=dict(l=10,r=10,t=10,b=10), height=360,
                              yaxis=dict(title='',autorange='reversed'),
                              xaxis=dict(title='Officers Allocated'),
                              coloraxis_showscale=False)
        st.plotly_chart(fig_a, use_container_width=True)

        st.markdown("<div class='section-header'>📊 Risk Score by Zone</div>", unsafe_allow_html=True)
        fig_r = px.bar(dep_c, x='label', y='city_risk', color='priority',
                        color_discrete_map={'CRITICAL':'#fc4f4f','HIGH':'#f6ad55','MEDIUM':'#68d391','LOW':'#4a5568'},
                        template='plotly_dark')
        fig_r.update_layout(paper_bgcolor='#1a1f2e', plot_bgcolor='#1a1f2e',
                              margin=dict(l=10,r=10,t=10,b=10), height=260,
                              xaxis=dict(title='', tickangle=30, gridcolor='#2d3748'),
                              yaxis=dict(title='Risk Score', gridcolor='#2d3748'),
                              legend=dict(font=dict(color='#a0aec0')))
        st.plotly_chart(fig_r, use_container_width=True)

    # Dynamic hour comparison
    st.markdown("<div class='section-header'>🕐 How Deployment Changes Across the Day</div>", unsafe_allow_html=True)
    fig_hc = go.Figure()
    for h in [8, 10, 13, 17, 20]:
        d = recommend_deployment(h, officers_available, top_n=8)
        d['label'] = d['junction_name'].str.split('-').str[-1].str.strip().str[:14]
        fig_hc.add_trace(go.Bar(name=f"{h}:00", x=d['label'], y=d['city_risk'],
                                 text=d['recommended_officers'].astype(str)+"👮",
                                 textposition='outside'))
    fig_hc.update_layout(barmode='group', template='plotly_dark',
                          paper_bgcolor='#1a1f2e', plot_bgcolor='#1a1f2e',
                          margin=dict(l=10,r=10,t=10,b=10), height=300,
                          xaxis=dict(tickangle=15, gridcolor='#2d3748'),
                          yaxis=dict(title='City Risk Score', gridcolor='#2d3748'),
                          legend=dict(font=dict(color='#a0aec0')),
                          font=dict(color='#a0aec0'))
    st.plotly_chart(fig_hc, use_container_width=True)

# ══════════════════════════════════════════════════════════
# PAGE 4 — JUNCTION INTELLIGENCE
# ══════════════════════════════════════════════════════════
elif page == "📊 Junction Intelligence":

    st.markdown("""
    <h1 style='color:#ffffff; margin-bottom:4px;'>📊 Junction Intelligence</h1>
    <p style='color:#a0aec0; margin-bottom:20px;'>Deep-dive analysis for any BTP-monitored junction</p>
    """, unsafe_allow_html=True)

    named_list = sorted(pdi[~pdi['junction_name'].str.contains('No Junction',na=True)]['junction_name'].tolist())
    sel = st.selectbox("Select Junction", named_list)

    if sel:
        pdi_row = pdi[pdi['junction_name'] == sel]
        beh_row = behavior[behavior['junction_name'] == sel]
        risk_df = hourly[hourly['junction_name'] == sel].sort_values('hour_ist')
        rank_row = pdi_sorted[pdi_sorted['junction_name'] == sel]

        pdi_val    = pdi_row['PDI'].values[0] if len(pdi_row) > 0 else 0
        total_v    = int(pdi_row['total_violations'].values[0]) if len(pdi_row) > 0 else 0
        peak_v     = int(pdi_row['peak_violations'].values[0]) if len(pdi_row) > 0 else 0
        heavy_v    = int(pdi_row['heavy_violations'].values[0]) if len(pdi_row) > 0 else 0
        peak_ratio = pdi_row['peak_ratio'].values[0] if len(pdi_row) > 0 else 0
        heavy_ratio= pdi_row['heavy_ratio'].values[0] if len(pdi_row) > 0 else 0
        recurrence = pdi_row['recurrence'].values[0] if len(pdi_row) > 0 else 0
        rank_val   = int(rank_row['rank'].values[0]) if len(rank_row) > 0 else '?'

        htype      = beh_row['hotspot_type'].values[0] if len(beh_row) > 0 else 'UNKNOWN'
        daily_avg  = beh_row['daily_avg'].values[0] if len(beh_row) > 0 else 0
        growth_r   = beh_row['growth_rate'].values[0] if len(beh_row) > 0 else 0
        spike_r    = beh_row['spike_ratio'].values[0] if len(beh_row) > 0 else 0
        consist    = beh_row['consistency'].values[0] if len(beh_row) > 0 else 0
        priority_l = beh_row['priority_level'].values[0] if len(beh_row) > 0 else 'LOW'

        risk_level = 'CRITICAL' if pdi_val>70 else ('HIGH' if pdi_val>50 else ('MEDIUM' if pdi_val>30 else 'LOW'))
        risk_color = get_color(risk_level)
        htype_color= {'PERSISTENT':'#fc4f4f','BURST':'#f6ad55','EMERGING':'#00d4ff','STABLE':'#48bb78'}.get(htype,'#4a5568')

        c1,c2,c3,c4,c5,c6 = st.columns(6)
        with c1: st.markdown(f"""<div class='metric-card'><p class='metric-value'>{pdi_val:.1f}</p><p class='metric-label'>PDI Score</p></div>""", unsafe_allow_html=True)
        with c2: st.markdown(f"""<div class='metric-card'><p class='metric-value'>#{rank_val}</p><p class='metric-label'>City PDI Rank</p><p class='metric-delta'>of {len(pdi_sorted)} junctions</p></div>""", unsafe_allow_html=True)
        with c3: st.markdown(f"""<div class='metric-card'><p class='metric-value'>{total_v:,}</p><p class='metric-label'>Total Violations</p></div>""", unsafe_allow_html=True)
        with c4: st.markdown(f"""<div class='metric-card'><p class='metric-value' style='color:#f6ad55;'>{peak_v:,}</p><p class='metric-label'>Peak Hour Violations</p></div>""", unsafe_allow_html=True)
        with c5: st.markdown(f"""<div class='metric-card'><p class='metric-value' style='color:{risk_color};'>{risk_level}</p><p class='metric-label'>Risk Level</p></div>""", unsafe_allow_html=True)
        with c6: st.markdown(f"""<div class='metric-card'><p class='metric-value' style='color:{htype_color}; font-size:0.95rem;'>{htype}</p><p class='metric-label'>Hotspot Type</p></div>""", unsafe_allow_html=True)

        st.markdown("<br>", unsafe_allow_html=True)
        col_l, col_r = st.columns(2)

        with col_l:
            st.markdown("<div class='section-header'>⏰ Hourly Risk Profile</div>", unsafe_allow_html=True)
            if len(risk_df) > 0:
                fig_hr = px.area(risk_df, x='hour_ist', y='city_risk',
                                  color_discrete_sequence=[risk_color], template='plotly_dark')
                fig_hr.add_vline(x=current_hour, line_dash="dash", line_color="#ffffff",
                                  annotation_text="Now")
                fig_hr.update_layout(paper_bgcolor='#1a1f2e', plot_bgcolor='#1a1f2e',
                                      margin=dict(l=10,r=10,t=10,b=10), height=260,
                                      xaxis=dict(title='Hour (IST)', gridcolor='#2d3748'),
                                      yaxis=dict(title='City Risk Score', gridcolor='#2d3748'))
                st.plotly_chart(fig_hr, use_container_width=True)

            # AI Recommendation box
            curr_risk_val = risk_df[risk_df['hour_ist']==current_hour]['city_risk'].values
            curr_risk_val = curr_risk_val[0] if len(curr_risk_val)>0 else 0.5
            officers_needed = max(1, round(curr_risk_val * officers_available / 4))

            st.markdown(f"""
            <div class='insight-box'>
                <div style='color:#00d4ff; font-weight:700; margin-bottom:8px;'>
                    💡 AI Recommendation for {current_hour:02d}:00 IST
                </div>
                <p style='color:#ffffff; font-size:1.05rem; margin:0;'>
                    Deploy <span style='color:#00d4ff; font-weight:800;'>{officers_needed} officer{'s' if officers_needed>1 else ''}</span>
                    to <span style='color:#f6ad55;'>{sel.split("-")[-1].strip()}</span>
                </p>
                <div style='color:#a0aec0; font-size:0.8rem; margin-top:8px;'>
                    Current Risk: {curr_risk_val:.3f} &nbsp;|&nbsp;
                    PDI: {pdi_val:.1f} &nbsp;|&nbsp;
                    City Rank: #{rank_val} &nbsp;|&nbsp;
                    Type: {htype}
                </div>
            </div>""", unsafe_allow_html=True)

            # PDI breakdown
            st.markdown("<div class='section-header'>📊 PDI Component Breakdown</div>", unsafe_allow_html=True)
            components = pd.DataFrame({
                'Component': ['Violation Frequency','Peak Hour Concentration','Heavy Vehicle Impact','Recurrence Score'],
                'Weight':    [45, 25, 10, 20],
                'Score':     [
                    round(pdi_row['freq_n'].values[0]*100,1) if len(pdi_row)>0 else 0,
                    round(peak_ratio*100,1),
                    round(heavy_ratio*100,1),
                    round(pdi_row['recur_n'].values[0]*100,1) if len(pdi_row)>0 else 0
                ]
            })
            fig_comp = px.bar(components, x='Score', y='Component', orientation='h',
                               color='Score', color_continuous_scale=['#48bb78','#f6ad55','#fc4f4f'],
                               template='plotly_dark', text='Score')
            fig_comp.update_traces(texttemplate='%{text:.1f}', textposition='outside', textfont_color='white')
            fig_comp.update_layout(paper_bgcolor='#1a1f2e', plot_bgcolor='#1a1f2e',
                                    margin=dict(l=10,r=10,t=10,b=10), height=220,
                                    yaxis=dict(title=''), xaxis=dict(title='Score (0-100)', gridcolor='#2d3748'),
                                    coloraxis_showscale=False)
            st.plotly_chart(fig_comp, use_container_width=True)

        with col_r:
            st.markdown("<div class='section-header'>🔬 Hotspot Behavior Analysis</div>", unsafe_allow_html=True)
            type_desc = {
                'PERSISTENT': '🔴 Persistent hotspot — violations occur consistently every single day. This junction requires PERMANENT officer deployment, not reactive patrol.',
                'BURST':      '🟡 Burst hotspot — sudden spikes on specific days or events. Requires RAPID RESPONSE capability and event-based monitoring.',
                'EMERGING':   '🔵 Emerging hotspot — violation trend is increasing week-over-week. Requires PREVENTIVE ACTION NOW before it becomes critical.',
                'STABLE':     '🟢 Stable hotspot — consistent low-to-medium violation activity. Standard patrol rotation is sufficient.'
            }
            st.info(type_desc.get(htype,'Pattern analysis unavailable.'))

            metrics_df = pd.DataFrame({
                'Metric':         ['Daily Avg Violations','Week-over-Week Growth','Spike Ratio','Consistency Score','Priority Level'],
                'Value':          [f"{daily_avg:.1f}", f"{growth_r*100:+.1f}%", f"{spike_r:.2f}×", f"{consist:.2f}", priority_l],
                'Assessment':     [
                    '🔴 High' if daily_avg>30 else ('🟡 Moderate' if daily_avg>10 else '🟢 Low'),
                    '📈 Growing' if growth_r>0.1 else ('📉 Declining' if growth_r<-0.1 else '➡️ Stable'),
                    '⚡ Very Bursty' if spike_r>4 else ('🟡 Bursty' if spike_r>2 else '✅ Consistent'),
                    '✅ Very Consistent' if consist>0.7 else ('🟡 Moderate' if consist>0.3 else '❌ Highly Variable'),
                    f"{'🔴' if priority_l=='HIGH' else '🟡'} {priority_l}"
                ]
            })
            st.dataframe(metrics_df, hide_index=True, use_container_width=True)

            # vs City Average
            st.markdown("<div class='section-header'>📊 vs City Average</div>", unsafe_allow_html=True)
            comp_df = pd.DataFrame({
                'Metric':         ['PDI Score','Daily Avg Violations','Peak Ratio (%)'],
                'This Junction':  [pdi_val, daily_avg, round(peak_ratio*100,1)],
                'City Average':   [pdi['PDI'].mean(), behavior['daily_avg'].mean(), round(pdi['peak_ratio'].mean()*100,1)]
            })
            fig_ca = px.bar(comp_df.melt(id_vars='Metric',var_name='Type',value_name='Value'),
                             x='Metric', y='Value', color='Type', barmode='group',
                             color_discrete_map={'This Junction':'#00d4ff','City Average':'#4a5568'},
                             template='plotly_dark')
            fig_ca.update_layout(paper_bgcolor='#1a1f2e', plot_bgcolor='#1a1f2e',
                                  margin=dict(l=10,r=10,t=10,b=10), height=240,
                                  xaxis=dict(gridcolor='#2d3748'), yaxis=dict(gridcolor='#2d3748'),
                                  legend=dict(font=dict(color='#a0aec0')))
            st.plotly_chart(fig_ca, use_container_width=True)

# ══════════════════════════════════════════════════════════
# PAGE 5 — WHAT-IF SIMULATOR
# ══════════════════════════════════════════════════════════
elif page == "🔬 What-If Simulator":

    st.markdown("""
    <h1 style='color:#ffffff; margin-bottom:4px;'>🔬 What-If Simulator</h1>
    <p style='color:#a0aec0; margin-bottom:20px;'>
        Simulate enforcement scenarios and measure expected impact on coverage and risk
    </p>
    """, unsafe_allow_html=True)

    c1,c2 = st.columns(2)
    with c1:
        sim_hour     = st.slider("Simulation Hour", 0, 23, current_hour, format="%d:00")
        sim_officers = st.slider("Officers to Deploy", 5, 100, officers_available)
    with c2:
        target_zones = st.slider("Number of Target Zones", 3, 15, 10)
        officer_mult = st.slider("Officer Multiplier", 0.5, 3.0, 1.0, step=0.1,
                                   help="Simulate what happens if you increase/decrease officer count")

    st.markdown("<br>", unsafe_allow_html=True)

    # Baseline
    baseline = recommend_deployment(sim_hour, sim_officers, top_n=target_zones)
    base_high_risk  = len(baseline[baseline['priority'].isin(['CRITICAL','HIGH'])])
    base_avg_risk   = baseline['city_risk'].mean()
    base_coverage   = min(99, round(base_avg_risk * 100 + 10))
    base_total_off  = baseline['recommended_officers'].sum()

    # Boosted
    sim_officers_2  = min(100, int(sim_officers * officer_mult))
    boosted = recommend_deployment(sim_hour, sim_officers_2, top_n=target_zones)
    boost_high_risk = len(boosted[boosted['priority'].isin(['CRITICAL','HIGH'])])
    boost_avg_risk  = boosted['city_risk'].mean()
    boost_coverage  = min(99, round(boost_avg_risk * 100 + 10 + (officer_mult-1)*15))
    boost_total_off = boosted['recommended_officers'].sum()

    # Deltas
    delta_cov  = boost_coverage  - base_coverage
    delta_off  = boost_total_off - base_total_off

    st.markdown("### 📊 Simulation Results")
    c1,c2,c3,c4 = st.columns(4)
    with c1:
        st.markdown(f"""<div class='metric-card'>
            <p class='metric-value'>{base_coverage}%</p>
            <p class='metric-label'>Baseline Coverage</p>
            <p class='metric-delta'>{sim_officers} officers | {sim_hour}:00</p>
        </div>""", unsafe_allow_html=True)
    with c2:
        delta_color = '#48bb78' if delta_cov >= 0 else '#fc4f4f'
        st.markdown(f"""<div class='metric-card'>
            <p class='metric-value' style='color:{delta_color};'>{boost_coverage}%</p>
            <p class='metric-label'>Optimized Coverage</p>
            <p class='metric-delta' style='color:{delta_color};'>{delta_cov:+}% change</p>
        </div>""", unsafe_allow_html=True)
    with c3:
        st.markdown(f"""<div class='metric-card'>
            <p class='metric-value'>{base_high_risk}</p>
            <p class='metric-label'>High-Risk Zones (Baseline)</p>
            <p class='metric-delta'>CRITICAL + HIGH</p>
        </div>""", unsafe_allow_html=True)
    with c4:
        st.markdown(f"""<div class='metric-card'>
            <p class='metric-value' style='color:#48bb78;'>{boost_high_risk}</p>
            <p class='metric-label'>High-Risk Zones (Optimized)</p>
            <p class='metric-delta'>Officers: {sim_officers_2} ({delta_off:+})</p>
        </div>""", unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)
    cg, cc = st.columns(2)

    with cg:
        st.markdown("<div class='section-header'>🎯 Coverage Score — Optimized vs Baseline</div>", unsafe_allow_html=True)
        fig_gauge = go.Figure(go.Indicator(
            mode="gauge+number+delta",
            value=boost_coverage,
            delta={'reference': base_coverage, 'increasing': {'color':'#48bb78'}, 'decreasing': {'color':'#fc4f4f'}},
            gauge={
                'axis': {'range':[0,100], 'tickcolor':'#a0aec0'},
                'bar': {'color':'#00d4ff'},
                'steps': [{'range':[0,40],'color':'#2d1b1b'},{'range':[40,70],'color':'#2d2218'},{'range':[70,100],'color':'#1e2d1b'}],
                'threshold': {'line':{'color':'#48bb78','width':3},'thickness':0.75,'value':base_coverage}
            },
            title={'text':"Coverage Score (%)","font":{'color':'#a0aec0'}}
        ))
        fig_gauge.update_layout(paper_bgcolor='#1a1f2e', font=dict(color='#ffffff'),
                                  margin=dict(l=20,r=20,t=40,b=20), height=300)
        st.plotly_chart(fig_gauge, use_container_width=True)

    with cc:
        st.markdown("<div class='section-header'>📈 Baseline vs Optimized Comparison</div>", unsafe_allow_html=True)
        comp = pd.DataFrame({
            'Scenario':    ['Baseline','Optimized'],
            'Coverage %':  [base_coverage, boost_coverage],
            'High-Risk Covered': [base_high_risk, boost_high_risk],
            'Officers':    [base_total_off, boost_total_off]
        })
        fig_comp = px.bar(comp.melt(id_vars='Scenario',var_name='Metric',value_name='Value'),
                           x='Metric', y='Value', color='Scenario', barmode='group',
                           color_discrete_map={'Baseline':'#4a5568','Optimized':'#00d4ff'},
                           template='plotly_dark')
        fig_comp.update_layout(paper_bgcolor='#1a1f2e', plot_bgcolor='#1a1f2e',
                                margin=dict(l=10,r=10,t=10,b=10), height=300,
                                xaxis=dict(gridcolor='#2d3748'),
                                yaxis=dict(gridcolor='#2d3748'),
                                legend=dict(font=dict(color='#a0aec0')))
        st.plotly_chart(fig_comp, use_container_width=True)

    # 24-hour simulation
    st.markdown("<div class='section-header'>🕐 24-Hour Coverage Simulation</div>", unsafe_allow_html=True)
    hourly_sim = []
    for h in range(24):
        d_base  = recommend_deployment(h, sim_officers,   top_n=target_zones)
        d_boost = recommend_deployment(h, sim_officers_2, top_n=target_zones)
        hourly_sim.append({
            'hour':              h,
            'baseline_coverage': min(99, round(d_base['city_risk'].mean()*100+10)),
            'optimized_coverage':min(99, round(d_boost['city_risk'].mean()*100+10+(officer_mult-1)*15)),
            'avg_risk':          d_base['city_risk'].mean(),
            'is_peak':           1 if (7<=h<=10 or 17<=h<=21) else 0
        })
    sim_df = pd.DataFrame(hourly_sim)

    fig_24 = go.Figure()
    fig_24.add_trace(go.Scatter(x=sim_df['hour'], y=sim_df['baseline_coverage'],
                                  name='Baseline Coverage', line=dict(color='#4a5568',width=2,dash='dot'), fill='tozeroy', fillcolor='rgba(74,85,104,0.1)'))
    fig_24.add_trace(go.Scatter(x=sim_df['hour'], y=sim_df['optimized_coverage'],
                                  name='Optimized Coverage', line=dict(color='#00d4ff',width=2), fill='tozeroy', fillcolor='rgba(0,212,255,0.08)'))
    fig_24.add_trace(go.Scatter(x=sim_df['hour'], y=sim_df['avg_risk']*100,
                                  name='Avg Risk ×100', line=dict(color='#fc4f4f',width=1.5,dash='dash'), mode='lines'))
    fig_24.add_vline(x=sim_hour, line_dash="dash", line_color="#f6ad55",
                      annotation_text=f"Sim: {sim_hour}:00", annotation_font_color="#f6ad55")
    fig_24.update_layout(template='plotly_dark', paper_bgcolor='#1a1f2e', plot_bgcolor='#1a1f2e',
                          margin=dict(l=10,r=10,t=10,b=10), height=300,
                          xaxis=dict(title='Hour (IST)', gridcolor='#2d3748'),
                          yaxis=dict(title='Coverage Score / Risk ×100', gridcolor='#2d3748'),
                          legend=dict(font=dict(color='#a0aec0')))
    st.plotly_chart(fig_24, use_container_width=True)

    # Detailed table
    st.markdown("<div class='section-header'>📋 Full Deployment Detail</div>", unsafe_allow_html=True)
    disp = boosted[['junction_name','city_risk','recommended_officers','priority']].copy()
    disp['Junction']     = disp['junction_name'].str.split('-').str[-1].str.strip()
    disp['Risk Score']   = disp['city_risk'].round(3)
    disp['Officers']     = disp['recommended_officers']
    disp['Priority']     = disp['priority']
    st.dataframe(
        disp[['Junction','Risk Score','Officers','Priority']],
        hide_index=True, use_container_width=True,
        column_config={
            "Risk Score": st.column_config.ProgressColumn("Risk Score", min_value=0, max_value=1, format="%.3f"),
            "Priority":   st.column_config.TextColumn("Priority"),
        }
    )
