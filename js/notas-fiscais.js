// =====================================================
// NOTAS FISCAIS — usado em Obras e Navios
// =====================================================
// Diferente de anexos.js (que guarda o arquivo em si): aqui é só o
// registro financeiro da NF — valor, data de emissão e data de
// faturamento — pra planejamento e pro cálculo automático de
// faturamento mensal em Obrigações. Pra anexar o PDF da NF, use os
// Anexos (tipo "Nota fiscal") na mesma tela.

const COLECAO_NOTAS_FISCAIS = "notasFiscais";

function formatarDataNf(iso) {
    if (!iso) return "";
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
}

function formatarMoedaNf(valor) {
    return (valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function salvarNotaFiscal(entidadeTipo, entidadeId, dados, id) {
    return salvarDocumento(COLECAO_NOTAS_FISCAIS, {
        entidadeTipo,
        entidadeId,
        numero: dados.numero || "",
        valor: Number(dados.valor) || 0,
        dataEmissao: dados.dataEmissao || "",
        dataFaturamento: dados.dataFaturamento || "",
        observacao: dados.observacao || "",
        ...(id ? {} : { criadoEm: Date.now() }),
    }, id);
}

async function excluirNotaFiscal(id) {
    await removerDocumento(COLECAO_NOTAS_FISCAIS, id);
}

function htmlListaNotasFiscais(notas) {
    if (!notas.length) return '<div class="vazio">Nenhuma nota fiscal lançada ainda.</div>';

    return notas.map((n) => `
        <div class="item" data-id="${n.id}">
            <div class="linha-topo">
                <div>
                    <div class="nome">${n.numero ? "NF " + n.numero : "Nota fiscal"}</div>
                    <div class="sub">
                        Faturamento: ${formatarDataNf(n.dataFaturamento) || "—"}
                        ${n.dataEmissao ? " · Emissão: " + formatarDataNf(n.dataEmissao) : ""}
                    </div>
                    ${n.observacao ? `<div class="sub">${n.observacao}</div>` : ""}
                </div>
                <span class="selo selo-andamento">${formatarMoedaNf(n.valor)}</span>
            </div>
            <div class="linha-2" style="margin-top:10px;">
                <button type="button" class="btn-secundaria btn-editar-nf" data-id="${n.id}">Editar</button>
                <button type="button" class="btn-perigo btn-excluir-nf" data-id="${n.id}">Excluir</button>
            </div>
        </div>
    `).join("");
}
