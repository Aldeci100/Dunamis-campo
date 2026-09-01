// =====================================
// MÓDULO SST (acesso: sst) — ASO, EPI, treinamentos, ocorrências
// =====================================

(async function () {
const ok = await exigirPapel(["sst"]);
if (!ok) return;

const ABAS = {
    aso: { colecao: "aso", modal: "modalAso", form: "formAso", titulo: "tituloModalAso", nomeNovo: "Novo ASO", nomeEditar: "Editar ASO" },
    epis: { colecao: "epis", modal: "modalEpi", form: "formEpi", titulo: "tituloModalEpi", nomeNovo: "Novo EPI", nomeEditar: "Editar EPI" },
    treinamentos: { colecao: "treinamentos", modal: "modalTreinamento", form: "formTreinamento", titulo: "tituloModalTreinamento", nomeNovo: "Novo treinamento", nomeEditar: "Editar treinamento" },
    ocorrencias: { colecao: "ocorrencias", modal: "modalOcorrencia", form: "formOcorrencia", titulo: "tituloModalOcorrencia", nomeNovo: "Nova ocorrência", nomeEditar: "Editar ocorrência" },
};

const listaEl = document.getElementById("listaSst");
const btnNovo = document.getElementById("btnNovoSst");

let abaAtual = "aso";
let funcionariosCache = [];
let obrasCache = [];
const cache = { aso: [], epis: [], treinamentos: [], ocorrencias: [] };

function nomeFuncionario(id) {
    const f = funcionariosCache.find((x) => x.id === id);
    return f ? f.nome : "Funcionário removido";
}

function nomeObra(id) {
    const o = obrasCache.find((x) => x.id === id);
    return o ? o.nome : "Obra removida";
}

function formatarData(iso) {
    if (!iso) return "";
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
}

function statusValidade(dataValidadeIso) {
    if (!dataValidadeIso) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const validade = new Date(dataValidadeIso + "T00:00:00");
    const diffDias = Math.round((validade - hoje) / 86400000);

    if (diffDias < 0) return { classe: "vencido", texto: "Vencido" };
    if (diffDias <= 30) return { classe: "vencendo", texto: `Vence em ${diffDias}d` };
    return { classe: "valido", texto: "Válido em " + formatarData(dataValidadeIso) };
}

function seloValidade(dataValidadeIso) {
    const status = statusValidade(dataValidadeIso);
    return status ? `<span class="selo selo-${status.classe}">${status.texto}</span>` : "";
}

const rotuloTipoAso = { admissional: "Admissional", periodico: "Periódico", demissional: "Demissional" };

function preencherSelectsFuncionario() {
    const opcoes = funcionariosCache
        .filter((f) => f.status === "ativo")
        .slice()
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map((f) => `<option value="${f.id}">${f.nome}</option>`)
        .join("");

    ["asoFuncionario", "epiFuncionario", "treinamentoFuncionario"].forEach((id) => {
        const el = document.getElementById(id);
        const atual = el.value;
        el.innerHTML = opcoes;
        el.value = atual;
    });

    const ocFunc = document.getElementById("ocorrenciaFuncionario");
    const atual = ocFunc.value;
    ocFunc.innerHTML = '<option value="">Não especificado</option>' + opcoes;
    ocFunc.value = atual;
}

function preencherSelectObra() {
    const opcoes = obrasCache
        .slice()
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map((o) => `<option value="${o.id}">${o.nome}</option>`)
        .join("");
    const el = document.getElementById("ocorrenciaObra");
    const atual = el.value;
    el.innerHTML = opcoes;
    el.value = atual;
}

function renderizar() {
    const itens = cache[abaAtual];

    if (!itens.length) {
        listaEl.innerHTML = '<div class="vazio">Nada cadastrado nessa aba ainda.<br>Toque no + para adicionar.</div>';
        return;
    }

    if (abaAtual === "aso") {
        const ordenados = itens.slice().sort((a, b) => (a.dataValidade || "9999").localeCompare(b.dataValidade || "9999"));
        listaEl.innerHTML = ordenados.map((r) => `
            <div class="item" data-id="${r.id}">
                <div class="linha-topo">
                    <div>
                        <div class="nome">${nomeFuncionario(r.funcionarioId)}</div>
                        <div class="sub">${rotuloTipoAso[r.tipo] || r.tipo} · exame em ${formatarData(r.dataRealizacao)}</div>
                    </div>
                    ${seloValidade(r.dataValidade)}
                </div>
            </div>
        `).join("");
    } else if (abaAtual === "epis") {
        const ordenados = itens.slice().sort((a, b) => (a.validade || "9999").localeCompare(b.validade || "9999"));
        listaEl.innerHTML = ordenados.map((r) => `
            <div class="item" data-id="${r.id}">
                <div class="linha-topo">
                    <div>
                        <div class="nome">${nomeFuncionario(r.funcionarioId)}</div>
                        <div class="sub">${r.item} · entregue em ${formatarData(r.dataEntrega)}</div>
                    </div>
                    ${seloValidade(r.validade)}
                </div>
            </div>
        `).join("");
    } else if (abaAtual === "treinamentos") {
        const ordenados = itens.slice().sort((a, b) => (a.dataValidade || "9999").localeCompare(b.dataValidade || "9999"));
        listaEl.innerHTML = ordenados.map((r) => `
            <div class="item" data-id="${r.id}">
                <div class="linha-topo">
                    <div>
                        <div class="nome">${nomeFuncionario(r.funcionarioId)}</div>
                        <div class="sub">${r.norma} · realizado em ${formatarData(r.dataRealizacao)}</div>
                    </div>
                    ${seloValidade(r.dataValidade)}
                </div>
            </div>
        `).join("");
    } else {
        const ordenados = itens.slice().sort((a, b) => (b.data || "").localeCompare(a.data || ""));
        listaEl.innerHTML = ordenados.map((r) => `
            <div class="item" data-id="${r.id}">
                <div class="linha-topo">
                    <div>
                        <div class="nome">${r.descricao}</div>
                        <div class="sub">${nomeObra(r.obraId)}${r.funcionarioId ? " · " + nomeFuncionario(r.funcionarioId) : ""} · ${formatarData(r.data)}</div>
                    </div>
                </div>
            </div>
        `).join("");
    }

    listaEl.querySelectorAll(".item").forEach((el) => {
        el.addEventListener("click", () => abrirEdicao(cache[abaAtual].find((r) => r.id === el.dataset.id)));
    });
}

function trocarAba(aba) {
    abaAtual = aba;
    document.querySelectorAll(".aba").forEach((b) => b.classList.toggle("ativa", b.dataset.aba === aba));
    renderizar();
}

document.querySelectorAll(".aba").forEach((botao) => {
    botao.addEventListener("click", () => trocarAba(botao.dataset.aba));
});

function fecharTodosModais() {
    Object.values(ABAS).forEach((cfg) => {
        document.getElementById(cfg.modal).style.display = "none";
    });
}

function abrirNovo() {
    fecharTodosModais();
    const cfg = ABAS[abaAtual];
    const form = document.getElementById(cfg.form);
    form.reset();
    form.querySelector('input[type="hidden"]').value = "";
    form.querySelectorAll(".btn-excluir").forEach((b) => (b.style.display = "none"));

    const campoData = form.querySelector('input[type="date"]:not([id*="Validade"])');
    if (campoData) campoData.value = new Date().toISOString().slice(0, 10);

    document.getElementById(cfg.titulo).textContent = cfg.nomeNovo;
    document.getElementById(cfg.modal).style.display = "flex";
}

function abrirEdicao(registro) {
    fecharTodosModais();
    const cfg = ABAS[abaAtual];
    const form = document.getElementById(cfg.form);
    form.reset();

    if (abaAtual === "aso") {
        document.getElementById("asoId").value = registro.id;
        document.getElementById("asoFuncionario").value = registro.funcionarioId || "";
        document.getElementById("asoTipo").value = registro.tipo || "admissional";
        document.getElementById("asoDataRealizacao").value = registro.dataRealizacao || "";
        document.getElementById("asoDataValidade").value = registro.dataValidade || "";
    } else if (abaAtual === "epis") {
        document.getElementById("epiId").value = registro.id;
        document.getElementById("epiFuncionario").value = registro.funcionarioId || "";
        document.getElementById("epiItem").value = registro.item || "";
        document.getElementById("epiDataEntrega").value = registro.dataEntrega || "";
        document.getElementById("epiValidade").value = registro.validade || "";
    } else if (abaAtual === "treinamentos") {
        document.getElementById("treinamentoId").value = registro.id;
        document.getElementById("treinamentoFuncionario").value = registro.funcionarioId || "";
        document.getElementById("treinamentoNorma").value = registro.norma || "";
        document.getElementById("treinamentoDataRealizacao").value = registro.dataRealizacao || "";
        document.getElementById("treinamentoDataValidade").value = registro.dataValidade || "";
    } else {
        document.getElementById("ocorrenciaId").value = registro.id;
        document.getElementById("ocorrenciaObra").value = registro.obraId || "";
        document.getElementById("ocorrenciaFuncionario").value = registro.funcionarioId || "";
        document.getElementById("ocorrenciaDescricao").value = registro.descricao || "";
        document.getElementById("ocorrenciaData").value = registro.data || "";
    }

    form.querySelectorAll(".btn-excluir").forEach((b) => (b.style.display = "block"));
    document.getElementById(cfg.titulo).textContent = cfg.nomeEditar;
    document.getElementById(cfg.modal).style.display = "flex";
}

btnNovo.addEventListener("click", abrirNovo);

document.querySelectorAll(".modal-fundo").forEach((modal) => {
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });
    modal.querySelector(".fechar-modal")?.addEventListener("click", () => (modal.style.display = "none"));
});

document.getElementById("formAso").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("asoId").value || null;
    await salvarDocumento("aso", {
        funcionarioId: document.getElementById("asoFuncionario").value,
        tipo: document.getElementById("asoTipo").value,
        dataRealizacao: document.getElementById("asoDataRealizacao").value,
        dataValidade: document.getElementById("asoDataValidade").value,
    }, id);
    fecharTodosModais();
});

document.getElementById("formEpi").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("epiId").value || null;
    await salvarDocumento("epis", {
        funcionarioId: document.getElementById("epiFuncionario").value,
        item: document.getElementById("epiItem").value.trim(),
        dataEntrega: document.getElementById("epiDataEntrega").value,
        validade: document.getElementById("epiValidade").value,
    }, id);
    fecharTodosModais();
});

document.getElementById("formTreinamento").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("treinamentoId").value || null;
    await salvarDocumento("treinamentos", {
        funcionarioId: document.getElementById("treinamentoFuncionario").value,
        norma: document.getElementById("treinamentoNorma").value.trim(),
        dataRealizacao: document.getElementById("treinamentoDataRealizacao").value,
        dataValidade: document.getElementById("treinamentoDataValidade").value,
    }, id);
    fecharTodosModais();
});

document.getElementById("formOcorrencia").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("ocorrenciaId").value || null;
    await salvarDocumento("ocorrencias", {
        obraId: document.getElementById("ocorrenciaObra").value,
        funcionarioId: document.getElementById("ocorrenciaFuncionario").value,
        descricao: document.getElementById("ocorrenciaDescricao").value.trim(),
        data: document.getElementById("ocorrenciaData").value,
    }, id);
    fecharTodosModais();
});

document.querySelectorAll(".btn-excluir").forEach((botao) => {
    botao.addEventListener("click", async () => {
        const cfg = ABAS[abaAtual];
        const id = document.getElementById(cfg.form).querySelector('input[type="hidden"]').value;
        if (!id) return;
        if (!confirm("Excluir este registro?")) return;
        await removerDocumento(cfg.colecao, id);
        fecharTodosModais();
    });
});

observarColecao("funcionarios", (lista) => {
    funcionariosCache = lista;
    preencherSelectsFuncionario();
});

observarColecao("obras", (lista) => {
    obrasCache = lista;
    preencherSelectObra();
    renderizar();
});

Object.keys(ABAS).forEach((aba) => {
    observarColecao(ABAS[aba].colecao, (lista) => {
        cache[aba] = lista;
        if (aba === abaAtual) renderizar();
    });
});

})();
