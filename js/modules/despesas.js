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

const TIPOS_FIXOS = {
    material: "Material",
    transporte: "Transporte",
    aluguel: "Aluguel",
    agua: "Água",
    luz: "Luz",
    outros: "Outros",
};

const selectTipo = document.getElementById("despesaTipo");

let obrasCache = [];
let despesasCache = [];
let tiposCustomCache = [];
let anexosCache = [];
let despesaAnexosAtual = null;

function rotuloTipo(tipo) {
    if (TIPOS_FIXOS[tipo]) return TIPOS_FIXOS[tipo];
    const custom = tiposCustomCache.find((t) => t.id === tipo);
    return custom ? custom.nome : tipo;
}

function gerarSlugTipo(nome) {
    return nome
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function preencherSelectTipo() {
    const atual = selectTipo.value;

    const opcoesFixas = Object.entries(TIPOS_FIXOS)
        .map(([valor, rotulo]) => `<option value="${valor}">${rotulo}</option>`)
        .join("");

    const opcoesCustom = tiposCustomCache
        .slice()
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map((t) => `<option value="${t.id}">${t.nome}</option>`)
        .join("");

    selectTipo.innerHTML = opcoesFixas + opcoesCustom +
        '<option value="__novo__">+ Adicionar novo tipo...</option>';

    selectTipo.value = atual || "material";
}

selectTipo.addEventListener("change", async () => {
    if (selectTipo.value !== "__novo__") return;

    const nome = prompt("Nome do novo tipo de despesa (ex: Combustível, Ferramentas):");
    selectTipo.value = "material";

    const nomeLimpo = (nome || "").trim();
    if (!nomeLimpo) return;

    const slug = gerarSlugTipo(nomeLimpo);
    if (!slug) return;

    const existeFixo = TIPOS_FIXOS[slug];
    const existeCustom = tiposCustomCache.find((t) => t.id === slug);

    if (!existeFixo && !existeCustom) {
        tiposCustomCache.push({ id: slug, nome: nomeLimpo });
        preencherSelectTipo();
        await salvarDocumento("tiposDespesa", { nome: nomeLimpo }, slug);
    }

    selectTipo.value = slug;
});

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
                    <div class="nome">${d.descricao || rotuloTipo(d.tipo)}</div>
                    <div class="sub">${nomeObra(d.obraId)} · ${formatarData(d.data)}</div>
                </div>
                <span class="selo selo-andamento">${formatarMoeda(d.valor)}</span>
            </div>
            ${d.observacao ? `<div class="sub" style="margin-top:8px;">${d.observacao}</div>` : ""}
            <div class="linha-2" style="margin-top:10px;">
                <button type="button" class="btn-secundaria btn-anexos" data-id="${d.id}">📎 Anexos</button>
            </div>
        </div>
    `).join("");

    listaEl.querySelectorAll(".item").forEach((el) => {
        el.addEventListener("click", () => abrirEdicao(despesasCache.find((d) => d.id === el.dataset.id)));
    });

    listaEl.querySelectorAll(".btn-anexos").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            abrirModalAnexos(despesasCache.find((d) => d.id === btn.dataset.id));
        });
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
    document.getElementById("despesaObs").value = d.observacao || "";
    document.getElementById("tituloModalDespesa").textContent = "Editar despesa";
    btnExcluir.style.display = papeisUsuario.includes("admin") ? "block" : "none";
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
        observacao: document.getElementById("despesaObs").value.trim(),
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

// ---------- Anexos (comprovante, nota fiscal) ----------

const modalAnexos = document.getElementById("modalAnexos");
const formAnexo = document.getElementById("formAnexo");
const listaAnexosEl = document.getElementById("listaAnexosDespesa");
const btnEnviarAnexo = document.getElementById("btnEnviarAnexo");

function abrirModalAnexos(despesa) {
    if (!despesa) return;
    despesaAnexosAtual = despesa;
    document.getElementById("anexosNomeDespesa").textContent = despesa.descricao || rotuloTipo(despesa.tipo);
    formAnexo.reset();
    renderizarAnexos();
    modalAnexos.style.display = "flex";
}

function renderizarAnexos() {
    if (!despesaAnexosAtual) return;
    const anexos = anexosCache
        .filter((a) => a.entidadeTipo === "despesa" && a.entidadeId === despesaAnexosAtual.id)
        .sort((a, b) => (b.data || "").localeCompare(a.data || ""));

    listaAnexosEl.innerHTML = htmlListaAnexos(anexos);

    listaAnexosEl.querySelectorAll(".btn-abrir-anexo").forEach((btn) => {
        btn.addEventListener("click", () => {
            abrirAnexoVisualizacao(anexos.find((a) => a.id === btn.dataset.id));
        });
    });

    listaAnexosEl.querySelectorAll(".btn-excluir-anexo").forEach((btn) => {
        btn.addEventListener("click", async () => {
            if (!confirm("Excluir este anexo?")) return;
            const anexo = anexos.find((a) => a.id === btn.dataset.id);
            await excluirAnexo(anexo);
        });
    });
}

document.getElementById("btnFecharAnexos").addEventListener("click", () => {
    modalAnexos.style.display = "none";
});
modalAnexos.addEventListener("click", (e) => { if (e.target === modalAnexos) modalAnexos.style.display = "none"; });

formAnexo.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!despesaAnexosAtual) return;

    const arquivo = document.getElementById("anexoArquivo").files[0];
    if (!arquivo) return;

    btnEnviarAnexo.disabled = true;
    btnEnviarAnexo.textContent = "Enviando...";

    try {
        await enviarAnexo(
            "despesa",
            despesaAnexosAtual.id,
            arquivo,
            document.getElementById("anexoTipo").value,
            document.getElementById("anexoObservacao").value.trim()
        );
        formAnexo.reset();
    } catch (erro) {
        alert("Não foi possível enviar o anexo: " + erro.message);
    } finally {
        btnEnviarAnexo.disabled = false;
        btnEnviarAnexo.textContent = "Enviar anexo";
    }
});

observarColecao("obras", (obras) => {
    obrasCache = obras;
    preencherSelectsObra();
    renderizar();
});

observarColecao("tiposDespesa", (tipos) => {
    tiposCustomCache = tipos;
    preencherSelectTipo();
    renderizar();
});

observarColecao(COLECAO, (despesas) => {
    despesasCache = despesas;
    renderizar();
});

observarColecao("anexos", (l) => {
    anexosCache = l;
    if (modalAnexos.style.display === "flex") renderizarAnexos();
});

})();
