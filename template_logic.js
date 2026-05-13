// ── state ──────────────────────────────────────────────────────────────────
let fBase=BASE_DATA, togCDDType='cdd', togCDDMode='geral';
let lineInst=null,barInst=null,geoInst=null,weekInst=null;




// ── Eixo Y dinâmico (como Excel) ──────────────────────────────────────────
function dynAxis(datasets){
  const vals=datasets.flatMap(ds=>ds.data||[]).filter(v=>v!==null&&v!==undefined&&!isNaN(v));
  if(!vals.length) return {min:60,max:100};
  const lo=Math.min(...vals), hi=Math.max(...vals);
  const pad=Math.max((hi-lo)*0.15, 2);
  const mn=Math.max(0, Math.floor((lo-pad)/5)*5);
  const mx=Math.min(100, Math.ceil((hi+pad)/5)*5);
  return {min:mn, max:mx};
}
// ── fim eixo dinâmico ──────────────────────────────────────────────────────

let selMeses=new Set(MESES), selSems=new Set(SEMANAS_INFO.map(s=>s.num));

// ── nav ────────────────────────────────────────────────────────────────────
function showPage(id,btn){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  btn.classList.add('active');
}

// ── multi-select ──────────────────────────────────────────────────────────
function toggleMs(type){
  const dd=document.getElementById(`ms-${type}-dd`);
  document.querySelectorAll('.ms-dd').forEach(d=>{if(d!==dd)d.classList.remove('open');});
  dd.classList.toggle('open');
}
document.addEventListener('click',e=>{
  if(!e.target.closest('.multi-sel')) document.querySelectorAll('.ms-dd').forEach(d=>d.classList.remove('open'));
});
function buildMesDD(){
  const dd=document.getElementById('ms-mes-dd');
  dd.innerHTML=`<div class="ms-item"><label><input type="checkbox" id="ms-mes-all" checked onchange="toggleAllMes(this.checked)"> Marcar/Desmarcar todos</label></div><div class="ms-sep"></div>`;
  MESES.forEach(m=>dd.innerHTML+=`<div class="ms-item"><label><input type="checkbox" class="ms-mes-cb" value="${m}" checked onchange="onMesChange()"> ${MESES_LABEL[m]||m}</label></div>`);
}
function buildSemDD(){
  const dd=document.getElementById('ms-sem-dd');
  dd.innerHTML=`<div class="ms-item"><label><input type="checkbox" id="ms-sem-all" checked onchange="toggleAllSem(this.checked)"> Marcar/Desmarcar todos</label></div><div class="ms-sep"></div>`;
  SEMANAS_INFO.forEach(s=>dd.innerHTML+=`<div class="ms-item"><label><input type="checkbox" class="ms-sem-cb" value="${s.num}" checked onchange="onSemChange()"> ${s.label}</label></div>`);
}
function toggleAllMes(c){
  document.querySelectorAll('.ms-mes-cb').forEach(cb=>{cb.checked=c;cb.closest('.ms-item').style.opacity='1';cb.closest('.ms-item').style.pointerEvents='';});
  selMeses=c?new Set(MESES):new Set();updateMesBtn();resetSemC();applyFilters();
}
function toggleAllSem(c){
  document.querySelectorAll('.ms-sem-cb').forEach(cb=>{cb.checked=c;cb.closest('.ms-item').style.opacity='1';cb.closest('.ms-item').style.pointerEvents='';});
  selSems=c?new Set(SEMANAS_INFO.map(s=>s.num)):new Set();updateSemBtn();resetMesC();applyFilters();
}
function onMesChange(){
  selMeses=new Set([...document.querySelectorAll('.ms-mes-cb:checked')].map(c=>c.value));
  document.getElementById('ms-mes-all').checked=selMeses.size===MESES.length;updateMesBtn();
  const valid=new Set();selMeses.forEach(m=>(MES_SEM_MAP[m]||[]).forEach(w=>valid.add(w)));
  document.querySelectorAll('.ms-sem-cb').forEach(cb=>{
    const ok=selMeses.size===0||valid.has(cb.value);
    cb.closest('.ms-item').style.opacity=ok?'1':'.35';cb.closest('.ms-item').style.pointerEvents=ok?'':'none';
    if(!ok)cb.checked=false;
  });
  selSems=new Set([...document.querySelectorAll('.ms-sem-cb:checked')].map(c=>c.value));
  document.getElementById('ms-sem-all').checked=false;updateSemBtn();applyFilters();
}
function onSemChange(){
  selSems=new Set([...document.querySelectorAll('.ms-sem-cb:checked')].map(c=>c.value));
  document.getElementById('ms-sem-all').checked=selSems.size===SEMANAS_INFO.length;updateSemBtn();
  const valid=new Set();selSems.forEach(w=>(SEM_MES_MAP[w]||[]).forEach(m=>valid.add(m)));
  document.querySelectorAll('.ms-mes-cb').forEach(cb=>{
    const ok=selSems.size===0||valid.has(cb.value);
    cb.closest('.ms-item').style.opacity=ok?'1':'.35';cb.closest('.ms-item').style.pointerEvents=ok?'':'none';
    if(!ok)cb.checked=false;
  });
  selMeses=new Set([...document.querySelectorAll('.ms-mes-cb:checked')].map(c=>c.value));
  document.getElementById('ms-mes-all').checked=false;updateMesBtn();applyFilters();
}
function resetSemC(){document.querySelectorAll('.ms-sem-cb').forEach(cb=>{cb.closest('.ms-item').style.opacity='1';cb.closest('.ms-item').style.pointerEvents='';cb.checked=true;});selSems=new Set(SEMANAS_INFO.map(s=>s.num));document.getElementById('ms-sem-all').checked=true;updateSemBtn();}
function resetMesC(){document.querySelectorAll('.ms-mes-cb').forEach(cb=>{cb.closest('.ms-item').style.opacity='1';cb.closest('.ms-item').style.pointerEvents='';cb.checked=true;});selMeses=new Set(MESES);document.getElementById('ms-mes-all').checked=true;updateMesBtn();}
function updateMesBtn(){const n=selMeses.size;document.getElementById('ms-mes-btn').innerHTML=n===0?'Nenhum ▾':n===MESES.length?'Todos ▾':`${n} sel. ▾`;}
function updateSemBtn(){const n=selSems.size,t=SEMANAS_INFO.length;document.getElementById('ms-sem-btn').innerHTML=n===0?'Nenhuma ▾':n===t?'Todas ▾':`${n} sel. ▾`;}

// ── FILTROS ────────────────────────────────────────────────────────────────
function onSupChange(){
  const sv=document.getElementById('f-sup').value;
  const cs=document.getElementById('f-cdd');const cur=cs.value;
  cs.innerHTML='<option value="">Todos</option>';
  const cdds=sv?(SUP_CDD_MAP[sv]||[]).sort():CDDS_ALL;
  cdds.forEach(c=>cs.innerHTML+=`<option value="${c}">${c}</option>`);
  if(cdds.includes(cur))cs.value=cur;applyFilters();
}
function applyFilters(){
  const allM=selMeses.size===0||selMeses.size===MESES.length;
  const allS=selSems.size===0||selSems.size===SEMANAS_INFO.length;
  const sup=document.getElementById('f-sup').value;
  const cdd=document.getElementById('f-cdd').value;
  fBase=BASE_DATA.filter(r=>{
    if(!allM&&!selMeses.has(r['_mes']))return false;
    if(!allS&&!selSems.has(r['_week']))return false;
    if(sup&&r['Supervisor']!==sup)return false;
    if(cdd&&r['CDD']!==cdd)return false;
    return true;
  });
  buildCards();buildGeoChart();buildBarChart();buildResumeTables();
  // Linha e semanal só reagem a sup/cdd (não a mês/semana)
  const _sup=document.getElementById('f-sup').value;
  const _cdd=document.getElementById('f-cdd').value;
  if(_sup||_cdd){ buildLineChart(); buildWeekChart(); }
  filterStatusTab();
}
function clearFilters(){
  document.querySelectorAll('.ms-mes-cb,.ms-sem-cb').forEach(cb=>{cb.checked=true;cb.closest('.ms-item').style.opacity='1';cb.closest('.ms-item').style.pointerEvents='';});
  document.getElementById('ms-mes-all').checked=true;document.getElementById('ms-sem-all').checked=true;
  selMeses=new Set(MESES);selSems=new Set(SEMANAS_INFO.map(s=>s.num));updateMesBtn();updateSemBtn();
  document.getElementById('f-sup').value='';
  const cs=document.getElementById('f-cdd');cs.innerHTML='<option value="">Todos</option>';
  CDDS_ALL.forEach(c=>cs.innerHTML+=`<option value="${c}">${c}</option>`);
  fBase=BASE_DATA;buildCards();buildGeoChart();buildBarChart();buildResumeTables();buildLineChart();buildWeekChart();filterStatusTab();
}

// ── HELPERS ────────────────────────────────────────────────────────────────
function pctC(v){return v>=95?'#1e6b3a':v>=90?'#3ab06b':v>=80?'#d29922':'#b83232';}
function pctCell(raw){
  const v=parseFloat(raw)*100,c=pctC(v);
  return `<div class="pct-cell"><div class="pct-track"><div class="pct-fill" style="width:${v.toFixed(0)}%;background:${c}"></div></div><span class="pct-val" style="color:${c}">${v.toFixed(1)}%</span></div>`;
}
function sitBadge(s){
  if(!s)return'<span class="badge b-gy">—</span>';
  if(s==='DEMITIDO')return`<span class="badge b-bd">${s}</span>`;
  if(s==='TRABALHANDO')return`<span class="badge b-ok">${s}</span>`;
  return`<span class="badge b-wn">${s}</span>`;
}

// ── CARDS ──────────────────────────────────────────────────────────────────
function buildCards(){
  const t=fBase.length,ok=fBase.filter(r=>r['Qualidade da Marcação']==='GPS OK').length;
  const s5=fBase.filter(r=>r['Score 5']==='Sim').length;
  const s5ok=fBase.filter(r=>r['Score 5']==='Sim'&&r['Qualidade da Marcação']==='GPS OK').length;
  const nao=fBase.filter(r=>r['Qualidade da Marcação']==='NAO REALIZADO').length;
  const fora=fBase.filter(r=>r['Qualidade da Marcação']==='FORA DO RAIO').length;
  const inc=fBase.filter(r=>r['Qualidade da Marcação']==='INCOMPLETO').length;
  const p=v=>t?+(v/t*100).toFixed(1):0,ps=v=>s5?+(v/s5*100).toFixed(1):0;
  document.getElementById('cardsGrid').innerHTML=[
    {l:'Total marcações',a:'acc-dk',pct:`${p(ok)}%`,col:'#1a2c52',c:`<b>${t.toLocaleString('pt-BR')}</b> total / <b>${ok.toLocaleString('pt-BR')}</b> GPS OK`},
    {l:'Score 5',a:'acc-gr',pct:`${ps(s5ok)}%`,col:'#1e6b3a',c:`<b>${s5.toLocaleString('pt-BR')}</b> lojas / <b>${s5ok.toLocaleString('pt-BR')}</b> GPS OK`},
    {l:'Não realizado',a:'acc-or',pct:`${p(nao)}%`,col:'#b86e0a',c:`<b>${nao.toLocaleString('pt-BR')}</b>`},
    {l:'Fora do raio',a:'acc-rd',pct:`${p(fora)}%`,col:'#a82828',c:`<b>${fora.toLocaleString('pt-BR')}</b>`},
    {l:'Incompleto',a:'acc-gy',pct:`${p(inc)}%`,col:'#5a6a8a',c:`<b>${inc.toLocaleString('pt-BR')}</b>`},
  ].map(x=>`<div class="card"><div class="card-lbl">${x.l}</div><div class="card-accent ${x.a}"></div><div class="card-pct" style="color:${x.col}">${x.pct}</div><div class="card-counts">${x.c}</div></div>`).join('');
}

// ── LINE CHART — reativo ao filtro mês/semana via DAILY_FULL ──────────────
function buildLineChart(){
  // Sempre usa DAILY_FULL — filtrado apenas por sup/cdd via fBase quando aplicável
  const sup=document.getElementById('f-sup').value;
  const cdd=document.getElementById('f-cdd').value;
  let dailyData;
  if(sup||cdd){
    const dm={};
    fBase.forEach(r=>{const d=r['_data_str']||'';if(!d)return;
      if(!dm[d])dm[d]={t:0,ok:0,s5t:0,s5ok:0};
      dm[d].t++;if(r['Qualidade da Marcação']==='GPS OK')dm[d].ok++;
      if(r['Score 5']==='Sim'){dm[d].s5t++;if(r['Qualidade da Marcação']==='GPS OK')dm[d].s5ok++;}
    });
    dailyData=Object.entries(dm).sort((a,b)=>{
      const[da,ma]=a[0].split('/');const[db,mb]=b[0].split('/');
      return new Date(`2026-${ma}-${da}`)-new Date(`2026-${mb}-${db}`);
    }).map(([d,v])=>({d,pct:v.t?+(v.ok/v.t*100).toFixed(1):null,pct_s5:v.s5t?+(v.s5ok/v.s5t*100).toFixed(1):null}));
  } else {
    dailyData=[...DAILY_FULL];
  }
  if(dailyData.length>30) dailyData=dailyData.slice(-30);
  const labels=dailyData.map(d=>d.d);
  const genP=dailyData.map(d=>d.pct);
  const s5P=dailyData.map(d=>d.pct_s5);
  const ctx=document.getElementById('chartLine').getContext('2d');
  if(lineInst)lineInst.destroy();
  lineInst=new Chart(ctx,{type:'line',
    data:{labels,datasets:[
      {label:'Score 5',data:s5P,borderColor:'#c47a1a',backgroundColor:'rgba(196,122,26,.04)',pointBackgroundColor:'#c47a1a',pointRadius:3,borderWidth:2,tension:.3,fill:false,spanGaps:true},
      {label:'Geral',data:genP,borderColor:'#1a2c52',backgroundColor:'rgba(26,44,82,.06)',pointBackgroundColor:'#1a2c52',pointRadius:3,borderWidth:2,tension:.3,fill:true,spanGaps:true},
    ]},
    options:{responsive:true,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:{backgroundColor:'#fff',titleColor:'#1a2340',bodyColor:'#5a6a8a',borderColor:'#e4e9f2',borderWidth:1,padding:8,
        callbacks:{label:c=>` ${c.dataset.label}: ${c.parsed.y!==null?c.parsed.y.toFixed(1)+'%':'—'}`}}},
      scales:{
        x:{grid:{color:'#f0f2f5'},ticks:{color:'#7a8aaa',font:{size:8},maxRotation:45,minRotation:30,autoSkip:false}},
        y:{...dynAxis([{data:genP},{data:s5P}]),grid:{color:'#f0f2f5'},ticks:{color:'#7a8aaa',font:{size:9},callback:v=>v+'%'}}
      }},
    plugins:[{id:'ll',afterDatasetsDraw(chart){
      const{ctx:c,data}=chart;
      data.datasets.forEach((ds,di)=>{
        const meta=chart.getDatasetMeta(di);const isS5=ds.label==='Score 5';
        meta.data.forEach((pt,i)=>{
          const v=ds.data[i];if(v===null||v===undefined)return;
          if(data.labels.length>15&&i%2!==0)return;
          c.save();c.font='bold 8px Inter,sans-serif';c.fillStyle=isS5?'#c47a1a':'#1a2c52';c.textAlign='center';
          c.fillText(v.toFixed(1)+'%',pt.x,pt.y+(isS5?-9:11));c.restore();
        });
      });
    }}]
  });
}

// ── WEEK CHART — reativo ao filtro mês/semana via WEEKLY_FULL ─────────────
function buildWeekChart(){
  // Sempre usa WEEKLY_FULL — filtrado apenas por sup/cdd via fBase quando aplicável
  const sup=document.getElementById('f-sup').value;
  const cdd=document.getElementById('f-cdd').value;
  let weeklyData;
  if(sup||cdd){
    const wm={};
    fBase.forEach(r=>{const w=r['_week'];if(!w||w==='')return;
      if(!wm[w])wm[w]={t:0,ok:0,s5t:0,s5ok:0};
      wm[w].t++;if(r['Qualidade da Marcação']==='GPS OK')wm[w].ok++;
      if(r['Score 5']==='Sim'){wm[w].s5t++;if(r['Qualidade da Marcação']==='GPS OK')wm[w].s5ok++;}
    });
    weeklyData=Object.entries(wm).sort((a,b)=>+a[0]-+b[0]).map(([w,v])=>({
      w,label:WEEKLY_FULL.find(x=>x.w===w)?.label||`Semana ${w}`,
      meses:'',pct:v.t?+(v.ok/v.t*100).toFixed(1):null,pct_s5:v.s5t?+(v.s5ok/v.s5t*100).toFixed(1):null
    }));
  } else {
    weeklyData=[...WEEKLY_FULL];
  }
  const labels=weeklyData.map(w=>`Sem ${w.w}`);
  const genP=weeklyData.map(w=>w.pct);
  const s5P=weeklyData.map(w=>w.pct_s5);
  const ctx=document.getElementById('chartWeek').getContext('2d');
  if(weekInst)weekInst.destroy();
  weekInst=new Chart(ctx,{type:'line',
    data:{labels,datasets:[
      {label:'Score 5',data:s5P,borderColor:'#c47a1a',backgroundColor:'rgba(196,122,26,.04)',pointBackgroundColor:'#c47a1a',pointRadius:5,borderWidth:2.5,tension:.3,fill:false,spanGaps:true},
      {label:'Geral',data:genP,borderColor:'#1a2c52',backgroundColor:'rgba(26,44,82,.07)',pointBackgroundColor:'#1a2c52',pointRadius:5,borderWidth:2.5,tension:.3,fill:true,spanGaps:true},
    ]},
    options:{responsive:true,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:{backgroundColor:'#fff',titleColor:'#1a2340',bodyColor:'#5a6a8a',borderColor:'#e4e9f2',borderWidth:1,padding:8,
        callbacks:{
          title:([c])=>weeklyData[c.dataIndex]?.label||labels[c.dataIndex],
          label:c=>` ${c.dataset.label}: ${c.parsed.y!==null?c.parsed.y.toFixed(1)+'%':'—'}`
        }}},
      scales:{
        x:{grid:{color:'#f0f2f5'},ticks:{color:'#7a8aaa',font:{size:10}}},
        y:{...dynAxis([{data:genP},{data:s5P}]),grid:{color:'#f0f2f5'},ticks:{color:'#7a8aaa',font:{size:9},callback:v=>v+'%'}}
      }},
    plugins:[{id:'wL',afterDatasetsDraw(chart){
      const{ctx:c,data}=chart;
      data.datasets.forEach((ds,di)=>{
        const meta=chart.getDatasetMeta(di);const isS5=ds.label==='Score 5';
        meta.data.forEach((pt,i)=>{
          const v=ds.data[i];if(v===null||v===undefined)return;
          c.save();c.font='bold 9px Inter,sans-serif';c.fillStyle=isS5?'#c47a1a':'#1a2c52';c.textAlign='center';
          c.fillText(v.toFixed(1)+'%',pt.x,pt.y+(isS5?-12:13));c.restore();
        });
      });
    }}]
  });
}

// ── GEO CHART — barras horiz duplas, azul escuro (#1a2c52) e laranja (#c47a1a) ─
function buildGeoChart(){
  const gm={};
  fBase.forEach(r=>{const g=r['GEO Supervisor']||'Outros';
    if(!gm[g])gm[g]={t:0,ok:0,s5t:0,s5ok:0};
    gm[g].t++;if(r['Qualidade da Marcação']==='GPS OK')gm[g].ok++;
    if(r['Score 5']==='Sim'){gm[g].s5t++;if(r['Qualidade da Marcação']==='GPS OK')gm[g].s5ok++;}
  });
  const entries=Object.entries(gm).map(([g,v])=>{
    const pg=v.t?v.ok/v.t*100:0,ps=v.s5t?v.s5ok/v.s5t*100:0;
    return{g,pg:+pg.toFixed(1),ps:+ps.toFixed(1)};
  }).sort((a,b)=>b.pg-a.pg);
  const labels=entries.map(e=>e.g);
  const vG=entries.map(e=>e.pg),vS=entries.map(e=>e.ps);
  const ctx=document.getElementById('chartGeo').getContext('2d');
  if(geoInst)geoInst.destroy();
  geoInst=new Chart(ctx,{type:'bar',
    data:{labels,datasets:[
      {label:'Geral',data:vG,backgroundColor:'rgba(26,44,82,.82)',borderColor:'#1a2c52',borderWidth:1,borderRadius:3},
      {label:'Score 5',data:vS,backgroundColor:'rgba(196,122,26,.75)',borderColor:'#c47a1a',borderWidth:1,borderRadius:3},
    ]},
    options:{indexAxis:'y',responsive:true,
      plugins:{legend:{display:false},
        tooltip:{backgroundColor:'#fff',titleColor:'#1a2340',bodyColor:'#5a6a8a',borderColor:'#e4e9f2',borderWidth:1,padding:8,
          callbacks:{label:c=>` ${c.dataset.label}: ${c.parsed.x.toFixed(1)}%`}}},
      scales:{
        x:{...dynAxis([{data:vG},{data:vS}]),grid:{color:'#f0f2f5'},ticks:{color:'#7a8aaa',font:{size:9},callback:v=>v+'%'}},
        y:{grid:{display:false},ticks:{color:'#5a6a8a',font:{size:11,weight:'600'}}}
      }},
    plugins:[{id:'gL',afterDatasetsDraw(chart){
      const{ctx:c,data}=chart;
      const colors=['#1a2c52','#c47a1a'];
      data.datasets.forEach((ds,di)=>{
        const meta=chart.getDatasetMeta(di);
        meta.data.forEach((bar,i)=>{
          const v=ds.data[i];if(!v)return;
          c.save();c.font='bold 9px Inter,sans-serif';c.fillStyle=colors[di];c.textAlign='left';
          c.fillText(v.toFixed(1)+'%',bar.x+4,bar.y+4);c.restore();
        });
      });
    }}]
  });
}

// ── BAR CHART CDD/SUP ──────────────────────────────────────────────────────
function setTogCDD(v){togCDDType=v;document.querySelectorAll('#togCDD .tog-btn').forEach((b,i)=>b.classList.toggle('active',i===(v==='cdd'?0:1)));buildBarChart();}
function setTogCDDMode(v){togCDDMode=v;document.querySelectorAll('#togCDDMode .tog-btn').forEach((b,i)=>b.classList.toggle('active',i===(v==='geral'?0:1)));buildBarChart();}
function buildBarChart(){
  const key=togCDDType==='cdd'?'CDD':'Supervisor';
  const gm={};
  fBase.forEach(r=>{const k=r[key]||'Outros';
    if(!gm[k])gm[k]={t:0,ok:0,s5t:0,s5ok:0};
    gm[k].t++;if(r['Qualidade da Marcação']==='GPS OK')gm[k].ok++;
    if(r['Score 5']==='Sim'){gm[k].s5t++;if(r['Qualidade da Marcação']==='GPS OK')gm[k].s5ok++;}
  });
  const entries=Object.entries(gm).map(([k,v])=>{
    const pct=togCDDMode==='geral'?(v.t?v.ok/v.t*100:0):(v.s5t?v.s5ok/v.s5t*100:0);
    return{k,pct:+pct.toFixed(1)};
  }).sort((a,b)=>b.pct-a.pct);
  document.getElementById('barTitle').textContent=`% GPS OK por ${togCDDType==='cdd'?'CDD':'Supervisor'} — Maior para Menor`;
  const labels=entries.map(e=>e.k.replace('CDD ','')),vals=entries.map(e=>e.pct);
  function pctBg(v){return v>=95?'rgba(30,107,58,.82)':v>=90?'rgba(58,176,107,.82)':v>=80?'rgba(210,153,34,.82)':'rgba(184,50,50,.82)';}
  function pctC2(v){return v>=95?'#1e6b3a':v>=90?'#3ab06b':v>=80?'#d29922':'#b83232';}
  const bgC=vals.map(v=>pctBg(v)),bdC=vals.map(v=>pctC2(v));
  const ctx=document.getElementById('chartBar').getContext('2d');
  if(barInst)barInst.destroy();
  barInst=new Chart(ctx,{type:'bar',data:{labels,datasets:[{label:'% GPS OK',data:vals,backgroundColor:bgC,borderColor:bdC,borderWidth:1,borderRadius:3}]},
    options:{responsive:true,plugins:{legend:{display:false},tooltip:{backgroundColor:'#fff',titleColor:'#1a2340',bodyColor:'#5a6a8a',borderColor:'#e4e9f2',borderWidth:1,padding:8,
      callbacks:{label:c=>` % GPS OK: ${c.parsed.y.toFixed(1)}%`}}},
      scales:{x:{grid:{display:false},ticks:{color:'#7a8aaa',font:{size:8},maxRotation:35}},
              y:{...dynAxis([{data:vals}]),grid:{color:'#f0f2f5'},ticks:{color:'#7a8aaa',font:{size:9},callback:v=>v+'%'}}}},
    plugins:[{id:'bL',afterDatasetsDraw(chart){
      const{ctx:c,data}=chart;const meta=chart.getDatasetMeta(0);
      meta.data.forEach((bar,i)=>{const v=data.datasets[0].data[i];if(!v)return;
        c.save();c.font='bold 8px Inter,sans-serif';c.fillStyle=bdC[i];c.textAlign='center';
        c.fillText(v.toFixed(1)+'%',bar.x,bar.y-4);c.restore();
      });
    }}]
  });
}

// ── RESUMO TABLES ──────────────────────────────────────────────────────────
function buildResumeTables(){
  ['CDD','Supervisor'].forEach((key,ti)=>{
    const gm={};
    fBase.forEach(r=>{const k=r[key]||'Outros';
      if(!gm[k])gm[k]={t:0,ok:0,s5t:0,s5ok:0};
      gm[k].t++;if(r['Qualidade da Marcação']==='GPS OK')gm[k].ok++;
      if(r['Score 5']==='Sim'){gm[k].s5t++;if(r['Qualidade da Marcação']==='GPS OK')gm[k].s5ok++;}
    });
    const rows=Object.entries(gm).map(([k,v])=>{
      const pg=v.t?v.ok/v.t*100:0,ps=v.s5t?v.s5ok/v.s5t*100:0;
      const media=(pg+(v.s5t?ps:pg))/2;return{k,pg,ps,media,v};
    }).sort((a,b)=>b.media-a.media).map(({k,pg,ps,v})=>`<tr>
      <td>${k.replace('CDD ','')}</td>
      <td><span style="color:${pctC(pg)};font-weight:700">${pg.toFixed(1)}%</span></td>
      <td><span style="color:${pctC(ps)};font-weight:700">${v.s5t?ps.toFixed(1)+'%':'—'}</span></td></tr>`).join('');
    document.getElementById(ti===0?'tbl-r-cdd':'tbl-r-sup').innerHTML=
      `<thead><tr><th>${key}</th><th>GPS OK — Geral</th><th>GPS OK — Score 5</th></tr></thead><tbody>${rows}</tbody>`;
  });
}




// ── JORNADA ────────────────────────────────────────────────────────────────




// ══ ABA STATUS | PROMOTORES ══════════════════════════════════════════════
let stFiltData = [];
let stSelSems = new Set(SEMANAS_INFO.map(s=>s.num));

// Multi-select independente para aba Status

function buildSt2SemDD(){
  const dd=document.getElementById('ms-sem2-dd');
  if(!dd) return;
  dd.innerHTML=`<div class="ms-item"><label><input type="checkbox" id="ms-sem2-all" checked onchange="toggleAllSt2Sem(this.checked)"> Marcar/Desmarcar todos</label></div><div class="ms-sep"></div>`;
  SEMANAS_INFO.forEach(s=>dd.innerHTML+=`<div class="ms-item"><label><input type="checkbox" class="ms-sem2-cb" value="${s.num}" checked onchange="onSt2SemChange()"> ${s.label}</label></div>`);
}

function toggleAllSt2Sem(c){
  document.querySelectorAll('.ms-sem2-cb').forEach(cb=>{cb.checked=c;cb.closest('.ms-item').style.opacity='1';cb.closest('.ms-item').style.pointerEvents='';});
  stSelSems=c?new Set(SEMANAS_INFO.map(s=>s.num)):new Set();updateSt2SemBtn();filterStatusTab();
}

function onSt2SemChange(){
  stSelSems=new Set([...document.querySelectorAll('.ms-sem2-cb:checked')].map(c=>c.value));
  document.getElementById('ms-sem2-all').checked=stSelSems.size===SEMANAS_INFO.length;
  updateSt2SemBtn();filterStatusTab();
}
function resetSt2SemC(){document.querySelectorAll('.ms-sem2-cb').forEach(cb=>{cb.closest('.ms-item').style.opacity='1';cb.closest('.ms-item').style.pointerEvents='';cb.checked=true;});stSelSems=new Set(SEMANAS_INFO.map(s=>s.num));document.getElementById('ms-sem2-all').checked=true;updateSt2SemBtn();}

function clearStatusFilters(){
  document.querySelectorAll('.ms-sem2-cb').forEach(cb=>{cb.checked=true;cb.closest('.ms-item').style.opacity='1';cb.closest('.ms-item').style.pointerEvents='';});
  const a2=document.getElementById('ms-sem2-all');if(a2)a2.checked=true;
  stSelSems=new Set(SEMANAS_INFO.map(s=>s.num));
  updateSt2SemBtn();
  document.getElementById('st2-sup').value='';
  const cs=document.getElementById('st2-cdd');cs.innerHTML='<option value="">Todos</option>';
  CDDS_ALL.forEach(c=>cs.innerHTML+=`<option value="${c}">${c}</option>`);
  document.getElementById('st2-srch').value='';
  filterStatusTab();
}

function getStDates(){
  // Sempre retorna TODAS as datas — colunas fixas independente do filtro mês/semana
  return STATUS_DATES;
}
function getStActiveDates(){
  // Datas ativas: filtradas apenas por semana (filtro de mês removido)
  const allS=stSelSems.size===0||stSelSems.size===SEMANAS_INFO.length;
  if(allS) return STATUS_DATES;
  return STATUS_DATES.filter(d=>{
    for(const p of STATUS_DATA){
      const day=p.days[d]; if(!day) continue;
      if(!allS&&!stSelSems.has(day.week)) return false;
      return true;
    }
    return true;
  });
}


function updateSt2SemBtn(){
  const n=stSelSems.size, t=SEMANAS_INFO.length;
  const el=document.getElementById('ms-sem2-btn');
  if(el) el.innerHTML=n===0?'Nenhuma ▾':n===t?'Todas ▾':`${n} sel. ▾`;
}

function onSt2SupChange(){
  const sv=document.getElementById('st2-sup').value;
  const cs=document.getElementById('st2-cdd');
  const cur=cs.value;
  cs.innerHTML='<option value="">Todos</option>';
  const cdds=sv?(SUP_CDD_MAP[sv]||[]).sort():CDDS_ALL;
  cdds.forEach(c=>cs.innerHTML+=`<option value="${c}">${c}</option>`);
  if(cdds.includes(cur)) cs.value=cur;
  filterStatusTab();
}

function filterStatusTab(){
  const q   =(document.getElementById('st2-srch')||{value:''}).value.toLowerCase();
  const sup =(document.getElementById('st2-sup')||{value:''}).value;
  const cdd =(document.getElementById('st2-cdd')||{value:''}).value;
  const dates = getStDates();

  // Datas ativas (afetadas por mês/semana) — usadas para filtrar promotores e calcular %
  const activeDates = getStActiveDates();
  const allDates    = STATUS_DATES; // colunas sempre fixas

  // Filtrar promotores
  let filtered = STATUS_DATA.filter(p=>{
    if(sup && p.sup!==sup) return false;
    if(cdd && p.cdd!==cdd) return false;
    if(q && !p.nome.toLowerCase().includes(q) && !(p.cdd||'').toLowerCase().includes(q)) return false;
    // Incluir só se tem pelo menos 1 marcação nas datas ativas (filtro mês/semana)
    if(activeDates.length < STATUS_DATES.length && !activeDates.some(d=>p.days[d])) return false;
    return true;
  });

  // Calcular % total nas datas ATIVAS e ordenar
  filtered = filtered.map(p=>{
    let tot=0,tok=0;
    activeDates.forEach(d=>{const day=p.days[d];if(day){tot+=day.total;tok+=day.ok;}});
    return {...p, _tot:tot, _tok:tok, _pct: tot?+(tok/tot*100).toFixed(1):null};
  }).sort((a,b)=>{
    // 1. Supervisor
    const sA=a.sup||'', sB=b.sup||'';
    if(sA!==sB) return sA.localeCompare(sB);
    // 2. CDD
    const cA=a.cdd||'', cB=b.cdd||'';
    if(cA!==cB) return cA.localeCompare(cB);
    // 3. % Total: maior primeiro (null vai para o fim)
    if(a._pct===null && b._pct===null) return 0;
    if(a._pct===null) return 1;
    if(b._pct===null) return -1;
    return b._pct - a._pct;
  });

  stFiltData = filtered;
  renderStatusTab(STATUS_DATES);
}

function totClass(pct){
  if(pct===null) return 'd-tna';
  if(pct>=95) return 'd-t95';
  if(pct>=90) return 'd-t90';
  if(pct>=80) return 'd-t80';
  return 'd-tbad';
}

function renderStatusTab(dates){
  // Colunas fixas SEMPRE — datas inativas ficam com display:none via colgroup
  const activeDtsSet = new Set(getStActiveDates());
  const hasFilt = activeDtsSet.size < STATUS_DATES.length;

  const total=stFiltData.length;
  const cntEl=document.getElementById('st2-cnt');
  if(cntEl) cntEl.textContent=total+' promotores';

  // colgroup: define largura fixa para cada coluna — nunca muda
  const colgroup=`<colgroup>
    <col style="width:88px;min-width:88px">
    <col style="width:98px;min-width:98px">
    <col style="width:165px;min-width:165px">
    <col style="width:92px;min-width:92px">
    <col style="width:54px;min-width:54px">
    ${STATUS_DATES.map(d=>`<col data-d="${d}" style="width:44px;min-width:44px;${hasFilt&&!activeDtsSet.has(d)?'display:none':''}">`).join('')}
  </colgroup>`;

  const stickyTh=(label,left,w,extra='')=>
    `<th style="position:sticky;top:0;left:${left}px;z-index:4;background:#f6f8fc;width:${w}px;min-width:${w}px;max-width:${w}px;white-space:nowrap;overflow:hidden;${extra}">${label}</th>`;

  const thead=`<thead><tr>
    ${stickyTh('Supervisor',0,88)}
    ${stickyTh('CDD',88,98)}
    ${stickyTh('Nome',88+98,165)}
    ${stickyTh('Status',88+98+165,92)}
    ${stickyTh('%&nbsp;Total',88+98+165+92,54,'background:#eef2fb;border-left:2px solid #b8cce8;z-index:4')}
    ${STATUS_DATES.map(d=>{
      const hidden=hasFilt&&!activeDtsSet.has(d);
      return `<th class="c" style="position:sticky;top:0;z-index:2;background:#f6f8fc;width:44px;min-width:44px;max-width:44px;${hidden?'display:none':''}">
        ${hidden?'':d}</th>`;
    }).join('')}
  </tr></thead>`;

  // Renderizar todas as linhas
  let rows='';
  let prevSup=null,prevCdd=null;

  stFiltData.forEach((p,i)=>{
    const totPct=p._pct;
    const newGroup=p.sup!==prevSup||p.cdd!==prevCdd;

    if(newGroup && i>0){
      rows+=`<tr><td colspan="${5+STATUS_DATES.length}" style="height:4px;background:#eef0f3;border:none;padding:0"></td></tr>`;
    }

    const bg='#fff';
    const supCell=newGroup
      ?`<td style="position:sticky;left:0;background:${bg};font-weight:700;color:#1a2c52;font-size:10px;vertical-align:top;padding-top:3px;overflow:hidden;text-overflow:ellipsis">${p.super||p.sup||'—'}</td>`
      :`<td style="position:sticky;left:0;background:${bg}"></td>`;
    const cddCell=newGroup
      ?`<td style="position:sticky;left:88px;background:${bg};font-weight:600;font-size:10px;vertical-align:top;padding-top:3px;overflow:hidden;text-overflow:ellipsis">${(p.cdd||'').replace('CDD ','')}</td>`
      :`<td style="position:sticky;left:88px;background:${bg}"></td>`;

    prevSup=p.sup; prevCdd=p.cdd;

    const totalCell=`<td class="d-total ${totClass(totPct)}" style="position:sticky;left:443px;z-index:1">
      ${totPct!==null?`<span style="font-size:11px;font-weight:700">${totPct.toFixed(1)}%</span>`:'—'}
    </td>`;

    const dayCells=STATUS_DATES.map(d=>{
      const hidden=hasFilt&&!activeDtsSet.has(d);
      if(hidden) return `<td style="display:none"></td>`;
      const day=p.days[d];
      if(!day) return `<td class="d-none" style="font-size:10px;width:44px">NP</td>`;
      const cls=day.pct>=95?'d-ok':day.pct>=80?'d-warn':'d-bad';
      return `<td class="${cls}" style="font-size:10px;width:44px">${day.pct.toFixed(0)}%</td>`;
    }).join('');

    rows+=`<tr>
      ${supCell}
      ${cddCell}
      <td style="position:sticky;left:186px;background:${bg};font-size:11px;font-weight:500;overflow:hidden;text-overflow:ellipsis">${p.nome}</td>
      <td style="position:sticky;left:351px;background:${bg}">${sitBadge(p.sit)}</td>
      ${totalCell}
      ${dayCells}
    </tr>`;
  });

  const tbl=document.getElementById('tbl-status2');
  if(tbl) tbl.innerHTML=colgroup+thead+`<tbody>${rows}</tbody>`;
  // Sem paginação
  const pg=document.getElementById('pg-status2');
  if(pg) pg.innerHTML='';
}
// ══ FIM ABA STATUS ════════════════════════════════════════════════════════


// ══ ABA JORNADA ══════════════════════════════════════════════════════════
let jrFiltData = [];
let jrSelSems  = new Set(SEMANAS_INFO.map(s=>s.num));

function buildJrSemDD(){
  const dd=document.getElementById('ms-semJ-dd');
  if(!dd) return;
  dd.innerHTML=`<div class="ms-item"><label><input type="checkbox" id="ms-semJ-all" checked onchange="toggleAllJrSem(this.checked)"> Marcar/Desmarcar todos</label></div><div class="ms-sep"></div>`;
  SEMANAS_INFO.forEach(s=>dd.innerHTML+=`<div class="ms-item"><label><input type="checkbox" class="ms-semJ-cb" value="${s.num}" checked onchange="onJrSemChange()"> ${s.label}</label></div>`);
}
function toggleAllJrSem(c){
  document.querySelectorAll('.ms-semJ-cb').forEach(cb=>{cb.checked=c;cb.closest('.ms-item').style.opacity='1';cb.closest('.ms-item').style.pointerEvents='';});
  jrSelSems=c?new Set(SEMANAS_INFO.map(s=>s.num)):new Set();updateJrSemBtn();filterJornada();
}
function onJrSemChange(){
  jrSelSems=new Set([...document.querySelectorAll('.ms-semJ-cb:checked')].map(c=>c.value));
  document.getElementById('ms-semJ-all').checked=jrSelSems.size===SEMANAS_INFO.length;
  updateJrSemBtn();filterJornada();
}
function updateJrSemBtn(){
  const n=jrSelSems.size,t=SEMANAS_INFO.length;
  const el=document.getElementById('ms-semJ-btn');
  if(el) el.innerHTML=n===0?'Nenhuma ▾':n===t?'Todas ▾':`${n} sel. ▾`;
}
function onJrSupChange(){
  const sv=document.getElementById('jr-sup').value;
  const cs=document.getElementById('jr-cdd');const cur=cs.value;
  cs.innerHTML='<option value="">Todos</option>';
  const cdds=sv?(SUP_CDD_MAP[sv]||[]).sort():CDDS_ALL;
  cdds.forEach(c=>cs.innerHTML+=`<option value="${c}">${c}</option>`);
  if(cdds.includes(cur)) cs.value=cur;
  filterJornada();
}
function clearJornadaFilters(){
  document.querySelectorAll('.ms-semJ-cb').forEach(cb=>{cb.checked=true;cb.closest('.ms-item').style.opacity='1';cb.closest('.ms-item').style.pointerEvents='';});
  const a=document.getElementById('ms-semJ-all');if(a)a.checked=true;
  jrSelSems=new Set(SEMANAS_INFO.map(s=>s.num));updateJrSemBtn();
  document.getElementById('jr-sup').value='';
  const cs=document.getElementById('jr-cdd');cs.innerHTML='<option value="">Todos</option>';
  CDDS_ALL.forEach(c=>cs.innerHTML+=`<option value="${c}">${c}</option>`);
  document.getElementById('jr-srch').value='';
  filterJornada();
}
function getJrActiveDates(){
  const allS=jrSelSems.size===0||jrSelSems.size===SEMANAS_INFO.length;
  if(allS) return JORNADA_DATES;
  return JORNADA_DATES.filter(d=>{
    for(const p of JORNADA_DATA){ const day=p.days[d]; if(!day) continue;
      if(!jrSelSems.has(day.week)) return false; return true; }
    return true;
  });
}
function filterJornada(){
  const q  =(document.getElementById('jr-srch')||{value:''}).value.toLowerCase();
  const sup=(document.getElementById('jr-sup')||{value:''}).value;
  const cdd=(document.getElementById('jr-cdd')||{value:''}).value;
  const activeDates=getJrActiveDates();
  const allS=activeDates.length===JORNADA_DATES.length;
  jrFiltData=JORNADA_DATA.filter(p=>{
    if(sup&&p.sup!==sup) return false;
    if(cdd&&p.cdd!==cdd) return false;
    if(q&&!p.nome.toLowerCase().includes(q)&&!(p.cdd||'').toLowerCase().includes(q)) return false;
    if(!allS&&!activeDates.some(d=>p.days[d])) return false;
    return true;
  });
  renderJornada();
}
function renderJornada(){
  const activeDtsSet=new Set(getJrActiveDates());
  const hasFilt=activeDtsSet.size<JORNADA_DATES.length;
  const total=jrFiltData.length;
  const cntEl=document.getElementById('cnt-jornada');
  if(cntEl) cntEl.textContent=total+' promotores';

  // Larguras fixas — igual ao padrão da aba Status
  const W={sup:88,cdd:98,nome:165,sit:92,avg:58,day:58};
  const leftCdd=W.sup, leftNome=W.sup+W.cdd, leftSit=W.sup+W.cdd+W.nome, leftAvg=W.sup+W.cdd+W.nome+W.sit;

  // colgroup
  const colgroup=`<colgroup>
    <col style="width:${W.sup}px;min-width:${W.sup}px">
    <col style="width:${W.cdd}px;min-width:${W.cdd}px">
    <col style="width:${W.nome}px;min-width:${W.nome}px">
    <col style="width:${W.sit}px;min-width:${W.sit}px">
    <col style="width:${W.avg}px;min-width:${W.avg}px">
    ${JORNADA_DATES.map(d=>`<col data-d="${d}" style="width:${W.day}px;min-width:${W.day}px;${hasFilt&&!activeDtsSet.has(d)?'display:none':''}">`).join('')}
  </colgroup>`;

  const stickyTh=(label,left,w,extra='')=>
    `<th style="position:sticky;top:0;left:${left}px;z-index:4;background:#f6f8fc;width:${w}px;min-width:${w}px;max-width:${w}px;white-space:nowrap;overflow:hidden;${extra}">${label}</th>`;

  const thead=`<thead><tr>
    ${stickyTh('Supervisor',0,W.sup)}
    ${stickyTh('CDD',leftCdd,W.cdd)}
    ${stickyTh('Nome',leftNome,W.nome)}
    ${stickyTh('Status',leftSit,W.sit)}
    ${stickyTh('Média',leftAvg,W.avg,'background:#eef2fb;border-left:2px solid #b8cce8;z-index:4;text-align:center')}
    ${JORNADA_DATES.map(d=>{
      const hidden=hasFilt&&!activeDtsSet.has(d);
      return `<th class="c" style="position:sticky;top:0;z-index:2;background:#f6f8fc;width:${W.day}px;min-width:${W.day}px;max-width:${W.day}px;${hidden?'display:none':''}">${hidden?'':d}</th>`;
    }).join('')}
  </tr></thead>`;

  let rows=''; let prevSup=null,prevCdd=null;

  jrFiltData.forEach((p,i)=>{
    const newGroup=p.sup!==prevSup||p.cdd!==prevCdd;
    if(newGroup&&i>0){
      rows+=`<tr><td colspan="${5+JORNADA_DATES.length}" style="height:4px;background:#eef0f3;border:none;padding:0"></td></tr>`;
    }
    const bg='#fff';
    const supCell=newGroup
      ?`<td style="position:sticky;left:0;background:${bg};font-weight:700;color:#1a2c52;font-size:10px;vertical-align:top;padding-top:3px;overflow:hidden;text-overflow:ellipsis">${p.super||p.sup||'—'}</td>`
      :`<td style="position:sticky;left:0;background:${bg}"></td>`;
    const cddCell=newGroup
      ?`<td style="position:sticky;left:${leftCdd}px;background:${bg};font-weight:600;font-size:10px;vertical-align:top;padding-top:3px;overflow:hidden;text-overflow:ellipsis">${(p.cdd||'').replace('CDD ','')}</td>`
      :`<td style="position:sticky;left:${leftCdd}px;background:${bg}"></td>`;
    prevSup=p.sup; prevCdd=p.cdd;

    // Calcular média nas datas ativas
    function toMin(t){if(!t)return null;try{const[h,m]=t.split(':');return+h*60+ +m;}catch{return null;}}
    function fmtDur(m){if(!m||m<=0)return'';return`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;}
    const durs=[...activeDtsSet].map(d=>p.days[d]?.dur).filter(Boolean).map(toMin).filter(v=>v&&v>0);
    const avgMin=durs.length?Math.round(durs.reduce((a,b)=>a+b,0)/durs.length):null;
    const avgStr=fmtDur(avgMin);

    // Farol de cores: >4h=verde escuro, 3h30-4h=verde claro, 3h-3h30=amarelo, <3h=vermelho
    function jrColor(m){
      if(m===null||m===undefined) return {bg:'#eef2fb',cl:'#7a8aaa'};
      if(m>=240) return {bg:'#1e6b3a',cl:'#fff'};
      if(m>=210) return {bg:'#3ab06b',cl:'#fff'};
      if(m>=180) return {bg:'#fff3cd',cl:'#7a5000'};
      return           {bg:'#f8d7da',cl:'#842029'};
    }
    const jrC=jrColor(avgMin);
    const avgCell=`<td style="position:sticky;left:${leftAvg}px;background:${jrC.bg};text-align:center;font-weight:700;color:${jrC.cl};font-size:11px;border-left:2px solid #b8cce8;z-index:1">${avgStr||'—'}</td>`;

    const dayCells=JORNADA_DATES.map(d=>{
      const hidden=hasFilt&&!activeDtsSet.has(d);
      if(hidden) return `<td style="display:none"></td>`;
      const day=p.days[d];
      if(!day) return `<td class="d-none" style="font-size:10px;text-align:center">NP</td>`;
      return `<td style="text-align:center;font-size:10px;color:#1a2340;font-weight:500">${day.dur||'—'}</td>`;
    }).join('');

    rows+=`<tr>
      ${supCell}${cddCell}
      <td style="position:sticky;left:${leftNome}px;background:${bg};font-size:11px;font-weight:500;overflow:hidden;text-overflow:ellipsis">${p.nome}</td>
      <td style="position:sticky;left:${leftSit}px;background:${bg}">${sitBadge(p.sit)}</td>
      ${avgCell}${dayCells}
    </tr>`;
  });

  const tbl=document.getElementById('tbl-jornada');
  if(tbl) tbl.innerHTML=colgroup+thead+`<tbody>${rows}</tbody>`;
}
// ══ FIM ABA JORNADA ═══════════════════════════════════════════════════════

// ── PAGINATION ─────────────────────────────────────────────────────────────
function renderPag(id,cur,total,cb,count,per){
  const el=document.getElementById(id);
  if(total<=1){el.innerHTML='';return;}
  const from=(cur-1)*per+1,to=Math.min(cur*per,count);
  const show=new Set([1,total,cur-1,cur,cur+1].filter(p=>p>=1&&p<=total));
  let btns='',prev=0;
  [...show].sort((a,b)=>a-b).forEach(p=>{
    if(prev&&p-prev>1)btns+=`<span style="color:#7a8aaa;padding:0 2px">…</span>`;
    btns+=`<button class="pg-btn${p===cur?' active':''}" onclick="(${cb})(${p})">${p}</button>`;
    prev=p;
  });
  el.innerHTML=`<span class="pg-info">${from}–${to} de ${count.toLocaleString('pt-BR')}</span>
    <div class="pg-btns"><button class="pg-btn" onclick="(${cb})(${cur-1})" ${cur<=1?'disabled':''}>‹</button>${btns}<button class="pg-btn" onclick="(${cb})(${cur+1})" ${cur>=total?'disabled':''}>›</button></div>`;
}

// ── INIT ───────────────────────────────────────────────────────────────────
(function init(){
  buildMesDD();buildSemDD();
  const ss=document.getElementById('f-sup');SUPERVISORES_ALL.sort().forEach(s=>ss.innerHTML+=`<option value="${s}">${s}</option>`);
  const sc=document.getElementById('f-cdd');CDDS_ALL.forEach(c=>sc.innerHTML+=`<option value="${c}">${c}</option>`);
  // Jornada
  buildJrSemDD();
  SUPERVISORES_ALL.sort().forEach(s=>{const el=document.getElementById('jr-sup');if(el)el.innerHTML+=`<option value="${s}">${s}</option>`;});
  CDDS_ALL.forEach(c=>{const el=document.getElementById('jr-cdd');if(el)el.innerHTML+=`<option value="${c}">${c}</option>`;});
  buildCards();buildLineChart();buildGeoChart();buildWeekChart();buildBarChart();buildResumeTables();
  renderJornada();
  // Status tab init
  // Status tab: popular filtros e inicializar
  buildSt2SemDD();
  SUPERVISORES_ALL.sort().forEach(s=>{const el=document.getElementById('st2-sup');if(el)el.innerHTML+=`<option value="${s}">${s}</option>`;});
  CDDS_ALL.forEach(c=>{const el=document.getElementById('st2-cdd');if(el)el.innerHTML+=`<option value="${c}">${c}</option>`;});
  filterJornada();
  filterStatusTab();
})();
