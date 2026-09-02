// =====================================================
// ANEXOS (notas fiscais, orçamentos) — usado em Obras e Navios
// =====================================================
// Na nuvem, o arquivo vai pro Firebase Storage e só a referência
// (nome, url, caminho) fica no Firestore, coleção "anexos".
//
// No modo local (sem Firebase configurado), não existe Storage —
// o arquivo é guardado como base64 dentro do próprio localStorage,
// só pra dar pra testar a tela. Arquivo grande pode estourar o
// limite do navegador nesse modo; na nuvem não tem esse problema.

const ROTULO_TIPO_ANEXO = {
    nota_fiscal: "Nota fiscal",
    orcamento: "Orçamento",
    outro: "Outro",
};

function enviarAnexo(entidadeTipo, entidadeId, arquivo, tipo, observacao) {
    const dadosComuns = {
        entidadeTipo,
        entidadeId,
        tipo,
        observacao: observacao || "",
        nomeArquivo: arquivo.name,
        data: new Date().toISOString().slice(0, 10),
    };

    if (!firebaseConfigurado) {
        return new Promise((resolve, reject) => {
            const leitor = new FileReader();
            leitor.onload = () => {
                salvarDocumento("anexos", { ...dadosComuns, url: leitor.result, caminhoStorage: null })
                    .then(resolve)
                    .catch(reject);
            };
            leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
            leitor.readAsDataURL(arquivo);
        });
    }

    const caminho = `anexos/${entidadeTipo}/${entidadeId}/${Date.now()}_${arquivo.name}`;
    const ref = firebase.storage().ref(caminho);
    return ref.put(arquivo)
        .then(() => ref.getDownloadURL())
        .then((url) => salvarDocumento("anexos", { ...dadosComuns, url, caminhoStorage: caminho }));
}

async function excluirAnexo(anexo) {
    if (firebaseConfigurado && anexo.caminhoStorage) {
        try {
            await firebase.storage().ref(anexo.caminhoStorage).delete();
        } catch (e) {
            // arquivo já pode ter sido removido do Storage, segue o jogo
        }
    }
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
