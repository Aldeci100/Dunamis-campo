// =====================================================
// ANEXOS (notas fiscais, orçamentos) — usado em Obras e Navios
// =====================================================
// Guarda o arquivo direto dentro do documento no Firestore, como
// base64 — não depende do Firebase Storage, que hoje só está
// disponível no plano pago (Blaze) do Firebase.
//
// Por causa disso tem um limite de tamanho: o Firestore não aceita
// documento maior que 1MB, e o base64 deixa o arquivo ~33% maior.
// Serve bem pra PDF de nota fiscal/orçamento simples ou foto com
// resolução baixa/média; não serve pra arquivo grande (vídeo, PDF
// com muitas páginas escaneadas em alta resolução etc.).

const TAMANHO_MAXIMO_ANEXO = 700 * 1024; // ~700KB de folga pro limite de 1MB do Firestore

const ROTULO_TIPO_ANEXO = {
    nota_fiscal: "Nota fiscal",
    orcamento: "Orçamento",
    outro: "Outro",
};

function enviarAnexo(entidadeTipo, entidadeId, arquivo, tipo, observacao) {
    if (arquivo.size > TAMANHO_MAXIMO_ANEXO) {
        return Promise.reject(new Error(
            `Arquivo de ${(arquivo.size / 1024).toFixed(0)}KB é maior que o limite de ` +
            `${(TAMANHO_MAXIMO_ANEXO / 1024).toFixed(0)}KB. Tente um PDF mais simples ou ` +
            `uma foto com resolução menor.`
        ));
    }

    return new Promise((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = () => {
            salvarDocumento("anexos", {
                entidadeTipo,
                entidadeId,
                tipo,
                observacao: observacao || "",
                nomeArquivo: arquivo.name,
                url: leitor.result,
                data: new Date().toISOString().slice(0, 10),
            }).then(resolve).catch(reject);
        };
        leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
        leitor.readAsDataURL(arquivo);
    });
}

async function excluirAnexo(anexo) {
    await removerDocumento("anexos", anexo.id);
}

// Não navega direto pro data: URL — Chrome/Edge bloqueiam navegação de
// página inteira pra data: URL por segurança (fica em branco, mesmo
// com o arquivo correto). Em vez disso abre uma página nova que
// exibe o conteúdo dentro de <img>/<iframe>, o que não é bloqueado.
function abrirAnexoVisualizacao(anexo) {
    const match = anexo.url.match(/^data:([^;]+);/);
    const mime = match ? match[1] : "";

    let corpo;
    if (mime.startsWith("image/")) {
        corpo = `<img src="${anexo.url}" alt="${anexo.nomeArquivo}">`;
    } else if (mime === "application/pdf") {
        corpo = `<iframe src="${anexo.url}"></iframe>`;
    } else {
        corpo = `<p>Não dá pra pré-visualizar esse tipo de arquivo aqui.</p>
                 <a href="${anexo.url}" download="${anexo.nomeArquivo}">Baixar ${anexo.nomeArquivo}</a>`;
    }

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${anexo.nomeArquivo}</title>
<style>
  body { margin: 0; background: #111; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  img { max-width: 100%; max-height: 100vh; display: block; }
  iframe { width: 100vw; height: 100vh; border: none; }
  p, a { color: #fff; font-family: system-ui, sans-serif; text-align: center; }
</style>
</head>
<body>${corpo}</body>
</html>`;

    const janela = window.open("", "_blank");
    if (!janela) {
        alert("Não foi possível abrir o anexo. Verifique se o navegador bloqueou o pop-up.");
        return;
    }
    janela.document.write(html);
    janela.document.close();
}

function htmlListaAnexos(anexos) {
    if (!anexos.length) return '<div class="vazio">Nenhum anexo ainda.</div>';

    return anexos.map((a) => `
        <div class="item">
            <div class="linha-topo">
                <div>
                    <div class="nome">${a.nomeArquivo}</div>
                    <div class="sub">${ROTULO_TIPO_ANEXO[a.tipo] || a.tipo}${a.observacao ? " · " + a.observacao : ""}</div>
                </div>
            </div>
            <div class="linha-2" style="margin-top:10px;">
                <button type="button" class="btn-secundaria btn-abrir-anexo" data-id="${a.id}">Abrir</button>
                <button type="button" class="btn-perigo btn-excluir-anexo" data-id="${a.id}">Excluir</button>
            </div>
        </div>
    `).join("");
}
