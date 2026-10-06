// Painel administrativo. A segurança real é feita pelo banco (RLS, schema.sql);
// as checagens aqui servem apenas para a interface.
const ADMIN_EMAIL = 'felipefreire@gmail.com';
const S={user:null,admin:false},ST=['Ativo','Cancelado','Substituído','Pendente Confirmação','Confirmado'];
const $=id=>document.getElementById(id);
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nomeP=id=>(P.find(p=>p.id===id)||{n:'?'}).n;
const ok=r=>{if(r.error){alert(r.error.message);throw r.error}return r};
const refresh=async()=>{await load();render()};
const horizonte=()=>iso(addD(new Date(),120));
const login=()=>sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});
const logout=async()=>{await sb.auth.signOut();S.user=null;S.admin=false;await load();render()};
async function setUser(s){const u=s&&s.user;S.user=u||null;S.admin=!!u&&u.email.toLowerCase()===ADMIN_EMAIL;
 if(u&&!S.admin){alert('Acesso negado: Usuário não autorizado como administrador');await sb.auth.signOut();S.user=null;view='hoje'}}

function squeeze(f){return new Promise(r=>{
 if(f.size>10e6){alert(f.name+' passa de 10MB');return r(null)}
 if(!f.type.startsWith('image/'))return r(f);
 const i=new Image();i.onload=()=>{const k=Math.min(1,1600/Math.max(i.width,i.height)),c=document.createElement('canvas');
  c.width=i.width*k;c.height=i.height*k;c.getContext('2d').drawImage(i,0,0,c.width,c.height);
  c.toBlob(b=>r(new File([b],f.name.replace(/\.\w+$/,'')+'.jpg',{type:'image/jpeg'})),'image/jpeg',.82)};
 i.src=URL.createObjectURL(f)})}
async function up(file,pasta){const nome=pasta+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,6)+'-'+file.name.replace(/[^\w.]/g,'_');
 ok(await sb.storage.from('midia').upload(nome,file));return sb.storage.from('midia').getPublicUrl(nome).data.publicUrl}

async function addCards(id,files,ini){let o=ini;for(const f of files){const s=await squeeze(f);if(!s)continue;
 ok(await sb.from('cardapios_parceiro').insert({parceiro_id:id,cardapio_url:await up(s,'cardapios'),ordem:o++}))}}
async function addP(){try{let logo=null;const lf=$('f_logo').files[0];
 if(lf){const s=await squeeze(lf);if(s)logo=await up(s,'logos')}
 const r=ok(await sb.from('parceiros').insert({nome_operacao:$('f_n').value,categoria:$('f_c').value,culinaria:$('f_k').value,
  nome_responsavel:$('f_r').value,contato_responsavel:$('f_t').value.replace(/\D/g,''),logo_url:logo}).select().single());
 await addCards(r.data.id,$('f_cards').files,0);await refresh()}catch(e){console.error(e)}}
async function addC(id){const L=CARD[id]||[];await addCards(id,$('ac'+id).files,L.length?Math.max(...L.map(x=>x.ordem))+1:0);refresh()}
async function delC(id){await sb.from('cardapios_parceiro').delete().eq('id',id);refresh()}
async function mvC(pid,id,dir){const l=CARD[pid],i=l.findIndex(x=>x.id===id),j=i+dir;if(j<0||j>=l.length)return;
 await Promise.all([sb.from('cardapios_parceiro').update({ordem:l[j].ordem}).eq('id',l[i].id),
  sb.from('cardapios_parceiro').update({ordem:l[i].ordem}).eq('id',l[j].id)]);refresh()}
async function delP(id){if(confirm('Excluir parceiro, cardápios e agenda?')){ok(await sb.from('parceiros').delete().eq('id',id));refresh()}}

function ruleForm(){const rec=$('r_rec').checked;return{parceiro_id:+$('r_p').value,recorrente:rec,periodicidade:rec?$('r_per').value:null,
 dia_semana:rec?$('r_dia').value:null,inicio_recorrencia:rec?($('r_i').value||null):null,fim_recorrencia:rec?($('r_f').value||null):null,
 data_especifica:rec?null:($('r_e').value||null)}}
function datesOf(r,ate){if(!r.recorrente)return r.data_especifica?[r.data_especifica]:[];if(!r.inicio_recorrencia)return[];
 const step={semanal:7,quinzenal:14,mensal:28}[r.periodicidade],want=DIAS.indexOf(r.dia_semana);
 let d=pd(r.inicio_recorrencia);d=addD(d,(want-d.getDay()+7)%7);
 const end=pd(r.fim_recorrencia&&r.fim_recorrencia<ate?r.fim_recorrencia:ate),o=[];
 for(;d<=end;d=addD(d,step))o.push(iso(d));return o}
function prevR(){const l=datesOf(ruleForm(),horizonte());
 $('prev').innerHTML=l.length?'<small>Datas geradas ('+l.length+'): '+l.slice(0,16).map(x=>br(pd(x))).join(', ')+(l.length>16?'…':'')+'</small>':'<small>Nenhuma data.</small>'}
async function saveR(){const r=ruleForm();if(!datesOf(r,horizonte()).length){alert('Preencha as datas da regra.');return}
 ok(await sb.from('recorrencias_parceiro').insert(r));ok(await sb.rpc('gerar_agenda',{p_ate:horizonte()}));refresh()}
async function delR(id){if(!confirm('Excluir regra e as datas futuras dela?'))return;
 await sb.from('agenda_gerada').delete().eq('recorrencia_id',id).gte('data',iso(new Date()));
 ok(await sb.from('recorrencias_parceiro').delete().eq('id',id));refresh()}
async function gen(){ok(await sb.rpc('gerar_agenda',{p_ate:horizonte()}));refresh()}
async function setSt(id,v){ok(await sb.from('agenda_gerada').update({status:v}).eq('id',id));refresh()}

async function addE(){ok(await sb.from('eventos_especiais').insert({titulo:$('e_t').value,descricao:$('e_s').value,data:$('e_d').value,
 horario:$('e_h').value,trucks_participantes:[...$('e_tr').selectedOptions].map(o=>+o.value)}));refresh()}
async function delE(id){ok(await sb.from('eventos_especiais').delete().eq('id',id));refresh()}
function vaga(){const d=pd($('vd').value),c=$('vc').value;
 const m=`Vaga disponível para ${DIAS[d.getDay()]} ${br(d)}. Enviado à lista de distribuição, vaga será preenchida por ordem de confirmação.`;
 P.filter(p=>p.t&&(!c||p.c===c)).forEach(p=>window.open(`https://wa.me/${p.t}?text=${encodeURIComponent(m)}`,'_blank','noopener'))}

function adminView(){
 if(!S.user)return `<div class="adm"><b>Painel Administrativo</b><p>Acesso restrito. Entre com a conta Google autorizada.</p><button class="btn pri" onclick="login()">Entrar com Google</button></div>`;
 if(!S.admin)return '';
 const ds=[...Array(7)].map((_,i)=>addD(weekStart(cur),i)),opt=P.map(p=>`<option value="${p.id}">${E(p.n)}</option>`).join('');
 let h=`<div class="adm">${E(S.user.email)} <button class="btn" onclick="logout()">Sair</button> <button class="btn" onclick="gen()">Regenerar agenda (120 dias)</button></div>`;
 h+=`<details open><summary><b>Parceiros</b></summary><div class="bar"><input id="f_n" placeholder="Nome da operação"><select id="f_c">${CATS.map(c=>`<option>${c}</option>`).join('')}</select><input id="f_k" placeholder="Culinária"><input id="f_r" placeholder="Responsável"><input id="f_t" placeholder="WhatsApp (5519...)"></div><div class="bar">Logo <input type="file" id="f_logo" accept="image/*"> Cardápios <input type="file" id="f_cards" multiple accept="image/*,.pdf"><button class="btn pri" onclick="addP()">Cadastrar</button></div>`
 +P.map(p=>`<div class="row"><span><b>${E(p.n)}</b> · ${E(p.c)} · ${E(p.k)}<br>${(CARD[p.id]||[]).map((c,i)=>`<a href="${c.cardapio_url}" target="_blank" rel="noopener">#${i+1}</a> <button class="btn" onclick="mvC(${p.id},${c.id},-1)">↑</button><button class="btn" onclick="mvC(${p.id},${c.id},1)">↓</button><button class="btn" onclick="delC(${c.id})">✕</button> `).join('')}</span><input type="file" multiple id="ac${p.id}" accept="image/*,.pdf"><button class="btn" onclick="addC(${p.id})">+ Cardápio</button><button class="btn" onclick="delP(${p.id})">Excluir</button></div>`).join('')+'</details>';
 h+=`<details><summary><b>Escala e recorrência</b></summary><div class="bar"><select id="r_p">${opt}</select><label><input type="checkbox" id="r_rec" checked> Recorrente</label><select id="r_per"><option>semanal</option><option>quinzenal</option><option>mensal</option></select><select id="r_dia">${DIAS.map(d=>`<option>${d}</option>`).join('')}</select></div><div class="bar">Início <input type="date" id="r_i"> Fim <input type="date" id="r_f"> Pontual <input type="date" id="r_e"><button class="btn" onclick="prevR()">Prévia</button><button class="btn pri" onclick="saveR()">Salvar</button></div><div id="prev"></div>`
 +REC.map(r=>`<div class="row"><span>${E(nomeP(r.parceiro_id))} · ${r.recorrente?r.periodicidade+' · '+r.dia_semana:'pontual '+r.data_especifica}</span><button class="btn" onclick="delR(${r.id})">Excluir</button></div>`).join('')+'</details>';
 h+=`<details open><summary><b>Agenda da semana</b></summary><div class="bar"><button class="btn" onclick="nav(-7)">‹</button> ${br(ds[0])} <button class="btn" onclick="nav(7)">›</button></div>`;
 ds.forEach(d=>day(d,1).forEach(p=>{if(!p.ag)return;
  h+=`<div class="row"><span>${DIAS[d.getDay()].slice(0,3)} ${br(d)} · <b>${E(p.n)}</b></span><select onchange="setSt(${p.ag.id},this.value)">${ST.map(x=>`<option ${x===p.ag.status?'selected':''}>${x}</option>`).join('')}</select><a class="btn" target="_blank" rel="noopener" href="https://wa.me/${p.t}?text=${encodeURIComponent(`Bom dia ${p.n}, podemos confirmar agenda do dia ${br(d)}?`)}">WhatsApp</a></div>`}));
 h+=`</details><details><summary><b>Vaga disponível</b></summary><div class="bar"><input id="vd" type="date" value="${iso(cur)}"><select id="vc"><option value="">Todas as categorias</option>${CATS.map(c=>`<option>${c}</option>`).join('')}</select><button class="btn pri" onclick="vaga()">Abrir WhatsApp dos parceiros</button></div></details>`;
 h+=`<details><summary><b>Eventos especiais</b></summary><div class="bar"><input id="e_t" placeholder="Título"><input id="e_d" type="date"><input id="e_h" placeholder="Horário (14:00 às 22:00)"></div><div class="bar"><input id="e_s" placeholder="Descrição"><select id="e_tr" multiple size="4">${opt}</select><button class="btn pri" onclick="addE()">Salvar evento</button></div>`
 +EV.map(e=>`<div class="row"><span>${E(e.t)} · ${br(pd(e.d))}</span><button class="btn" onclick="delE(${e.id})">Excluir</button></div>`).join('')+'</details>';
 return h}
