// Painel administrativo (3 abas: Parceiros, Comunicação, Eventos).
// A segurança real é feita pelo banco (RLS em schema.sql); as checagens aqui são só de interface.
// Depende de globais do index.html: sb, P, EV, AG, REC, CARD, DIAS, CATS, view, cur, load, render, day, iso, pd, br, addD.
const EMOJIS=['🍔','🍕','🌭','🌮','🥟','🥞','🍢','🍗','🍟','🍝','🍜','🍣','🥪','🥩','🍦','🍩','🍪','🧁','🍰','🍮','🍫','🍬','🍿','🌽','🧀','🥖','🍺','🍻','🍹','🍸','🥤','🧃','☕','🍇','🥥','🍍'];
const S={user:null,admin:false,tab:'parc',eP:null,eE:null,vd:'',vc:'',vsent:new Set(),hp:null,hr:90};
const ST=['Ativo','Confirmado','Pendente Confirmação','Cancelado','Substituído','Faltou'],OKS=['Ativo','Confirmado','Pendente Confirmação'];
const $=id=>document.getElementById(id);
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ok=r=>{if(r.error){alert(r.error.message);throw r.error}return r};
const refresh=async()=>{await load();render()};
// Se uma etapa passar de 20s, avisa qual foi em vez de ficar "Salvando…" para sempre.
const T=(label,p)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>{const e=new Error('Travou na etapa: '+label+'. Recarregue a página, entre de novo e confira se o parceiro já foi criado antes de tentar outra vez.');e.timeout=true;rej(e)},20000))]);
const horizonte=()=>iso(addD(new Date(),120));
const wa=t=>{t=String(t||'').replace(/\D/g,'');return t&&t.length<=11?'55'+t:t};
const opts=(a,sel)=>a.map(x=>`<option ${x===sel?'selected':''}>${x}</option>`).join('');
const fld=(l,h)=>`<label style="display:flex;flex-direction:column;font-size:.8rem;gap:2px;flex:1;min-width:150px">${l}${h}</label>`;

/* ---------- login ---------- */
const login=()=>{try{sessionStorage.setItem('goAdm','1')}catch(e){}
 return sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}})};
const logout=async()=>{await sb.auth.signOut();S.user=null;S.admin=false;view='hoje';await load();render()};
async function setUser(s){const u=s&&s.user;S.user=u||null;S.admin=!!u&&u.email.toLowerCase()===ADMIN_EMAIL;
 if(u&&!S.admin){alert('Acesso negado: Usuário não autorizado como administrador');await sb.auth.signOut();S.user=null;view='hoje'}
 try{if(S.admin&&sessionStorage.getItem('goAdm')){sessionStorage.removeItem('goAdm');view='adm'}}catch(e){}}

/* ---------- upload ---------- */
function squeeze(f){return new Promise(r=>{
 if(f.size>10e6){alert(f.name+' passa de 10MB');return r(null)}
 if(!f.type.startsWith('image/'))return r(f);
 const i=new Image();i.onload=()=>{const k=Math.min(1,1600/Math.max(i.width,i.height)),c=document.createElement('canvas');
  c.width=i.width*k;c.height=i.height*k;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(i,0,0,c.width,c.height);
  c.toBlob(b=>r(new File([b],f.name.replace(/\.\w+$/,'')+'.jpg',{type:'image/jpeg'})),'image/jpeg',.82)};
 i.onerror=()=>{alert('Imagem inválida: '+f.name);r(null)};i.src=URL.createObjectURL(f)})}
async function up(file,pasta){const nome=pasta+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,6)+'-'+file.name.replace(/[^\w.]/g,'_');
 ok(await sb.storage.from('midia').upload(nome,file));return sb.storage.from('midia').getPublicUrl(nome).data.publicUrl}
async function addCards(id,files,ini){let o=ini;for(const f of files){const s=await squeeze(f);if(!s)continue;
 ok(await sb.from('cardapios_parceiro').insert({parceiro_id:id,cardapio_url:await up(s,'cardapios'),ordem:o++}))}}

/* ---------- abas ---------- */
const setTab=t=>{S.tab=t;render()};
const pickP=v=>{S.eP=v?+v:null;render()};
const setE=id=>{S.eE=id;render();window.scrollTo(0,0)};

/* ---------- 1 e 2: parceiros (cadastro + edição) ---------- */
function cardList(id){const L=CARD[id]||[];
 return L.length?L.map((c,i)=>`<div class="row"><span>${/\.pdf$/i.test(c.cardapio_url)?'📄 PDF':`<img src="${c.cardapio_url}" alt="" style="height:44px;border-radius:4px;vertical-align:middle">`} #${i+1}</span><button class="btn" onclick="mvC(${id},${c.id},-1)">↑</button><button class="btn" onclick="mvC(${id},${c.id},1)">↓</button><button class="btn" onclick="delC(${c.id})">Remover</button></div>`).join(''):'<small>Nenhum cardápio enviado.</small>'}
const reloadCards=async()=>{await load();const e=$('cardlist');if(e)e.innerHTML=cardList(S.eP)};
async function delC(id){if(!confirm('Remover este cardápio?'))return;ok(await sb.from('cardapios_parceiro').delete().eq('id',id));reloadCards()}
async function mvC(pid,id,dir){const l=CARD[pid]||[],i=l.findIndex(x=>x.id===id),j=i+dir;if(j<0||j>=l.length)return;
 ok(await sb.from('cardapios_parceiro').update({ordem:l[j].ordem}).eq('id',l[i].id));
 ok(await sb.from('cardapios_parceiro').update({ordem:l[i].ordem}).eq('id',l[j].id));reloadCards()}

function datesOf(r,ate){if(!r.recorrente)return r.data_especifica?[r.data_especifica]:[];if(!r.inicio_recorrencia)return[];
 const step={semanal:7,quinzenal:14,mensal:28}[r.periodicidade],want=DIAS.indexOf(r.dia_semana);
 let d=pd(r.inicio_recorrencia);d=addD(d,(want-d.getDay()+7)%7);
 const end=pd(r.fim_recorrencia&&r.fim_recorrencia<ate?r.fim_recorrencia:ate),o=[];
 for(;d<=end;d=addD(d,step))o.push(iso(d));return o}
const prevHTML=r=>{const l=datesOf(r,horizonte()),ex=new Set(AG.filter(x=>x.parceiro_id===S.eP).map(x=>x.data)),nv=l.filter(x=>!ex.has(x));
 return l.length?`<small>Serão adicionadas ${nv.length} data(s)${l.length>nv.length?` (${l.length-nv.length} já existem e serão ignoradas)`:''}: ${nv.slice(0,12).map(x=>br(pd(x))).join(', ')}${nv.length>12?'…':''}</small>`:'<small>Nenhuma data a adicionar.</small>'};
function prevR(){const rec=$('r_rec').checked;
 $('rec_on').style.display=rec?'':'none';$('rec_off').style.display=rec?'none':'';
 $('prev').innerHTML=prevHTML(rec?{recorrente:true,periodicidade:$('r_per').value,dia_semana:$('r_dia').value,inicio_recorrencia:$('r_i').value,fim_recorrencia:$('r_f').value||null}
  :{recorrente:false,data_especifica:$('r_e').value})}

function parcForm(){
 const p=P.find(x=>x.id===S.eP)||{},r={recorrente:true},v=x=>E(x??''),rec=r.recorrente!==false;
 return `<div class="bar"><select onchange="pickP(this.value)"><option value="">➕ Novo parceiro</option>${CATS.map(c=>P.some(x=>x.c===c)?`<optgroup label="${c}">${P.filter(x=>x.c===c).map(x=>`<option value="${x.id}" ${x.id===S.eP?'selected':''}>${E(x.n)}</option>`).join('')}</optgroup>`:'').join('')}</select></div>
<h2>${S.eP?'Editar parceiro':'Novo parceiro'}</h2>
<div class="bar">${fld('Nome da operação',`<input id="f_n" value="${v(p.n)}">`)}${fld('Tipo',`<select id="f_c">${opts(CATS,p.c)}</select>`)}${fld('Culinária',`<input id="f_k" value="${v(p.k)}">`)}</div>
<div class="bar">${fld('Nome do responsável',`<input id="f_r" value="${v(p.r)}">`)}${fld('Contato (WhatsApp com DDD)',`<input id="f_t" value="${v(p.t)}" placeholder="19999999999">`)}</div>
<div class="bar">${fld('Ícone (emoji) do parceiro — aparece na mensagem e nos calendários',`<input id="f_e" maxlength="8" value="${v(p.em)}" placeholder="vazio = ícone da categoria" style="font-size:1.3rem">`)}</div>
<div class="bar" style="gap:4px">${EMOJIS.map(e=>`<button type="button" class="btn" style="padding:4px 8px;font-size:1.2rem" onclick="$('f_e').value='${e}'">${e}</button>`).join('')}</div>
<div class="bar">${fld('Logo '+(p.logo?`(atual abaixo; enviar outra substitui)`:''),`<input type="file" id="f_logo" accept="image/*">`)}${p.logo?`<img src="${p.logo}" alt="" style="height:44px;border-radius:6px">`:''}</div>
${S.eP?`<div><b>Cardápios atuais</b><div id="cardlist">${cardList(S.eP)}</div></div>`:''}
<div class="bar">${fld('Adicionar cardápios (várias imagens ou PDF)',`<input type="file" id="f_cards" multiple accept="image/*,.pdf">`)}</div>
<h2>Adicionar datas à escala</h2><small>Preencha para <b>acrescentar</b> datas. As datas já agendadas não são alteradas (para removê-las, use "Datas agendadas" abaixo). Deixe em branco para salvar só os dados do parceiro.</small>
<div class="bar"><label><input type="checkbox" id="r_rec" ${rec?'checked':''} onchange="prevR()"> Recorrente</label></div>
<div id="rec_on" style="display:${rec?'':'none'}" onchange="prevR()"><div class="bar">${fld('Periodicidade',`<select id="r_per">${opts(['semanal','quinzenal','mensal'],r.periodicidade)}</select>`)}${fld('Dia da semana',`<select id="r_dia">${opts(DIAS,r.dia_semana)}</select>`)}</div>
<div class="bar">${fld('Início da recorrência',`<input type="date" id="r_i" value="${v(r.inicio_recorrencia)}">`)}${fld('Fim da recorrência (opcional)',`<input type="date" id="r_f" value="${v(r.fim_recorrencia)}">`)}</div></div>
<div id="rec_off" style="display:${rec?'none':''}" onchange="prevR()"><div class="bar">${fld('Data pontual',`<input type="date" id="r_e" value="${v(r.data_especifica)}">`)}</div></div>
<div id="prev">${prevHTML(r)}</div>
${S.eP?`<h2>Datas agendadas</h2><div id="datelist">${dateList(S.eP)}</div>`:''}
<div class="bar" style="margin-top:12px"><button class="btn pri" id="btnP" onclick="saveP()">Salvar</button>${S.eP?`<button class="btn" onclick="pickP('')">Cancelar edição</button><button class="btn" onclick="delP(${S.eP})">Excluir parceiro</button>`:''}</div>`}

/* ---------- datas agendadas do parceiro (seleção e exclusão) ---------- */
function dateList(id){const l=AG.filter(x=>x.parceiro_id===id).sort((p,q)=>p.data<q.data?-1:p.data>q.data?1:0),hj=iso(new Date());
 if(!l.length)return '<small>Nenhuma data agendada.</small>';
 return `<label><input type="checkbox" onchange="document.querySelectorAll('.ag_sel').forEach(c=>c.checked=this.checked)"> <b>Selecionar todas (${l.length})</b></label>
<div style="max-height:260px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:6px;margin:6px 0">`
 +l.map(x=>`<label style="display:block;padding:2px 0;${x.data<hj?'opacity:.55':''}"><input type="checkbox" class="ag_sel" value="${x.id}"> ${DIAS[pd(x.data).getDay()]} ${br(pd(x.data))}${x.status!=='Ativo'?` <small>(${E(x.status)})</small>`:''}${x.data<hj?' <small>(passada)</small>':''}</label>`).join('')
 +`</div><button class="btn" onclick="delDates()">Excluir datas selecionadas</button>`}
const reloadDates=async()=>{await load();const e=$('datelist');if(e)e.innerHTML=dateList(S.eP)};
async function delDates(){const ids=[...document.querySelectorAll('.ag_sel:checked')].map(x=>+x.value);
 if(!ids.length){alert('Selecione ao menos uma data.');return}
 if(!confirm(`Excluir ${ids.length} data(s) da agenda deste parceiro?`))return;
 try{const r=ok(await T('excluir datas',sb.from('agenda_gerada').delete().in('id',ids).select()));
  if(r.data.length!==ids.length)alert(`Atenção: só ${r.data.length} de ${ids.length} datas foram excluídas.`);
  await reloadDates()}catch(e){console.error(e);if(e&&e.timeout)alert(e.message)}}

function ruleForm(){
 if($('r_rec').checked){const i=$('r_i').value,f=$('r_f').value;
  if(!i){if(f){alert('Informe a data de início da recorrência.');return false}return null}
  if(f&&f<i){alert('A data fim é anterior ao início.');return false}
  return{recorrente:true,periodicidade:$('r_per').value,dia_semana:$('r_dia').value,inicio_recorrencia:i,fim_recorrencia:f||null,data_especifica:null}}
 const e=$('r_e').value;
 return e?{recorrente:false,periodicidade:null,dia_semana:null,inicio_recorrencia:null,fim_recorrencia:null,data_especifica:e}:null}

// Apenas ACRESCENTA datas: grava a nova regra e insere só as datas novas dela.
// Não usa gerar_agenda() para não ressuscitar datas que você excluiu de outras regras.
async function saveRule(pid,rule){if(!rule)return 0;
 const dates=datesOf(rule,horizonte());
 if(!dates.length){alert('A escala informada não gerou nenhuma data. Confira início, fim e dia da semana.');return 0}
 const ex=new Set(AG.filter(x=>x.parceiro_id===pid).map(x=>x.data)),novas=dates.filter(d=>!ex.has(d));
 if(!novas.length)return 0;
 const rr=ok(await sb.from('recorrencias_parceiro').insert({...rule,parceiro_id:pid}).select().single()).data;
 ok(await sb.from('agenda_gerada').upsert(novas.map(d=>({parceiro_id:pid,recorrencia_id:rr.id,data:d})),{onConflict:'parceiro_id,data',ignoreDuplicates:true}));
 return novas.length}

async function saveP(){const b=$('btnP');
 try{const g=id=>$(id).value.trim();
  if(!g('f_n')||!g('f_k')){alert('Informe nome da operação e culinária.');return}
  const rule=ruleForm();if(rule===false)return;
  b.disabled=true;b.textContent='Salvando…';
  const row={nome_operacao:g('f_n'),categoria:$('f_c').value,culinaria:g('f_k'),nome_responsavel:g('f_r')||null,contato_responsavel:g('f_t').replace(/\D/g,'')||null,emoji:g('f_e')||null};
  const lf=$('f_logo').files[0];if(lf){const s=await squeeze(lf);if(s)row.logo_url=await up(s,'logos')}
  let id=S.eP;
  if(id)ok(await T('gravar parceiro',sb.from('parceiros').update(row).eq('id',id)));
  else id=ok(await T('gravar parceiro',sb.from('parceiros').insert(row).select().single())).data.id;
  const L=CARD[id]||[];await addCards(id,$('f_cards').files,L.length?Math.max(...L.map(x=>x.ordem))+1:0);
  const n=await T('escala e agenda',saveRule(id,rule));
  S.eP=id;await T('recarregar dados',refresh());alert('Parceiro salvo.'+(n?` ${n} data(s) adicionada(s).`:''))}
 catch(e){console.error(e);if(e&&e.timeout)alert(e.message);const x=$('btnP');if(x){x.disabled=false;x.textContent='Salvar'}}}
async function delP(id){if(!confirm('Excluir parceiro, cardápios e agenda dele?'))return;
 ok(await sb.from('parceiros').delete().eq('id',id));S.eP=null;refresh()}

/* ---------- 3: comunicação ---------- */
function comTab(){const t=new Date(),ds=[...Array(7)].map((_,i)=>addD(t,i));let h='<h2>Confirmação de agenda — próximos 7 dias</h2>',n=0;
 ds.forEach(d=>day(d,1).filter(p=>!p.ag||p.ag.status!=='Cancelado').forEach(p=>{n++;
  const msg=`Bom dia ${p.n}, podemos confirmar agenda do dia ${br(d)}?`,ph=wa(p.t);
  h+=`<div class="row"><span>${DIAS[d.getDay()].slice(0,3)} ${br(d)} · <b>${E(p.n)}</b> <small>${p.ag?E(p.ag.status):'(evento especial)'}</small></span>${ph?`<a class="btn pri" target="_blank" rel="noopener" href="https://wa.me/${ph}?text=${encodeURIComponent(msg)}">Enviar WhatsApp</a>`:'<small>sem contato cadastrado</small>'}</div>`}));
 return h+(n?'':'<p>Nenhum truck nos próximos 7 dias.</p>')}

/* ---------- 4: eventos especiais ---------- */
function evTab(){const e=EV.find(x=>x.id===S.eE)||{tr:[]},tr=(e.tr||[]).map(Number),v=x=>E(x??'');
 return `<h2>${S.eE?'Editar evento':'Novo evento'}</h2>
<div class="bar">${fld('Título',`<input id="e_t" value="${v(e.t)}">`)}${fld('Data',`<input type="date" id="e_d" value="${v(e.d)}">`)}${fld('Horário',`<input id="e_h" value="${v(e.h)}" placeholder="14:00 às 22:00">`)}</div>
<div class="bar"><b style="width:100%;font-size:.85rem">Trucks participantes</b>${P.map(p=>`<label style="min-width:170px"><input type="checkbox" class="e_tr" value="${p.id}" ${tr.includes(p.id)?'checked':''}> ${E(p.n)}</label>`).join('')||'<small>Cadastre parceiros primeiro.</small>'}</div>
<div class="bar"><button class="btn pri" onclick="saveE()">Salvar evento</button>${S.eE?`<button class="btn" onclick="setE(null)">Cancelar edição</button>`:''}</div>
<h2>Eventos cadastrados</h2>`
 +(EV.map(x=>`<div class="row"><span><b>${E(x.t)}</b> · ${br(pd(x.d))} · ${E(x.h||'')}</span><button class="btn" onclick="setE(${x.id})">Editar</button><button class="btn" onclick="delE(${x.id})">Excluir</button></div>`).join('')||'<small>Nenhum evento.</small>')}
async function saveE(){const t=$('e_t').value.trim(),d=$('e_d').value;if(!t||!d){alert('Informe título e data.');return}
 const row={titulo:t,data:d,horario:$('e_h').value.trim()||null,trucks_participantes:[...document.querySelectorAll('.e_tr:checked')].map(x=>+x.value)};
 if(S.eE)ok(await sb.from('eventos_especiais').update(row).eq('id',S.eE));else ok(await sb.from('eventos_especiais').insert(row));
 S.eE=null;refresh()}
async function delE(id){if(!confirm('Excluir evento?'))return;ok(await sb.from('eventos_especiais').delete().eq('id',id));if(S.eE===id)S.eE=null;refresh()}

/* ---------- vaga disponível ---------- */
const vagaMsg=()=>{const dt=pd(S.vd||iso(new Date()));return `Vaga disponível para ${DIAS[dt.getDay()]} ${br(dt)}. Enviado à lista de distribuição, vaga será preenchida por ordem de confirmação.`};
function vagaTab(){
 const d=S.vd||iso(new Date()),msg=vagaMsg(),ocup=new Set(AG.filter(x=>x.data===d&&x.status!=='Cancelado').map(x=>x.parceiro_id)),l=P.filter(p=>!S.vc||p.c===S.vc);
 return `<h2>Vaga disponível</h2><div class="bar"><label>Data <input type="date" value="${d}" onchange="vagaDate(this.value)"></label><select onchange="S.vc=this.value;render()"><option value="">Todas as categorias</option>${CATS.map(c=>`<option ${S.vc===c?'selected':''}>${c}</option>`).join('')}</select></div>
<div class="ev">${E(msg)}</div><div class="bar"><button class="btn" onclick="copiarVaga()">Copiar mensagem (para o grupo)</button></div>
<small>Cada parceiro abre uma conversa de WhatsApp. Quem aceitar: toque em <b>Preencher vaga</b> para incluir na agenda.</small>`
 +l.map(p=>{const wp=wa(p.t),oc=ocup.has(p.id),env=S.vsent.has(p.id);
  return `<div class="row"><span>${p.ic} <b>${E(p.n)}</b> <small>${E(p.c)} · ${E(p.k)}${oc?' · já agendado neste dia':''}</small></span>`
  +(oc?'':(wp?`<a class="btn ${env?'':'pri'}" target="_blank" rel="noopener" href="https://wa.me/${wp}?text=${encodeURIComponent(msg)}" onclick="vagaMark(this,${p.id})">${env?'✓ Enviado':'WhatsApp'}</a>`:'<small>sem contato</small>')+`<button class="btn" onclick="vagaFill(${p.id})">Preencher vaga</button>`)+'</div>'}).join('')}
const vagaDate=v=>{S.vd=v;S.vsent=new Set();render()};
const vagaMark=(el,id)=>{S.vsent.add(id);el.textContent='✓ Enviado';el.classList.remove('pri')};
const copiarVaga=()=>navigator.clipboard.writeText(vagaMsg()).then(()=>alert('Mensagem copiada.')).catch(()=>prompt('Copie a mensagem:',vagaMsg()));
async function vagaFill(id){const d=S.vd||iso(new Date()),p=P.find(x=>x.id===id);
 if(!confirm(`Agendar ${p.n} em ${br(pd(d))}?`))return;
 try{const ex=AG.find(x=>x.parceiro_id===id&&x.data===d);
  if(ex)ok(await sb.from('agenda_gerada').update({status:'Confirmado'}).eq('id',ex.id));
  else ok(await sb.from('agenda_gerada').insert({parceiro_id:id,data:d,status:'Confirmado'}));
  await refresh()}catch(e){console.error(e)}}

/* ---------- histórico por parceiro ---------- */
function histTab(){
 if(S.hp)return histDet(S.hp);
 const hj=iso(new Date()),de=S.hr?iso(addD(new Date(),-S.hr)):'0000-00-00',T={r:0,c:0,s:0,f:0};
 const linhas=P.map(p=>{const a=AG.filter(x=>x.parceiro_id===p.id),pas=a.filter(x=>x.data<hj&&x.data>=de),n=s=>pas.filter(x=>x.status===s).length,
  r=pas.filter(x=>OKS.includes(x.status)).length,c=n('Cancelado'),s=n('Substituído'),f=n('Faltou'),
  prox=a.filter(x=>x.data>=hj&&OKS.includes(x.status)).map(x=>x.data).sort()[0];
  T.r+=r;T.c+=c;T.s+=s;T.f+=f;
  return `<tr><td><a href="#" onclick="S.hp=${p.id};render();return false">${p.ic} ${E(p.n)}</a></td><td>${r}</td><td>${c}</td><td>${s}</td><td>${f}</td><td>${prox?br(pd(prox)):'—'}</td></tr>`}).join('');
 return `<style>.ht{width:100%;border-collapse:collapse;font-size:.85rem}.ht th,.ht td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:left}.ht td+td,.ht th+th{text-align:center}</style>
<h2>Histórico por parceiro</h2><div class="bar"><select onchange="S.hr=+this.value;render()">${[[30,'Últimos 30 dias'],[90,'Últimos 90 dias'],[365,'Últimos 12 meses'],[0,'Todo o período']].map(([v,l])=>`<option value="${v}" ${S.hr===v?'selected':''}>${l}</option>`).join('')}</select></div>
<div style="overflow-x:auto"><table class="ht"><thead><tr><th>Parceiro</th><th>Realizadas</th><th>Canceladas</th><th>Substituídas</th><th>Faltas</th><th>Próxima</th></tr></thead><tbody>${linhas}</tbody><tfoot><tr><th>Total</th><th>${T.r}</th><th>${T.c}</th><th>${T.s}</th><th>${T.f}</th><th></th></tr></tfoot></table></div>
<small>"Realizada" = data passada que não foi cancelada, substituída nem marcada como falta. O sistema não sabe se o truck compareceu: para registrar faltas, abra o parceiro e mude o status da data.</small>`}
function histDet(id){const p=P.find(x=>x.id===id)||{n:'?',ic:''},hj=iso(new Date()),a=AG.filter(x=>x.parceiro_id===id).sort((x,y)=>x.data<y.data?1:-1);
 return `<div class="bar"><button class="btn" onclick="S.hp=null;render()">‹ Voltar</button><b>${p.ic} ${E(p.n)}</b></div>`
 +(a.length?a.map(x=>`<div class="row"><span>${DIAS[pd(x.data).getDay()]} ${br(pd(x.data))}${x.data>=hj?' <small>(futura)</small>':''}</span><select onchange="setSt(${x.id},this.value)">${ST.map(s=>`<option ${s===x.status?'selected':''}>${s}</option>`).join('')}</select></div>`).join(''):'<small>Sem datas.</small>')}
async function setSt(id,v){try{ok(await sb.from('agenda_gerada').update({status:v}).eq('id',id));const g=AG.find(x=>x.id===id);if(g)g.status=v}catch(e){render()}}

/* ---------- backup ---------- */
const bkpQuando=()=>{try{return +localStorage.getItem('bkp')||0}catch(e){return 0}};
function bkpAviso(){const t=bkpQuando(),d=t?Math.floor((Date.now()-t)/864e5):null;
 return d===null?'<br>⚠️ Nenhum backup feito neste navegador (aba Backup).':d>7?`<br>⚠️ Último backup há ${d} dias (aba Backup).`:''}
function bkpTab(){const t=bkpQuando();
 return `<h2>Backup</h2><p>Último backup neste navegador: <b>${t?new Date(t).toLocaleString('pt-BR'):'nunca'}</b></p>
<div class="bar"><button class="btn pri" onclick="bkpSql()">Backup completo (.sql)</button><button class="btn" onclick="bkpCsv('p')">Parceiros (.csv)</button><button class="btn" onclick="bkpCsv('a')">Agenda (.csv)</button></div>
<small>O <b>.sql</b> restaura tudo em um projeto novo (rode antes o <code>schema.sql</code>). Os <b>.csv</b> abrem no Excel/Power Query. As <b>imagens</b> (logos e cardápios) ficam no Storage e <b>não</b> entram no backup — só os links; guarde os arquivos originais. Guarde o backup fora do GitHub: ele contém telefones.</small>`}
async function pegaTudo(){const o={};for(const t of['parceiros','cardapios_parceiro','recorrencias_parceiro','agenda_gerada','eventos_especiais'])o[t]=await todas(t);return o}
const sqlV=v=>v==null?'null':typeof v==='number'||typeof v==='boolean'?String(v):Array.isArray(v)?`'{${v.join(',')}}'`:`'${String(v).replace(/'/g,"''")}'`;
function sqlDe(d){let s=`-- Backup Agenda Basel — ${new Date().toLocaleString('pt-BR')}\n-- Restaurar: projeto novo > rode schema.sql > rode este arquivo no SQL Editor.\n-- Imagens (Storage) NÃO estão incluídas; apenas as URLs.\nbegin;\n`;
 for(const [t,rows] of Object.entries(d)){if(!rows.length)continue;const cols=Object.keys(rows[0]);
  for(let i=0;i<rows.length;i+=500)s+=`insert into ${t} (${cols.join(',')}) overriding system value values\n`+rows.slice(i,i+500).map(r=>`(${cols.map(c=>sqlV(r[c])).join(',')})`).join(',\n')+';\n';
  s+=`select setval(pg_get_serial_sequence('${t}','id'),(select max(id) from ${t}));\n`}
 return s+'commit;\n'}
function baixar(nome,txt,tipo){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:tipo+';charset=utf-8'}));a.download=nome;document.body.appendChild(a);a.click();a.remove()}
const csvL=a=>a.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';');
const marcaBkp=()=>{try{localStorage.setItem('bkp',Date.now())}catch(e){}};
async function bkpSql(){try{const d=await T('ler dados',pegaTudo());baixar(`backup-basel-${iso(new Date())}.sql`,sqlDe(d),'text/plain');marcaBkp();
 alert(`Backup gerado: ${d.parceiros.length} parceiros, ${d.agenda_gerada.length} datas, ${d.eventos_especiais.length} eventos.`);render()}catch(e){console.error(e);if(e&&e.timeout)alert(e.message)}}
async function bkpCsv(k){try{let linhas;
 if(k==='p'){const r=await T('ler parceiros',todas('parceiros'));linhas=[['id','nome_operacao','categoria','culinaria','nome_responsavel','contato_responsavel','emoji','logo_url'],...r.map(x=>[x.id,x.nome_operacao,x.categoria,x.culinaria,x.nome_responsavel,x.contato_responsavel,x.emoji,x.logo_url])]}
 else{const r=await T('ler agenda',todas('agenda_gerada'));linhas=[['parceiro','categoria','data','dia_semana','status'],...r.map(x=>{const p=P.find(y=>y.id===x.parceiro_id)||{};return[p.n,p.c,br(pd(x.data)),DIAS[pd(x.data).getDay()],x.status]}).sort((x,y)=>0)]}
 baixar(`${k==='p'?'parceiros':'agenda'}-basel-${iso(new Date())}.csv`,'\uFEFF'+linhas.map(csvL).join('\r\n'),'text/csv');marcaBkp();render()}catch(e){console.error(e);if(e&&e.timeout)alert(e.message)}}

/* ---------- view principal ---------- */
function adminView(){
 if(!S.user)return `<div class="adm"><b>Painel Administrativo</b><p>Acesso restrito. Entre com a conta Google autorizada.</p><button class="btn pri" onclick="login()">Entrar com Google</button></div>`;
 if(!S.admin)return '';
 const tab=(k,l)=>`<button class="btn ${S.tab===k?'pri':''}" onclick="setTab('${k}')">${l}</button>`;
 return `<div class="adm">${E(S.user.email)} <button class="btn" onclick="logout()">Sair</button>${bkpAviso()}</div>
<div class="bar">${tab('parc','Parceiros')}${tab('com','Comunicação')}${tab('vaga','Vagas')}${tab('ev','Eventos')}${tab('hist','Histórico')}${tab('bkp','Backup')}</div>`
 +({parc:parcForm,com:comTab,vaga:vagaTab,ev:evTab,hist:histTab,bkp:bkpTab}[S.tab]||parcForm)()}
