# GERADOR_EAN_PLU

Gerador de folhas de etiquetas EAN-13, EAN-8 e PLU para uso no navegador. Inclui catálogo local, prévia, importação de Word e PDF com texto selecionável e exportação em PDF e Word editável.

## Arquivos do site

- `index.html` abre a interface.
- `style.css` define o visual.
- `app.js` contém o gerador e a exportação.
- `import.js` e `pdf.worker.min.mjs` fazem a leitura de documentos.

## Publicação

Coloque o conteúdo desta pasta na raiz do repositório `GERADOR_EAN_PLU`. Em **Settings → Pages**, selecione **Deploy from a branch**, a branch `main` e a pasta `/(root)`. Confira a execução em **Actions** e abra a URL mostrada em **Settings → Pages**.

O GitHub Pages pode disponibilizar o gerador publicamente. Este pacote inclui somente os arquivos do aplicativo. O catálogo é salvo no navegador e os documentos importados são processados nele.
