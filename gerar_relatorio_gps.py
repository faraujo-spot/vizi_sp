#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==============================================================
  GERADOR DE RELATÓRIO GPS | PROMOTORES
  Atualizado automaticamente com novos dados
==============================================================
COMO USAR:
  1. Coloque os arquivos de dados na pasta configurada em PASTA_DADOS
  2. Execute: python gerar_relatorio_gps.py
  3. O arquivo index.html e Relatorio_GPS_Marcacoes.html serão atualizados

ARQUIVOS NECESSÁRIOS (na pasta de dados):
  - BASE_GPS_*.xlsx          → marcações GPS
  - DE-PARA_ATIVOS_*.xlsx    → cadastro de promotores
  - Sivas_AS_Rota_*.xlsx     → DE-PARA CDD / Chave
  - DE-PARA_CDD.xlsx         → GEO / Supervisor por CDD
  - SCORE_*_MAIO_*.xlsx      → lojas Score 5
==============================================================
"""

import os, sys, json, glob
import pandas as pd
import numpy as np
from datetime import datetime

# ══════════════════════════════════════════════════════════════
#  CONFIGURAÇÃO — ajuste os caminhos conforme necessário
# ══════════════════════════════════════════════════════════════
PASTA_DADOS   = r"."          # pasta com os arquivos de entrada
PASTA_SAIDA   = r"."          # pasta onde os HTMLs serão salvos
NOME_RELATORIO = "Relatorio_GPS_Marcacoes.html"
NOME_INDEX     = "index.html"

# ══════════════════════════════════════════════════════════════
#  FUNÇÕES AUXILIARES
# ══════════════════════════════════════════════════════════════

def encontrar_arquivo(pasta, padrao):
    """Encontra o arquivo mais recente que corresponde ao padrão."""
    arquivos = glob.glob(os.path.join(pasta, padrao))
    if not arquivos:
        raise FileNotFoundError(f"Nenhum arquivo encontrado para o padrão: {padrao}")
    return max(arquivos, key=os.path.getmtime)

def safe_dt(v):
    if pd.isna(v) or v == '-': return pd.NaT
    try: return pd.Timestamp(v)
    except: return pd.NaT

def to_min(t):
    if not t or t == '': return None
    try: h, m = str(t).split(':'); return int(h)*60+int(m)
    except: return None

def fmt_dur(m):
    if m is None or m <= 0: return ''
    return f"{int(m)//60:02d}:{int(m)%60:02d}"

def safe_sort_date(d):
    try: return pd.to_datetime(d+'/2026', format='%d/%m/%Y')
    except: return pd.Timestamp('2026-01-01')

def clean_df(df):
    df = df.copy()
    for col in df.columns:
        try:
            if str(df[col].dtype).startswith('datetime'):
                df[col] = df[col].dt.strftime('%d/%m/%Y').fillna('')
        except: pass
        df[col] = df[col].fillna('').astype(str).replace({'NaT':'','nan':'','<NA>':''})
    return df.to_dict(orient='records')

def fmt_time(v):
    try:
        if pd.isna(v): return ''
        return pd.to_datetime(v, unit='D', origin='1899-12-30').strftime('%H:%M')
    except: return ''

# ══════════════════════════════════════════════════════════════
#  1. CARREGAR BASES
# ══════════════════════════════════════════════════════════════
print("=" * 60)
print("  GERADOR DE RELATÓRIO GPS | PROMOTORES")
print(f"  {datetime.now().strftime('%d/%m/%Y %H:%M')}")
print("=" * 60)

print("\n[1/7] Carregando bases de dados...")

try:
    arq_gps    = encontrar_arquivo(PASTA_DADOS, "BASE_GPS_*.xlsx")
    arq_ativos = encontrar_arquivo(PASTA_DADOS, "DE-PARA_ATIVOS_*.xlsx")
    arq_sivas  = encontrar_arquivo(PASTA_DADOS, "Sivas_AS_Rota_*.xlsx")
    arq_cdd    = encontrar_arquivo(PASTA_DADOS, "DE-PARA_CDD.xlsx")
    arq_score  = encontrar_arquivo(PASTA_DADOS, "SCORE_*.xlsx")
except FileNotFoundError as e:
    print(f"\n  ERRO: {e}")
    print("  Verifique se os arquivos estão na pasta correta.")
    sys.exit(1)

print(f"  GPS:    {os.path.basename(arq_gps)}")
print(f"  Ativos: {os.path.basename(arq_ativos)}")
print(f"  Sivas:  {os.path.basename(arq_sivas)}")
print(f"  CDD:    {os.path.basename(arq_cdd)}")
print(f"  Score:  {os.path.basename(arq_score)}")

gps        = pd.read_excel(arq_gps, sheet_name='Planilha1', dtype={'ID Promotor': str, 'Unb Pdv': str})
ativos     = pd.read_excel(arq_ativos, dtype={'MATRICULA': str, 'CPF': str})
sivas      = pd.read_excel(arq_sivas, dtype={'Chave': str})
depara_cdd = pd.read_excel(arq_cdd)
score      = pd.read_excel(arq_score, dtype={'Código UNB': str})

print(f"  GPS: {len(gps)} linhas | Ativos: {len(ativos)} | Sivas: {len(sivas)}")

# ══════════════════════════════════════════════════════════════
#  2. PROCESSAR GPS
# ══════════════════════════════════════════════════════════════
print("\n[2/7] Processando base GPS...")

df = gps[~gps['Qualidade da Marcação'].str.upper().str.contains('NAO PLANEJADO', na=False)].copy()
df = df.rename(columns={'Geo': 'GEO_GPS'})
df['_MATRICULA'] = df['ID Promotor'].str.replace(r'^[A-Z]+-', '', regex=True).str.strip()
print(f"  Após filtrar não planejados: {len(df)} linhas (removidas: {len(gps)-len(df)})")

# ══════════════════════════════════════════════════════════════
#  3. PROCESSAR DE-PARA ATIVOS
# ══════════════════════════════════════════════════════════════
print("\n[3/7] Processando DE-PARA Ativos...")

ativos['DATA RESCISAO'] = ativos['DATA RESCISAO'].apply(safe_dt)
ativos['ADMISSAO'] = pd.to_datetime(ativos['ADMISSAO'], errors='coerce')

# Tratamentos especiais de matrícula
ativos.loc[(ativos['CPF'] == '523.089.738-46') & (ativos['MATRICULA'] == '46908'), 'MATRICULA'] = '163428'
ativos.loc[(ativos['CPF'] == '472.097.428-75') & (ativos['MATRICULA'] == '39068'), 'MATRICULA'] = '149085'
ativos.loc[ativos['CPF'] == '350.733.968-47', 'NOME'] = 'FLAVIA CRISTINA OLIVEIRA SALUSTRIANO DE'

sit_ordem = {'TRABALHANDO': 0, 'FÉRIAS': 1, 'LICENÇA MATERNIDADE': 2, 'AUXÍLIO DOENÇA': 3, 'DEMITIDO': 4}
ativos['_sit_ordem'] = ativos['SITUACAO'].map(sit_ordem).fillna(9)

# PASSO 1: matrícula → nome
mat_to_nome = dict(zip(ativos['MATRICULA'], ativos['NOME']))
df['NOME_PROMOTOR'] = df['_MATRICULA'].map(mat_to_nome).fillna('')

# PASSO 2: nome → melhor situação (não-demitido primeiro, mais recente)
ativos_best = ativos.sort_values(['NOME','_sit_ordem','ADMISSAO'], ascending=[True,True,False]).drop_duplicates('NOME', keep='first')
info_map = {}
for _, row in ativos_best.iterrows():
    info_map[row['NOME']] = {
        'sit': row['SITUACAO'],
        'adm': row['ADMISSAO'],
        'res': row['DATA RESCISAO'],
        'cpf': row['CPF']
    }

df['SITUACAO']      = df['NOME_PROMOTOR'].map(lambda n: info_map.get(n,{}).get('sit',''))
df['ADMISSAO']      = df['NOME_PROMOTOR'].map(lambda n: info_map.get(n,{}).get('adm', pd.NaT))
df['DATA_RESCISAO'] = df['NOME_PROMOTOR'].map(lambda n: info_map.get(n,{}).get('res', pd.NaT))
df['CPF']           = df['NOME_PROMOTOR'].map(lambda n: info_map.get(n,{}).get('cpf',''))
df['ADMISSAO']      = df['ADMISSAO'].apply(lambda x: x if isinstance(x, pd.Timestamp) else pd.NaT)
df['DATA_RESCISAO'] = df['DATA_RESCISAO'].apply(lambda x: x if isinstance(x, pd.Timestamp) else pd.NaT)

print(f"  Situação: {df['SITUACAO'].value_counts().to_dict()}")

# ══════════════════════════════════════════════════════════════
#  4. CRUZAR SIVAS + DE-PARA CDD + SCORE
# ══════════════════════════════════════════════════════════════
print("\n[4/7] Cruzando bases auxiliares...")

sivas_sel = sivas[['Chave','CDD Ambev']].drop_duplicates('Chave')
df = df.merge(sivas_sel, left_on='Unb Pdv', right_on='Chave', how='left')

dc = depara_cdd[['CDD AMBEV','GEO','SUPERVISOR','SUPER']].rename(columns={'CDD AMBEV':'CDD Ambev','GEO':'GEO_SUP'})
df = df.merge(dc, on='CDD Ambev', how='left')

score_unbs = set(score['Código UNB'].astype(str).str.strip())
df['SCORE_5'] = df['Unb Pdv'].apply(lambda x: 'Sim' if str(x).strip() in score_unbs else 'Não')

print(f"  Match GPS × Score 5: {(df['SCORE_5']=='Sim').sum()} marcações")

# ══════════════════════════════════════════════════════════════
#  5. CAMPOS AUXILIARES
# ══════════════════════════════════════════════════════════════
print("\n[5/7] Calculando campos auxiliares...")

df['Data']      = pd.to_datetime(df['Data'], errors='coerce')
df['_mes']      = df['Data'].dt.strftime('%Y-%m').fillna('')
df['_week']     = df['Data'].dt.isocalendar().week.astype('Int64').astype(str).replace({'<NA>':''})
df['_data_str'] = df['Data'].dt.strftime('%d/%m').fillna('')
df['Entrada_fmt'] = df['Entrada'].apply(fmt_time)
df['Saída_fmt']   = df['Saída'].apply(fmt_time)

# ══════════════════════════════════════════════════════════════
#  6. GERAR DADOS PARA O HTML
# ══════════════════════════════════════════════════════════════
print("\n[6/7] Gerando estruturas de dados...")

# ── BASE_DATA ──────────────────────────────────────────────────
base_df = df[['GEO_GPS','ID Promotor','_MATRICULA','NOME_PROMOTOR','CPF','SITUACAO','ADMISSAO','DATA_RESCISAO',
              'CDD Ambev','GEO_SUP','SUPERVISOR','SUPER','Rede','Unb Pdv','Tamanho Loja','Data',
              'Entrada_fmt','Saída_fmt','Coord. Checkin','Coord. Checkout','Qualidade da Marcação',
              'Distância Checkin','Distância Checkout','SCORE_5','_mes','_week','_data_str']].copy()
base_df.columns = ['GEO GPS','ID Promotor','Matrícula','Nome Promotor','CPF','Situação','Admissão','Data Rescisão',
                   'CDD','GEO Supervisor','Supervisor','Super','Rede','Unb Pdv','Tamanho Loja','Data',
                   'Entrada','Saída','Coord. Checkin','Coord. Checkout','Qualidade da Marcação',
                   'Distância Checkin','Distância Checkout','Score 5','_mes','_week','_data_str']
base_data = clean_df(base_df)

# ── RESUMO_DATA ────────────────────────────────────────────────
resumo = df.groupby(['_MATRICULA','ID Promotor','NOME_PROMOTOR','CPF','SITUACAO',
                     'ADMISSAO','DATA_RESCISAO','CDD Ambev','GEO_SUP','SUPERVISOR','SUPER']).agg(
    Total=('Qualidade da Marcação','count'),
    GPS_OK=('Qualidade da Marcação', lambda x:(x=='GPS OK').sum()),
).reset_index()
resumo['PCT_GPS'] = resumo['GPS_OK'] / resumo['Total']
resumo_data = clean_df(resumo.rename(columns={
    '_MATRICULA':'Matrícula','NOME_PROMOTOR':'Nome Promotor','SITUACAO':'Situação',
    'ADMISSAO':'Admissão','DATA_RESCISAO':'Data Rescisão','CDD Ambev':'CDD',
    'GEO_SUP':'GEO','SUPERVISOR':'Supervisor','SUPER':'Super',
    'Total':'Total Marcações','GPS_OK':'GPS OK','PCT_GPS':'% GPS'
})[['ID Promotor','Matrícula','Nome Promotor','CPF','Situação','Admissão','Data Rescisão',
    'CDD','GEO','Supervisor','Super','Total Marcações','GPS OK','% GPS']])

# ── STATUS_DATA (pivot promotor × dia - % GPS) ─────────────────
def safe_sort_d(d):
    try: return pd.to_datetime(d+'/2026', format='%d/%m/%Y')
    except: return pd.Timestamp('2026-01-01')

pday_gps = df.groupby(['_MATRICULA','NOME_PROMOTOR','CDD Ambev','SUPERVISOR','SUPER','SITUACAO','_data_str','_mes','_week']).agg(
    total=('Qualidade da Marcação','count'),
    ok   =('Qualidade da Marcação', lambda x:(x=='GPS OK').sum()),
).reset_index()
pday_gps['pct'] = pday_gps['ok']/pday_gps['total']

all_dates = sorted(pday_gps['_data_str'].unique(), key=safe_sort_d)
adm_map = df.drop_duplicates('_MATRICULA').set_index('_MATRICULA')[['ADMISSAO','DATA_RESCISAO']].to_dict('index')

prom_gps = {}
for _, row in pday_gps.iterrows():
    mat = row['_MATRICULA']
    if mat not in prom_gps:
        ai = adm_map.get(mat, {})
        adm = ai.get('ADMISSAO', pd.NaT); res = ai.get('DATA_RESCISAO', pd.NaT)
        prom_gps[mat] = {'mat':mat,'nome':row['NOME_PROMOTOR'],'cdd':row['CDD Ambev'],
                         'sup':row['SUPERVISOR'],'super':row['SUPER'],'sit':row['SITUACAO'],
                         'adm':adm.strftime('%d/%m/%Y') if isinstance(adm,pd.Timestamp) and pd.notna(adm) else '',
                         'res':res.strftime('%d/%m/%Y') if isinstance(res,pd.Timestamp) and pd.notna(res) else '',
                         'cpf':info_map.get(row['NOME_PROMOTOR'],{}).get('cpf',''),'days':{}}
    prom_gps[mat]['days'][row['_data_str']] = {
        'ok':int(row['ok']),'total':int(row['total']),
        'pct':round(float(row['pct'])*100,1),'mes':row['_mes'],'week':str(row['_week'])
    }
status_data = sorted(prom_gps.values(), key=lambda x:(x['sup'] or '',x['cdd'] or '',x['nome'] or ''))

# ── JORNADA_DATA (pivot promotor × dia - duração média visitas GPS OK) ──
df_ok = df[df['Qualidade da Marcação']=='GPS OK'].copy()
df_ok['_dur_min'] = df_ok.apply(lambda r:
    (to_min(r['Saída_fmt'])-to_min(r['Entrada_fmt']))
    if to_min(r['Saída_fmt']) and to_min(r['Entrada_fmt']) and to_min(r['Saída_fmt'])>to_min(r['Entrada_fmt'])
    else None, axis=1)

pday_jr = df_ok[df_ok['_dur_min'].notna()].groupby(
    ['_MATRICULA','NOME_PROMOTOR','CDD Ambev','SUPERVISOR','SUPER','SITUACAO','_data_str','_mes','_week']
).agg(media_min=('_dur_min','mean'), visitas=('_dur_min','count')).reset_index()
pday_jr['media_min'] = pday_jr['media_min'].round(0).astype(int)

prom_jr = {}
for _, row in pday_jr.iterrows():
    mat = row['_MATRICULA']
    if mat not in prom_jr:
        ai = adm_map.get(mat, {})
        adm = ai.get('ADMISSAO', pd.NaT)
        prom_jr[mat] = {'mat':mat,'nome':row['NOME_PROMOTOR'],'cdd':row['CDD Ambev'],
                        'sup':row['SUPERVISOR'],'super':row['SUPER'],'sit':row['SITUACAO'],
                        'adm':adm.strftime('%d/%m/%Y') if isinstance(adm,pd.Timestamp) and pd.notna(adm) else '',
                        'days':{}}
    prom_jr[mat]['days'][row['_data_str']] = {
        'dur':fmt_dur(row['media_min']),'vis':int(row['visitas']),'mes':row['_mes'],'week':str(row['_week'])
    }

for p in prom_jr.values():
    mins = [to_min(d['dur']) for d in p['days'].values() if d.get('dur')]
    mins = [x for x in mins if x and x>0]
    p['avg'] = fmt_dur(round(sum(mins)/len(mins))) if mins else ''

jornada_data = sorted(prom_jr.values(), key=lambda x:(x['sup'] or '',x['cdd'] or '',x['nome'] or ''))
jornada_dates = sorted(pday_jr['_data_str'].unique(), key=safe_sort_d)

# ── DAILY_FULL / WEEKLY_FULL ───────────────────────────────────
daily_agg = df.groupby('_data_str').agg(
    t=('Qualidade da Marcação','count'),
    ok=('Qualidade da Marcação', lambda x:(x=='GPS OK').sum()),
    s5t=('SCORE_5', lambda x:(x=='Sim').sum()),
    s5ok=('Qualidade da Marcação', lambda x:((x=='GPS OK')&(df.loc[x.index,'SCORE_5']=='Sim')).sum()),
    _mes=('_mes', lambda x: x.mode()[0] if len(x)>0 else ''),
    _week=('_week', lambda x: x.mode()[0] if len(x)>0 else ''),
).reset_index()
daily_sorted = daily_agg.sort_values('_data_str', key=lambda s: s.map(safe_sort_d)).tail(30)
DAILY_FULL = [{'d':r['_data_str'],'mes':r['_mes'],'week':str(r['_week']),
               'pct':round(r['ok']/r['t']*100,1) if r['t'] else None,
               'pct_s5':round(r['s5ok']/r['s5t']*100,1) if r['s5t'] else None}
              for _,r in daily_sorted.iterrows()]

week_ranges = {}
for _, row in df[['Data','_week']].dropna().iterrows():
    k = str(row['_week'])
    if not k or k in ('','<NA>','nan'): continue
    d = row['Data']
    if k not in week_ranges: week_ranges[k] = {'min':d,'max':d}
    else:
        if d < week_ranges[k]['min']: week_ranges[k]['min'] = d
        if d > week_ranges[k]['max']: week_ranges[k]['max'] = d

weekly_agg = df.groupby('_week').agg(
    t=('Qualidade da Marcação','count'),
    ok=('Qualidade da Marcação', lambda x:(x=='GPS OK').sum()),
    s5t=('SCORE_5', lambda x:(x=='Sim').sum()),
    s5ok=('Qualidade da Marcação', lambda x:((x=='GPS OK')&(df.loc[x.index,'SCORE_5']=='Sim')).sum()),
    _mes=('_mes', lambda x: ','.join(sorted(set(x.dropna())))),
).reset_index()
weekly_agg = weekly_agg[weekly_agg['_week'].str.strip().ne('')].sort_values('_week', key=lambda s: s.astype(int))
WEEKLY_FULL = [{'w':r['_week'],'meses':r['_mes'],
                'label':f"Semana {r['_week']} — {week_ranges[r['_week']]['min'].strftime('%d/%m/%Y')} a {week_ranges[r['_week']]['max'].strftime('%d/%m/%Y')}" if r['_week'] in week_ranges else f"Semana {r['_week']}",
                'pct':round(r['ok']/r['t']*100,1) if r['t'] else None,
                'pct_s5':round(r['s5ok']/r['s5t']*100,1) if r['s5t'] else None}
               for _,r in weekly_agg.iterrows()]

# ── SEMANAS/MESES/MAPS ─────────────────────────────────────────
semanas_info = [{'num':k,'label':f"Semana {k} — {v['min'].strftime('%d/%m/%Y')} a {v['max'].strftime('%d/%m/%Y')}"}
                for k,v in sorted(week_ranges.items(), key=lambda x:int(x[0]))]
meses_raw   = sorted([m for m in df['_mes'].unique() if m])
meses_label = {m: pd.to_datetime(m+'-01').strftime('%b/%Y').upper() for m in meses_raw}

mes_sem_map, sem_mes_map = {}, {}
for _, row in df[['_mes','_week']].drop_duplicates().iterrows():
    m, w = row['_mes'], str(row['_week'])
    if not m or not w or w in ('','<NA>','nan'): continue
    mes_sem_map.setdefault(m,set()).add(w)
    sem_mes_map.setdefault(w,set()).add(m)
mes_sem_map = {k:sorted(v) for k,v in mes_sem_map.items()}
sem_mes_map = {k:sorted(v) for k,v in sem_mes_map.items()}

cdd_sup_map, sup_cdd_map = {}, {}
for _, row in df[['CDD Ambev','SUPERVISOR']].dropna().drop_duplicates().iterrows():
    cdd, sup = row['CDD Ambev'], row['SUPERVISOR']
    if sup not in cdd_sup_map.get(cdd,[]): cdd_sup_map.setdefault(cdd,[]).append(sup)
    if cdd not in sup_cdd_map.get(sup,[]): sup_cdd_map.setdefault(sup,[]).append(cdd)

sups_all = sorted(df['SUPERVISOR'].dropna().unique())
cdds_all = sorted(df['CDD Ambev'].dropna().unique())

print(f"  BASE_DATA: {len(base_data)} | RESUMO: {len(resumo_data)} | STATUS: {len(status_data)} | JORNADA: {len(jornada_data)}")
print(f"  Datas: {len(all_dates)} | Semanas: {len(semanas_info)} | Meses: {meses_raw}")

# ══════════════════════════════════════════════════════════════
#  7. MONTAR E SALVAR HTML
# ══════════════════════════════════════════════════════════════
print("\n[7/7] Montando HTML final...")

# Data de atualização
data_atualizacao = datetime.now().strftime('%d/%m/%Y')

# Bloco de dados JS
js_data = f"""const BASE_DATA = {json.dumps(base_data, ensure_ascii=False, default=str)};
const RESUMO_DATA = {json.dumps(resumo_data, ensure_ascii=False, default=str)};
const PROM_DAY = {json.dumps(status_data, ensure_ascii=False, default=str)};
const ALL_DATES = {json.dumps(all_dates, ensure_ascii=False)};
const SEMANAS_INFO = {json.dumps(semanas_info, ensure_ascii=False)};
const MESES = {json.dumps(meses_raw, ensure_ascii=False)};
const MESES_LABEL = {json.dumps(meses_label, ensure_ascii=False)};
const MES_SEM_MAP = {json.dumps(mes_sem_map, ensure_ascii=False)};
const SEM_MES_MAP = {json.dumps(sem_mes_map, ensure_ascii=False)};
const CDD_SUP_MAP = {json.dumps(cdd_sup_map, ensure_ascii=False)};
const SUP_CDD_MAP = {json.dumps(sup_cdd_map, ensure_ascii=False)};
const SUPERVISORES_ALL = {json.dumps(list(sups_all), ensure_ascii=False)};
const CDDS_ALL = {json.dumps(list(cdds_all), ensure_ascii=False)};
const DAILY_FULL = {json.dumps(DAILY_FULL, ensure_ascii=False)};
const WEEKLY_FULL = {json.dumps(WEEKLY_FULL, ensure_ascii=False)};
const STATUS_DATA = {json.dumps(status_data, ensure_ascii=False, default=str)};
const STATUS_DATES = {json.dumps(all_dates, ensure_ascii=False)};
const JORNADA_DATA = {json.dumps(jornada_data, ensure_ascii=False, default=str)};
const JORNADA_DATES = {json.dumps(jornada_dates, ensure_ascii=False)};
"""

# Ler partes do template
script_dir = os.path.dirname(os.path.abspath(__file__))
tpl_header = open(os.path.join(script_dir,'template_header.html'), encoding='utf-8').read()
tpl_logic  = open(os.path.join(script_dir,'template_logic.js'),   encoding='utf-8').read()
tpl_footer = open(os.path.join(script_dir,'template_footer.html'), encoding='utf-8').read()

# Atualizar data no header
tpl_header = tpl_header.replace(
    'Bases atualizadas em 07/05/2026',
    f'Bases atualizadas em {data_atualizacao}'
)

html_final = tpl_header + '<script>\n' + js_data + '\n' + tpl_logic + tpl_footer

# Salvar
saida = os.path.join(PASTA_SAIDA, NOME_RELATORIO)
with open(saida, 'w', encoding='utf-8') as f:
    f.write(html_final)

print(f"\n  ✅ Relatório gerado: {saida}")
print(f"  Tamanho: {len(html_final)/1024/1024:.1f} MB")
print(f"\n  Resumo:")
print(f"  • {len(base_data):,} marcações processadas")
print(f"  • {len(resumo_data)} promotores no resumo")
print(f"  • {len(semanas_info)} semanas | {len(meses_raw)} meses")
print(f"  • Data atualização: {data_atualizacao}")
print("\n" + "=" * 60)
print("  CONCLUÍDO COM SUCESSO!")
print("=" * 60)
