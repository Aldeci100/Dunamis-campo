// =====================================
// MÓDULO NAVIOS (acesso: financeiro) — cadastro de embarcações
// e vendas de mercadoria/serviço por navio
// =====================================

(async function () {
const ok = await exigirPapel(["financeiro"]);
if (!ok) return;

const COLECAO = "navios";
const COLECAO_VENDAS = "vendas_navio";

const listaEl = document.getElementById("listaNavios");
const modal = document.getElementById("modalNavio");
const form = document.getElementById("formNavio");
const btnExcluir = document.getElementById("btnExcluirNavio");

const rotuloTipoVenda = { mercadoria: "Mercadoria", servico: "Serviço" };
const rotuloPagamento = { pendente: "Pendente", pago: "Pago" };

let naviosCache = [];
let vendasCache = [];
let navioVendasAtual = null;

function formatarMoeda(valor) {
    return (valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarDataIso(iso) {
    if (!iso) return "";
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
}

function totalVendasNavio(navioId) {
    return vendasCache
        .filter((v) => v.navioId === navioId)
        .reduce((soma, v) => soma + (Number(v.valorTotal) || 0), 0);
}

function renderizarNavios() {
    if (!naviosCache.length) {
        listaEl.innerHTML = '<div class="vazio">Nenhum navio cadastrado ainda.<br>Toque no + para adicionar.</div>';
        return;
    }

    const navios = naviosCache.slice().sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

    listaEl.innerHTML = navios.map((n) => `
        <div class="item" data-id="${n.id}">
            <div class="linha-topo">
                <div>
                    <div class="nome">${n.nome}</div>
                    <div class="sub">${n.armador || ""}${n.tipo ? " · " + n.tipo : ""}${n.porto ? " · " + n.porto : ""}</div>
                </div>
                <span class="selo selo-andamento">${formatarMoeda(totalVendasNavio(n.id))}</span>
            </div>
            <div class="linha-2" style="margin-top:10px;">
                <button type="button" class="btn-secundaria btn-editar-navio" data-id="${n.id}">✏️ Editar</button>
                <button type="button" class="btn-secundaria btn-vendas" data-id="${n.id}">💰 Vendas</button>
            </div>
        </div>
    `).join("");

    listaEl.querySelectorAll(".btn-editar-navio").forEach((btn) => {
        btn.addEventListener("click", () => abrirEdicao(naviosCache.find((n) => n.id === btn.dataset.id)));
    });

    listaEl.querySelectorAll(".btn-vendas").forEach((btn) => {
        btn.addEventListener("click", () => abrirModalVendas(naviosCache.find((n) => n.id === btn.dataset.id)));
    });
}

function abrirNovo() {
    form.reset();
    document.getElementById("navioId").value = "";
    document.getElementById("tituloModalNavio").textContent = "Novo navio";
    btnExcluir.style.display = "none";
    modal.style.display = "flex";
}

function abrirEdicao(navio) {
    if (!navio) return;
    document.getElementById("navioId").value = navio.id;
    document.getElementById("navioNome").value = navio.nome || "";
    document.getElementById("navioArmador").value = navio.armador || "";
    document.getElementById("navioTipo").value = navio.tipo || "";
    document.getElementById("navioPorto").value = navio.porto || "";
    document.getElementById("navioObservacoes").value = navio.observacoes || "";
    document.getElementById("tituloModalNavio").textContent = "Editar navio";
    btnExcluir.style.display = papelUsuario === "admin" ? "block" : "none";
    modal.style.display = "flex";
}

function fecharModal() {
    modal.style.display = "none";
}

document.getElementById("btnNovoNavio").addEventListener("click", abrirNovo);
document.getElementById("btnCancelarNavio").addEventListener("click", fecharModal);
modal.addEventListener("click", (e) => { if (e.target === modal) fecharModal(); });

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("navioId").value || null;
    const dados = {
        nome: document.getElementById("navioNome").value.trim(),
        armador: document.getElementById("navioArmador").value.trim(),
        tipo: document.getElementById("navioTipo").value.trim(),
        porto: document.getElementById("navioPorto").value.trim(),
        observacoes: document.getElementById("navioObservacoes").value.trim(),
    };

    await salvarDocumento(COLECAO, dados, id);
    fecharModal();
});

btnExcluir.addEventListener("click", async () => {
    const id = document.getElementById("navioId").value;
    if (!id) return;
    if (!confirm("Excluir este navio? As vendas já lançadas não serão apagadas.")) return;
    await removerDocumento(COLECAO, id);
    fecharModal();
});

// ---------- Vendas ----------

const modalVendas = document.getElementById("modalVendas");
const formVenda = document.getElementById("formVenda");
const listaVendasEl = document.getElementById("listaVendasNavio");
const vendasTotalEl = document.getElementById("vendasTotal");

function abrirModalVendas(navio) {
    if (!navio) return;
    navioVendasAtual = navio;
    document.getElementById("vendasNomeNavio").textContent = navio.nome;
    formVenda.reset();
    document.getElementById("vendaId").value = "";
    document.getElementById("vendaQuantidade").value = "1";
    document.getElementById("vendaData").value = new Date().toISOString().slice(0, 10);
    renderizarVendas();
    modalVendas.style.display = "flex";
}

function renderizarVendas() {
    if (!navioVendasAtual) return;

    const vendas = vendasCache
        .filter((v) => v.navioId === navioVendasAtual.id)
        .sort((a, b) => (b.data || "").localeCompare(a.data || ""));

    vendasTotalEl.textContent = formatarMoeda(totalVendasNavio(navioVendasAtual.id));

    listaVendasEl.innerHTML = vendas.length
        ? vendas.map((v) => `
            <div class="item" data-id="${v.id}">
                <div class="linha-topo">
                    <div>
                        <div class="nome">${v.descricao}</div>
                        <div class="sub">${rotuloTipoVenda[v.tipo] || v.tipo} · ${v.quantidade} × ${formatarMoeda(v.valorUnitario)} · ${formatarDataIso(v.data)}</div>
                    </div>
                    <span class="selo ${v.statusPagamento === "pago" ? "selo-ativo" : "selo-afastado"}">${formatarMoeda(v.valorTotal)}</span>
                </div>
                <div class="sub" style="margin-top:6px;">Pagamento: ${rotuloPagamento[v.statusPagamento] || v.statusPagamento}</div>
                ${papelUsuario === "admin" ? `<button type="button" class="btn-perigo btn-excluir-venda" data-id="${v.id}" style="margin-top:8px;padding:8px 12px;font-size:12px;">Excluir</button>` : ""}
            </div>
        `).join("")
        : '<div class="vazio">Nenhuma venda lançada ainda.</div>';

    listaVendasEl.querySelectorAll(".btn-excluir-venda").forEach((btn) => {
        btn.addEventListener("click", async () => {
            if (!confirm("Excluir esta venda?")) return;
            await removerDocumento(COLECAO_VENDAS, btn.dataset.id);
        });
    });
}

document.getElementById("btnCancelarVenda").addEventListener("click", () => {
    modalVendas.style.display = "none";
});
modalVendas.addEventListener("click", (e) => { if (e.target === modalVendas) modalVendas.style.display = "none"; });

formVenda.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!navioVendasAtual) return;

    const quantidade = Number(document.getElementById("vendaQuantidade").value) || 0;
    const valorUnitario = Number(document.getElementById("vendaValorUnitario").value) || 0;

    await salvarDocumento(COLECAO_VENDAS, {
        navioId: navioVendasAtual.id,
        tipo: document.getElementById("vendaTipo").value,
        descricao: document.getElementById("vendaDescricao").value.trim(),
        quantidade,
        valorUnitario,
        valorTotal: quantidade * valorUnitario,
        data: document.getElementById("vendaData").value,
        statusPagamento: document.getElementById("vendaStatusPagamento").value,
    });

    formVenda.reset();
    document.getElementById("vendaQuantidade").value = "1";
    document.getElementById("vendaData").value = new Date().toISOString().slice(0, 10);
});

observarColecao(COLECAO, (navios) => {
    naviosCache = navios;
    renderizarNavios();
});

observarColecao(COLECAO_VENDAS, (vendas) => {
    vendasCache = vendas;
    renderizarNavios();
    if (modalVendas.style.display === "flex") renderizarVendas();
});

})();
