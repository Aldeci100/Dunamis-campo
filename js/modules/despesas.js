// =====================================
// MÓDULO DESPESAS (acesso: financeiro) — gastos por obra
// =====================================

(async function () {
const ok = await exigirPapel(["financeiro"]);
if (!ok) return;

const COLECAO = "despesas";

const listaEl = document.getElementById("listaDespesas");
const modal = document.getElementById("modalDespesa");
const form = document.getElementById("formDespesa");
const btnExcluir = document.getElementById("btnExcluirDespesa");
const filtroObra = document.getElementById("filtroObra");
const selectObraModal = document.getElementById("despesaObra");
const totalFiltradoEl = document.getElementById("totalFiltrado");

const rotuloTipo = {
    material: "Material",
    transporte: "Transporte",
    aluguel: "Aluguel",
    agua: "Água",
    luz: "Luz",
    outros: "Outros",
};

let obrasCache = [];
let despesasCache = [];

function formatarMoeda(valor) {
    return (valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso) {
    if (!iso) return "";
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
}

function nomeObra(obraId) {
    const obra = obrasCache.find((o) => o.id === obraId);
    return obra ? obra.nome : "Obra removida";
}

function preencherSelectsObra() {
    const opcoes = obrasCache
        .slice()
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map((o) => `<option value="${o.id}">${o.nome}</option>`)
        .join("");

    const filtroAtual = filtroObra.value;
    filtroObra.innerHTML = '<option value="">Todas as obras</option>' + opcoes;
    filtroObra.value = filtroAtual;

    const modalAtual = selectObraModal.value;
    selectObraModal.innerHTML = '<option value="">Selecione a obra</option>' + opcoes;
    selectObraModal.value = modalAtual;
}

function renderizar() {
    const filtradas = filtroObra.value
        ? despesasCache.filter((d) => d.obraId === filtroObra.value)
        : despesasCache;

    const total = filtradas.reduce((soma, d) => soma + (Number(d.valor) || 0), 0);
    totalFiltradoEl.textContent = formatarMoeda(total);

    if (!filtradas.length) {
        listaEl.innerHTML = '<div class="vazio">Nenhuma despesa lançada ainda.<br>Toque no + para lançar a primeira.</div>';
        return;
    }

    const ordenadas = filtradas.slice().sort((a, b) => (b.data || "").localeCompare(a.data || ""));

    listaEl.innerHTML = ordenadas.map((d) => `
        <div class="item" data-id="${d.id}">
            <div class="linha-topo">
                <div>
                    <div class="nome">${d.descricao || rotuloTipo[d.tipo] || d.tipo}</div>
                    <div class="sub">${nomeObra(d.obraId)} · ${formatarData(d.data)}</div>
                </div>
                <span class="selo selo-andamento">${formatarMoeda(d.valor)}</span>
            </div>
        </div>
    `).join("");

    listaEl.querySelectorAll(".item").forEach((el) => {
        el.addEventListener("click", () => abrirEdicao(despesasCache.find((d) => d.id === el.dataset.id)));
    });
}

function abrirNovo() {
    form.reset();
    document.getElementById("despesaId").value = "";
    document.getElementById("despesaData").value = new Date().toISOString().slice(0, 10);
    if (filtroObra.value) selectObraModal.value = filtroObra.value;
    document.getElementById("tituloModalDespesa").textContent = "Nova despesa";
    btnExcluir.style.display = "none";
    modal.style.display = "flex";
}

function abrirEdicao(d) {
    document.getElementById("despesaId").value = d.id;
    selectObraModal.value = d.obraId || "";
    document.getElementById("despesaTipo").value = d.tipo || "material";
    document.getElementById("despesaDescricao").value = d.descricao || "";
    document.getElementById("despesaValor").value = d.valor ?? "";
    document.getElementById("despesaData").value = d.data || "";
    document.getElementById("tituloModalDespesa").textContent = "Editar despesa";
    btnExcluir.style.display = papelUsuario === "admin" ? "block" : "none";
    modal.style.display = "flex";
}

function fecharModal() {
    modal.style.display = "none";
}

document.getElementById("btnNovaDespesa").addEventListener("click", abrirNovo);
document.getElementById("btnCancelarDespesa").addEventListener("click", fecharModal);
modal.addEventListener("click", (e) => { if (e.target === modal) fecharModal(); });
filtroObra.addEventListener("change", renderizar);

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("despesaId").value || null;
    const dados = {
        obraId: selectObraModal.value,
        tipo: document.getElementById("despesaTipo").value,
        descricao: document.getElementById("despesaDescricao").value.trim(),
        valor: Number(document.getElementById("despesaValor").value) || 0,
        data: document.getElementById("despesaData").value,
    };

    await salvarDocumento(COLECAO, dados, id);
    fecharModal();
});

btnExcluir.addEventListener("click", async () => {
    const id = document.getElementById("despesaId").value;
    if (!id) return;
    if (!confirm("Excluir esta despesa?")) return;
    await removerDocumento(COLECAO, id);
    fecharModal();
});

observarColecao("obras", (obras) => {
    obrasCache = obras;
    preencherSelectsObra();
    renderizar();
});

observarColecao(COLECAO, (despesas) => {
    despesasCache = despesas;
    renderizar();
});

})();
