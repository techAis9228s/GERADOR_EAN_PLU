const $ = id => document.getElementById(id);
const previa = $('fotoPrevia');
const contexto = previa.getContext('2d');
const formulario = $('fotoProduto');
const estado = $('fotoEstado');
const guardadas = [];
let imagem, inicio, area, ocupado = false;

function carregarScript(url, nome) {
    return new Promise((resolve, reject) => {
        if (globalThis[nome]) return resolve(globalThis[nome]);
        const script = document.createElement('script');
        script.src = url;
        script.onload = () => globalThis[nome] ? resolve(globalThis[nome]) : reject(Error('Leitor indisponível.'));
        script.onerror = () => { script.remove(); reject(Error('Não foi possível carregar o leitor.')); };
        document.head.append(script);
    });
}

function extrairPlu(codigo) {
    if (!/^2[0-9]{12}$/.test(codigo)) return '';
    const soma = [...codigo.slice(0, 12)].reduce((total, d, i) => total + Number(d) * (i % 2 ? 3 : 1), 0);
    if ((10 - soma % 10) % 10 !== Number(codigo[12])) return '';
    return codigo.slice(1, 7).replace(/^0+(?=\d)/, '');
}

async function lerBarras(canvas) {
    const z = await carregarScript('https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js', 'ZXing');
    const { width, height } = canvas;
    const rgba = canvas.getContext('2d').getImageData(0, 0, width, height).data;
    const cinza = new Uint8ClampedArray(width * height);
    for (let i = 0; i < cinza.length; i++) cinza[i] = (rgba[i * 4] + 2 * rgba[i * 4 + 1] + rgba[i * 4 + 2]) / 4;
    const fonte = new z.RGBLuminanceSource(cinza, width, height);
    const leitor = new z.MultiFormatReader();
    const dicas = new Map([[z.DecodeHintType.POSSIBLE_FORMATS, [z.BarcodeFormat.EAN_13]], [z.DecodeHintType.TRY_HARDER, true]]);
    const binario = new z.BinaryBitmap(new z.HybridBinarizer(fonte));
    return extrairPlu(leitor.decode(binario, dicas).getText());
}

function interpretarTexto(texto) {
    const peso = texto.match(/\b(?:PESO|[HP]ES[OU])\s*[:;,.]?\s*[|!]?\s*(\d+\s*[,.]\s*\d+)/i);
    const validade = texto.match(/\bVALIDADE\s*[:;]?\s*(\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*(?:\d{4}|\d{2}))(?!\d)/i);
    return {
        peso: peso ? peso[1].replace(/\s/g, '').replace('.', ',') + ' kg' : '',
        validade: validade ? validade[1].replace(/\s/g, '') : '',
    };
}

function recortar(x, y, largura, altura, escala = 1) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(largura * escala));
    c.height = Math.max(1, Math.round(altura * escala));
    c.getContext('2d').drawImage(imagem, x, y, largura, altura, 0, 0, c.width, c.height);
    return c;
}

async function lerTexto(area, procurarCodigo) {
    const t = await carregarScript('https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js', 'Tesseract');
    const worker = await t.createWorker('eng');
    try {
        const escala = Math.max(1, Math.min(3, 1500 / area.largura));
        const alturaTitulo = area.altura * .22;
        await worker.setParameters({ tessedit_pageseg_mode: '7' });
        const titulo = await worker.recognize(recortar(area.x, area.y, area.largura, alturaTitulo, escala));
        await worker.setParameters({ tessedit_pageseg_mode: '6' });
        const campos = await worker.recognize(recortar(area.x, area.y + alturaTitulo, area.largura, area.altura * .36, escala));
        let plu = '';
        if (procurarCodigo) {
            await worker.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: '0123456789' });
            for (const [offsetX, offsetY, largura] of [[.007,.85,.5],[0,.82,.53],[0,.88,.54]]){
                const digitos = recortar(area.x + area.largura * offsetX, area.y + area.altura * offsetY,
                    area.largura * largura, Math.min(imagem.height - area.y - area.altura * offsetY, area.altura * (1.02 - offsetY)), escala * 1.4);
                const leitura = await worker.recognize(digitos);
                plu = extrairPlu(leitura.data.text.replace(/\s/g, ''));
                if (plu) break;
            }
        }
        return { titulo: titulo.data.text.trim(), ...interpretarTexto(campos.data.text), plu };
    } finally {
        await worker.terminate();
    }
}

function desenhar() {
    contexto.drawImage(imagem, 0, 0);
    if (!area) return;
    contexto.strokeStyle = '#0665ff';
    contexto.lineWidth = previa.width / 200;
    contexto.strokeRect(area.x, area.y, area.largura, area.altura);
}

$('anexarFoto').onclick = () => $('fotoDialogo').showModal();
$('fotoArquivo').onchange = async e => {
    const arquivo = e.target.files[0];
    if (!arquivo || ocupado) return;
    e.target.value = '';
    try {
        const nova = await createImageBitmap(arquivo);
        imagem?.close();
        imagem = nova;
        previa.width = imagem.width;
        previa.height = imagem.height;
        previa.hidden = false;
        area = null;
        $('lerFoto').disabled = true;
        desenhar();
        estado.textContent = 'Marque a primeira etiqueta na foto.';
    } catch {
        estado.textContent = 'Não foi possível abrir essa foto. Tente JPEG ou PNG.';
    }
};

function ponto(e) {
    const r = previa.getBoundingClientRect();
    return [
        Math.min(previa.width, Math.max(0, (e.clientX - r.left) * previa.width / r.width)),
        Math.min(previa.height, Math.max(0, (e.clientY - r.top) * previa.height / r.height)),
    ];
}
previa.onpointerdown = e => {
    if (ocupado || !formulario.hidden) return;
    inicio = ponto(e);
    previa.setPointerCapture(e.pointerId);
};
previa.onpointermove = e => {
    if (!inicio) return;
    const [x, y] = ponto(e);
    area = {x: Math.min(x, inicio[0]), y: Math.min(y, inicio[1]), largura: Math.abs(x - inicio[0]), altura: Math.abs(y - inicio[1])};
    desenhar();
};
previa.onpointerup = previa.onpointercancel = () => {
    inicio = null;
    $('lerFoto').disabled = !area || area.largura < 30 || area.altura < 20;
};

$('lerFoto').onclick = async () => {
    ocupado = true;
    $('lerFoto').disabled = $('fotoArquivo').disabled = true;
    estado.textContent = 'Lendo a etiqueta…';
    try {
        const {x, y, largura, altura} = area;
        const barras = await lerBarras(recortar(x, y, largura, altura)).catch(() => '');
        const produto = await lerTexto(area, !barras).catch(() => null) || {};
        formulario.elements.titulo.value = produto.titulo || '';
        formulario.elements.peso.value = produto.peso || '';
        formulario.elements.validade.value = produto.validade || '';
        formulario.elements.plu.value = barras || produto.plu || '';
        formulario.hidden = false;
        estado.textContent = formulario.elements.plu.value && produto.titulo && produto.peso
            ? 'Confira o título, o peso, o PLU e a validade.' : 'A leitura ficou incompleta. Preencha ou corrija os campos olhando a etiqueta.';
        formulario.elements.titulo.focus();
    } finally {
        ocupado = false;
        $('fotoArquivo').disabled = false;
    }
};

function limparLeitura() {
    formulario.reset();
    formulario.hidden = true;
    area = null;
    desenhar();
    estado.textContent = 'Marque outra etiqueta ou revise as que já guardou.';
}
$('descartarFotoProduto').onclick = limparLeitura;
formulario.onsubmit = e => {
    e.preventDefault();
    const p = Object.fromEntries(new FormData(formulario));
    guardadas.push([
        p.titulo.trim(), 'PLU: ' + p.plu.trim(),
        p.peso.trim() ? 'Peso: ' + p.peso.trim() : '',
        p.validade.trim() ? 'Validade: ' + p.validade.trim() : '',
    ].filter(Boolean).join('\n'));
    const item = document.createElement('li');
    item.textContent = (p.titulo.trim() || 'Etiqueta') + ' · PLU ' + p.plu;
    $('fotoLista').append(item);
    $('revisarFotos').disabled = false;
    limparLeitura();
};
$('revisarFotos').onclick = () => {
    $('fotoDialogo').close();
    const texto = $('textoEtiquetas');
    texto.value = guardadas.join('\n\n');
    guardadas.length = 0;
    $('fotoLista').replaceChildren();
    $('revisarFotos').disabled = true;
    $('dialogoTexto').showModal();
    $('formTexto').requestSubmit($('formTexto').querySelector('[value="revisar"]'));
};
