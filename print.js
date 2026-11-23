const imprimir = document.getElementById('imprimir');
const baixarPdf = document.getElementById('pdf');
const editor = document.getElementById('layout');
const atualizar = () => { imprimir.disabled = baixarPdf.disabled; };

new MutationObserver(atualizar).observe(baixarPdf, {
    attributes: true,
    attributeFilter: ['disabled'],
});
atualizar();

imprimir.addEventListener('click', () => {
    const editorAberto = editor.getAttribute('aria-expanded') === 'true';
    if (editorAberto) editor.click();
    try {
        window.print();
    } finally {
        if (editorAberto) editor.click();
    }
});
