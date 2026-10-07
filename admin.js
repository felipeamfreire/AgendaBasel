// Painel administrativo (3 abas: Parceiros, Comunicação, Eventos).
// A segurança real é feita pelo banco (RLS em schema.sql); as checagens aqui são só de interface.
// Depende de globais do index.html: sb, P, EV, AG, REC, CARD, DIAS, CATS, view, cur, load, render, day, iso, pd, br, addD.
const S={user:null,admin:false,tab:'parc',eP:null,eE:null};
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
const prevHTML=r=>{const l=datesOf(r,horizonte());
 return l.length?`<small>Datas geradas (${l.length}): ${l.slice(0,12).map(x=>br(pd(x))).join(', ')}${l.length>12?'…':''}</small>`:'<small>Nenhuma data gerada.</small>'};
function prevR(){const rec=$('r_rec').checked;
 $('rec_on').style.display=rec?'':'none';$('rec_off').style.display=rec?'none':'';
 $('prev').innerHTML=prevHTML(rec?{recorrente:true,periodicidade:$('r_per').value,dia_semana:$('r_dia').value,inicio_recorrencia:$('r_i').value,fim_recorrencia:$('r_f').value||null}
  :{recorrente:false,data_especifica:$('r_e').value})}

function parcForm(){
 const p=P.find(x=>x.id===S.eP)||{},r=REC.find(x=>x.parceiro_id===S.eP)||{recorrente:true},n=REC.filter(x=>x.parceiro_id===S.eP).length,v=x=>E(x??''),rec=r.recorrente!==false;
 return `<div class="bar"><select onchange="pickP(this.value)"><option value="">➕ Novo parceiro</option>${CATS.map(c=>P.some(x=>x.c===c)?`<optgroup label="${c}">${P.filter(x=>x.c===c).map(x=>`<option value="${x.id}" ${x.id===S.eP?'selected':''}>${E(x.n)}</option>`).join('')}</optgroup>`:'').join('')}</select></div>
<h2>${S.eP?'Editar parceiro':'Novo parceiro'}</h2>
<div class="bar">${fld('Nome da operação',`<input id="f_n" value="${v(p.n)}">`)}${fld('Tipo',`<select id="f_c">${opts(CATS,p.c)}</select>`)}${fld('Culinária',`<input id="f_k" value="${v(p.k)}">`)}</div>
<div class="bar">${fld('Nome do responsável',`<input id="f_r" value="${v(p.r)}">`)}${fld('Contato (WhatsApp com DDD)',`<input id="f_t" value="${v(p.t)}" placeholder="19999999999">`)}</div>
<div class="bar">${fld('Logo '+(p.logo?`(atual abaixo; enviar outra substitui)`:''),`<input type="file" id="f_logo" accept="image/*">`)}${p.logo?`<img src="${p.logo}" alt="" style="height:44px;border-radius:6px">`:''}</div>
${S.eP?`<div><b>Cardápios atuais</b><div id="cardlist">${cardList(S.eP)}</div></div>`:''}
<div class="bar">${fld('Adicionar cardápios (várias imagens ou PDF)',`<input type="file" id="f_cards" multiple accept="image/*,.pdf">`)}</div>
<h2>Escala</h2>${n>1?`<small>Este parceiro tem ${n} regras; aqui aparece a primeira.</small>`:''}
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
  if(!i){alert('Informe a data de início da recorrência.');return false}
  if(f&&f<i){alert('A data fim é anterior ao início.');return false}
  return{recorrente:true,periodicidade:$('r_per').value,dia_semana:$('r_dia').value,inicio_recorrencia:i,fim_recorrencia:f||null,data_especifica:null}}
 const e=$('r_e').value;
 return e?{recorrente:false,periodicidade:null,dia_semana:null,inicio_recorrencia:null,fim_recorrencia:null,data_especifica:e}:null}

async function saveRule(pid,rule){const old=REC.find(x=>x.parceiro_id===pid);
 if(old&&rule&&['recorrente','periodicidade','dia_semana','inicio_recorrencia','fim_recorrencia','data_especifica'].every(k=>old[k]===rule[k]))return; // sem mudança
 if(old){ok(await sb.from('agenda_gerada').delete().eq('recorrencia_id',old.id).gte('data',iso(new Date())));
  if(!rule){ok(await sb.from('recorrencias_parceiro').delete().eq('id',old.id));return}
  ok(await sb.from('recorrencias_parceiro').update(rule).eq('id',old.id))}
 else if(rule)ok(await sb.from('recorrencias_parceiro').insert({...rule,parceiro_id:pid}));
 else return;
 ok(await sb.rpc('gerar_agenda',{p_ate:horizonte()}))}

async function saveP(){const b=$('btnP');
 try{const g=id=>$(id).value.trim();
  if(!g('f_n')||!g('f_k')){alert('Informe nome da operação e culinária.');return}
  const rule=ruleForm();if(rule===false)return;
  b.disabled=true;b.textContent='Salvando…';
  const row={nome_operacao:g('f_n'),categoria:$('f_c').value,culinaria:g('f_k'),nome_responsavel:g('f_r')||null,contato_responsavel:g('f_t').replace(/\D/g,'')||null};
  const lf=$('f_logo').files[0];if(lf){const s=await squeeze(lf);if(s)row.logo_url=await up(s,'logos')}
  let id=S.eP;
  if(id)ok(await T('gravar parceiro',sb.from('parceiros').update(row).eq('id',id)));
  else id=ok(await T('gravar parceiro',sb.from('parceiros').insert(row).select().single())).data.id;
  const L=CARD[id]||[];await addCards(id,$('f_cards').files,L.length?Math.max(...L.map(x=>x.ordem))+1:0);
  await T('escala e agenda',saveRule(id,rule));
  S.eP=id;await T('recarregar dados',refresh());alert('Parceiro salvo.')}
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

/* ---------- view principal ---------- */
function adminView(){
 if(!S.user)return `<div class="adm"><b>Painel Administrativo</b><p>Acesso restrito. Entre com a conta Google autorizada.</p><button class="btn pri" onclick="login()">Entrar com Google</button></div>`;
 if(!S.admin)return '';
 const tab=(k,l)=>`<button class="btn ${S.tab===k?'pri':''}" onclick="setTab('${k}')">${l}</button>`;
 return `<div class="adm">${E(S.user.email)} <button class="btn" onclick="logout()">Sair</button></div>
<div class="bar">${tab('parc','Parceiros')}${tab('com','Comunicação')}${tab('ev','Eventos')}</div>`
 +(S.tab==='parc'?parcForm():S.tab==='com'?comTab():evTab())}
