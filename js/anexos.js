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
                <a href="${a.url}" target="_blank" rel="noopener" class="btn-secundaria" style="text-align:center;text-decoration:none;line-height:2.2;">Abrir</a>
                <button type="button" class="btn-perigo btn-excluir-anexo" data-id="${a.id}">Excluir</button>
            </div>
        </div>
    `).join("");
}
