/* ========= Estado ========= */
let preguntasCompletas = [], preguntas = [], indicePregunta = 0, preguntasCorrectas = 0, resultados = [];
let limiteSeleccionado = 10; // <- por defecto 10 (coincide con el select)
let inicioPreguntaMs = 0;
const archivosJSON = new Map();

/* ========= DOM ========= */
const contenido = document.getElementById('contenido'), contador = document.getElementById('contador');
const barraProgreso = document.getElementById('barraProgreso');
const btnEvaluar = document.getElementById('btnEvaluar'), btnSiguiente = document.getElementById('btnSiguiente');
const btnCargar = document.getElementById('btnCargar'), btnCargarCarpeta = document.getElementById('btnCargarCarpeta');
const selectArchivo = document.getElementById('selectArchivo');
const selectPreguntas = document.getElementById('selectPreguntas');
const btnExportar = document.getElementById('btnExportar');
const seccionRevision = document.getElementById('seccionRevision');
const autoMsg = document.getElementById('autoMsg');

// Descargas (modal)
const modalDescargas = document.getElementById('modalDescargas');
const listaDescargas = document.getElementById('listaDescargas');
const estadoDescargas = document.getElementById('estadoDescargas');
const chkTodos = document.getElementById('chkTodos');
const btnDescargarSeleccion = document.getElementById('btnDescargarSeleccion');

document.getElementById('anioAcerca').textContent = new Date().getFullYear();

/* ========= Utils ========= */
function shuffleInPlace(arr){
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
}

/* ========= Manifest (sin API externas) ========= */
const MANIFEST_PATH = 'Downloades/manifest.json';

async function loadManifest(){
  try{
    const r = await fetch(MANIFEST_PATH, {cache:'no-store'});
    if(!r.ok) throw new Error('manifest no encontrado');
    const manifest = await r.json();
    if(!manifest || !Array.isArray(manifest.files)) throw new Error('manifest inválido');
    return manifest;
  }catch(e){
    return null;
  }
}

async function preloadFromManifest(){
  const manifest = await loadManifest();
  if(!manifest){
    autoMsg.textContent = 'No se encontró Downloades/manifest.json. Usá "Cargar JSON" o "Cargar carpeta".';
    return;
  }
  try{
    archivosJSON.clear();
    // Cargar archivos listados
    for(const f of manifest.files){
      const url = `${manifest.folder}/${f.name}`;
      const res = await fetch(url, {cache:'no-store'});
      if(!res.ok) continue;
      const txt = await res.text();
      // Usamos SOLO el label como clave visible en el combo
      const key = f.label || f.name;
      archivosJSON.set(key, txt);
    }
    refrescarSelector();
    autoMsg.textContent = `Detectados ${archivosJSON.size} JSON desde manifest. Elegí un tema.`;

    // Prepara el modal de descargas con los mismos archivos
    prepararModalDescargas(manifest);
  }catch(e){
    autoMsg.textContent = 'Error al precargar desde manifest.';
  }
}

/* ========= Modal Descargas (usa el manifest) ========= */
function prepararModalDescargas(manifest){
  listaDescargas.innerHTML = '';
  if(!manifest || !Array.isArray(manifest.files) || !manifest.files.length){
    estadoDescargas.classList.remove('d-none');
    estadoDescargas.textContent = 'Manifest vacío o no encontrado.';
    btnDescargarSeleccion.disabled = true;
    return;
  }
  estadoDescargas.classList.add('d-none');
  const frag=document.createDocumentFragment();
  manifest.files.forEach((f, idx)=>{
    const id=`dl_${idx}`;
    const label = f.label || f.name;
    const url = `${manifest.folder}/${f.name}`;
    const w=document.createElement('div');
    w.className='form-check mb-2';
    w.innerHTML = `
      <input class="form-check-input dl-item" type="checkbox" id="${id}" data-file="${f.name}" data-url="${url}">
      <label class="form-check-label" for="${id}">${label}</label>`;
    frag.appendChild(w);
  });
  listaDescargas.appendChild(frag);

  const syncBtn = ()=>{ btnDescargarSeleccion.disabled = !listaDescargas.querySelector('.dl-item:checked'); };
  listaDescargas.addEventListener('change', (e)=>{ if(e.target.classList.contains('dl-item')) syncBtn(); });
  chkTodos.addEventListener('change', ()=>{
    const items = listaDescargas.querySelectorAll('.dl-item');
    items.forEach(i => i.checked = chkTodos.checked);
    btnDescargarSeleccion.disabled = !chkTodos.checked;
  });
  btnDescargarSeleccion.addEventListener('click', ()=>{
    const sel = [...listaDescargas.querySelectorAll('.dl-item:checked')]
      .map(i => ({name:i.dataset.file, url:i.dataset.url}));
    if(!sel.length) return;
    sel.forEach(({name, url})=>{
      const a=document.createElement('a');
      a.href=url; a.download=name;
      document.body.appendChild(a); a.click(); a.remove();
    });
  });
}

/* ========= Carga manual ========= */
btnCargar.addEventListener('click', ()=>{
  const i=document.createElement('input');
  i.type='file'; i.accept='.json,application/json';
  i.onchange=e=>cargarArchivo(e.target.files[0]);
  i.click();
});

btnCargarCarpeta.addEventListener('click', ()=>{
  const i=document.createElement('input');
  i.type='file'; i.webkitdirectory=true; i.multiple=true;
  i.onchange=e=>cargarCarpeta(e.target.files);
  i.click();
});

function cargarArchivo(file){
  if(!file) return;
  file.text().then(txt=>{
    archivosJSON.set(file.name, txt);
    refrescarSelector();
    selectArchivo.value=file.name;
    cargarDesdeSelector();
  }).catch(e=>alert('Error: '+e.message));
}

function cargarCarpeta(files){
  archivosJSON.clear();
  const lista=[...files].filter(f=>f.name.toLowerCase().endsWith('.json'));
  if(!lista.length){ alert('No se encontraron .json en la carpeta.'); return; }
  Promise.all(lista.map(f=>f.text().then(t=>archivosJSON.set(f.name,t))))
    .then(()=>{
      refrescarSelector();
      contenido.innerHTML = `
        <div>
          <h5 class="mb-2">Seleccioná un tema</h5>
          <p class="text-muted">Se detectaron ${lista.length} JSON.</p>
        </div>`;
    })
    .catch(e=>alert('No se pudo leer la carpeta:\n'+e.message));
}

function refrescarSelector(){
  selectArchivo.disabled = archivosJSON.size===0;
  selectArchivo.innerHTML='<option value="" disabled selected>Seleccioná un tema</option>';
  [...archivosJSON.keys()].sort().forEach(label=>{
    const o=document.createElement('option');
    o.value=label;
    o.textContent=label;
    selectArchivo.appendChild(o);
  });
}

selectArchivo.addEventListener('change', cargarDesdeSelector);

function cargarDesdeSelector(){
  const nombre=selectArchivo.value;
  const txt=archivosJSON.get(nombre);
  if(!txt) return;
  try{
    let data = JSON.parse(txt);
    // Compatibilidad con JSON envuelto en un array extra
    if(Array.isArray(data) && data.length===1 && Array.isArray(data[0])) data = data[0];
    validarEstructura(data);
    procesarPreguntas(data);
    iniciarQuiz();               // usa el límite actual (limiteSeleccionado)
    btnEvaluar.disabled=false;
  }catch(e){
    contenido.innerHTML = `<div class="alert alert-danger"><strong>Error JSON:</strong> ${e.message}</div>`;
  }
}

/* ========= Select de Preguntas (NUEVO) ========= */
selectPreguntas.addEventListener('change', (e)=>{
  const val = e.target.value;
  limiteSeleccionado = (val === 'all') ? 'all' : parseInt(val, 10);
  if (preguntasCompletas.length) iniciarQuiz(); // reinicia con nuevo límite
});

/* ========= Quiz ========= */
btnEvaluar.addEventListener('click', evaluarRespuesta);
btnSiguiente.addEventListener('click', ()=>{ indicePregunta++; mostrarPregunta(); });
btnExportar.addEventListener('click', exportarCSV);

function validarEstructura(data){
  if(!Array.isArray(data) || !data.length) throw new Error('El JSON debe ser un array no vacío de preguntas.');
  const ok = data.every(p => p && typeof p==='object' && p.pregunta && (p.rta_1||p.rta_2||p.rta_3));
  if(!ok) throw new Error('Cada ítem debe tener "pregunta" y al menos una "rta_1/2/3".');
}

function procesarPreguntas(data){
  const seen=new Set();
  preguntasCompletas=data.filter(p=>{
    const t=String(p.pregunta).trim();
    if(seen.has(t)) return false;
    seen.add(t); return true;
  });
}

function iniciarQuiz(){
  preguntasCorrectas=0; resultados=[];
  seccionRevision.classList.add('d-none');
  seccionRevision.innerHTML = '';

  if(limiteSeleccionado==='all' || limiteSeleccionado>=preguntasCompletas.length){
    preguntas=[...preguntasCompletas];
  }else{
    // tomar las primeras N pero después barajamos todo
    preguntas=preguntasCompletas.slice(0, limiteSeleccionado);
  }
  shuffleInPlace(preguntas); // <- orden random SIEMPRE

  indicePregunta=0; mostrarPregunta();
  btnExportar.disabled=true;
}

function actualizarProgreso(){
  const total=preguntas.length||0;
  const pct=total? Math.round((indicePregunta/total)*100) : 0;
  barraProgreso.style.width=pct+'%';
}

function normalizarRespuestas(p){
  const keys=['rta_1','rta_2','rta_3'].filter(k=>p[k]);
  const arr = keys.map(k=>({texto:p[k].texto, correcta:String(p[k].rta).toLowerCase()==='yes'}));
  while(arr.length<3) arr.push({texto:'Opción faltante', correcta:false});
  return arr;
}
function tipoInputs(respuestas){ const c = respuestas.filter(r=>r.correcta).length; return c===1?'radio':'checkbox'; }

function mostrarPregunta(){
  if(indicePregunta>=preguntas.length){ fin(); return; }
  const p=preguntas[indicePregunta];
  contador.textContent=`Pregunta: ${indicePregunta+1} de ${preguntas.length}`;
  actualizarProgreso();

  let respuestas=normalizarRespuestas(p);
  shuffleInPlace(respuestas); // <- orden de respuestas random SIEMPRE

  const inputType=tipoInputs(respuestas);
  let html=`<h5 class="mb-3">${p.pregunta}</h5>`;
  respuestas.forEach((r,i)=>{
    html+=`
      <div class="response-item">
        <div class="form-check">
          <input class="form-check-input" type="${inputType}" name="grupo" id="r${i}">
          <label class="form-check-label" for="r${i}">
            ${r.texto} <span id="f${i}" class="feedback"></span>
          </label>
        </div>
      </div>`;
  });
  contenido.innerHTML=html;

  btnEvaluar.disabled=false;
  btnSiguiente.disabled=true;

  contenido.dataset.respuestas=JSON.stringify(respuestas);
  contenido.dataset.pregunta=JSON.stringify(p);
  inicioPreguntaMs=performance.now();
}

function indicesDe(arr, val){ return arr.map((v,i)=>v===val?i:-1).filter(i=>i!==-1); }

function evaluarRespuesta(){
  const respuestas=JSON.parse(contenido.dataset.respuestas);
  const inputs=[...contenido.querySelectorAll('input.form-check-input')];
  const seleccionadas=inputs.map(i=>i.checked);

  respuestas.forEach((r,i)=>{
    const f=document.getElementById('f'+i);
    f.textContent=r.correcta?'✅':'❌';
    f.style.color=r.correcta?'green':'red';
    inputs[i].disabled=true;
  });

  const acierto = respuestas.every((r,i)=>r.correcta===seleccionadas[i]);
  if(acierto) preguntasCorrectas++;

  btnEvaluar.disabled=true;
  btnSiguiente.disabled=false;

  const p=JSON.parse(contenido.dataset.pregunta);
  const tiempo=(performance.now()-inicioPreguntaMs)/1000;

  resultados.push({
    i: indicePregunta+1,
    pregunta: p.pregunta,
    respuestasRender: respuestas,
    marcadas: indicesDe(seleccionadas, true),
    correctas: indicesDe(respuestas.map(r=>r.correcta), true),
    acierto,
    tiempo
  });
}

function fin(){
  contenido.innerHTML=`
    <h4 class="text-center">¡Quiz finalizado!</h4>
    <p class="text-center fs-5">Puntaje: ${Math.round((preguntasCorrectas/preguntas.length)*100)}/100</p>
    <div class="d-flex justify-content-center mt-3">
      <button class="btn btn-outline-secondary" id="btnToggleRevision">Ver revisión</button>
    </div>
  `;
  btnEvaluar.disabled=true;
  btnSiguiente.disabled=true;
  btnExportar.disabled=false;
  barraProgreso.style.width='100%';

  seccionRevision.innerHTML = renderRevision();
  seccionRevision.classList.add('d-none');

  document.getElementById('btnToggleRevision').addEventListener('click', ()=>{
    seccionRevision.classList.toggle('d-none');
    const btn = document.getElementById('btnToggleRevision');
    btn.textContent = seccionRevision.classList.contains('d-none') ? 'Ver revisión' : 'Ocultar revisión';
  });
}

function renderRevision(){
  if(!resultados.length) return '';
  return resultados.map((r) => {
    const filas = r.respuestasRender.map((res, i) => {
      const esCorrecta = res.correcta;
      const laMarque = r.marcadas.includes(i);
      const icon = esCorrecta ? '✅' : (laMarque ? '❌' : '');
      return `<li>${icon} ${res.texto}</li>`;
    }).join('');
    return `
      <div class="card mb-2">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start">
            <strong>${r.i}. ${r.pregunta}</strong>
            <span class="text-muted small">${r.tiempo.toFixed(1)}s</span>
          </div>
          <ul class="mt-2 mb-0">${filas}</ul>
        </div>
      </div>
    `;
  }).join('');
}

function exportarCSV(){
  if(!resultados.length){ alert('No hay resultados'); return; }
  const csv=['nro,pregunta,tiempo'].concat(
    resultados.map(r=>`${r.i},"${String(r.pregunta||'').replace(/"/g,'""')}",${r.tiempo.toFixed(1)}`)
  ).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='resultados.csv';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* ========= Start ========= */
window.addEventListener('DOMContentLoaded', preloadFromManifest);
