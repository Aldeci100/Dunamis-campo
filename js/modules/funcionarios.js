// =====================================
// MÓDULO FUNCIONÁRIOS (acesso: rh)
// =====================================

(async function () {
const ok = await exigirPapel(["rh"]);
if (!ok) return;

const COLECAO = "funcionarios";
const JORNADA_MENSAL_HORAS = 220; // divisor padrão CLT (jornada de 44h/semana)

const listaEl = document.getElementById("listaFuncionarios");
const modal = document.getElementById("modalFuncionario");
const form = document.getElementById("formFuncionario");
const btnExcluir = document.getElementById("btnExcluirFuncionario");
const selectObra = document.getElementById("funcObra");
const campoSalario = document.getElementById("funcSalario");
const campoCustoHora = document.getElementById("funcCustoHora");

const rotuloStatus = { ativo: "Ativo", afastado: "Afastado", inativo: "Inativo" };

function formatarMoeda(valor) {
    return (valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

let obrasCache = [];

function renderizarFuncionarios(funcionarios) {
    if (!funcionarios.length) {
        listaEl.innerHTML = '<div class="vazio">Nenhum funcionário cadastrado ainda.<br>Toque no + para adicionar.</div>';
        return;
    }

    funcionarios.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

    listaEl.innerHTML = funcionarios.map((f) => {
        const obra = obrasCache.find((o) => o.id === f.obraAtualId);
        const beneficios = [];
        if (f.beneficios?.valeTransporte) beneficios.push("VT");
        if (f.beneficios?.valeAlimentacao) beneficios.push("VA");

        return `
        <div class="item" data-id="${f.id}">
            <div class="linha-topo">
                <div>
                    <div class="nome">${f.nome}</div>
                    <div class="sub">${f.cargo || ""}${obra ? " · " + obra.nome : " · sem obra"}</div>
                </div>
                <span class="selo selo-${f.status}">${rotuloStatus[f.status] || f.status}</span>
            </div>
            ${beneficios.length ? `<div class="sub" style="margin-top:8px;">Benefícios: ${beneficios.join(", ")}</div>` : ""}
            ${f.custoHora ? `<div class="sub">${f.salario ? "Salário: " + formatarMoeda(f.salario) + " · " : ""}Custo/hora: ${formatarMoeda(f.custoHora)}</div>` : ""}
        </div>`;
    }).join("");

    listaEl.querySelectorAll(".item").forEach((el) => {
        el.addEventListener("click", () => abrirEdicao(funcionarios.find((f) => f.id === el.dataset.id)));
    });
}

function preencherSelectObras() {
    const atual = selectObra.value;
    selectObra.innerHTML = '<option value="">Sem obra no momento</option>' +
        obrasCache
            .filter((o) => o.status === "andamento" || o.status === "planejada")
            .map((o) => `<option value="${o.id}">${o.nome}</option>`)
            .join("");
    selectObra.value = atual;
}

function atualizarCustoHora() {
    const salario = Number(campoSalario.value);
    if (salario > 0) {
        campoCustoHora.value = (salario / JORNADA_MENSAL_HORAS).toFixed(2);
        campoCustoHora.readOnly = true;
    } else {
        campoCustoHora.readOnly = false;
    }
}

campoSalario.addEventListener("input", atualizarCustoHora);

function abrirNovo() {
    form.reset();
    document.getElementById("funcId").value = "";
    document.getElementById("tituloModalFuncionario").textContent = "Novo funcionário";
    btnExcluir.style.display = "none";
    campoCustoHora.readOnly = false;
    modal.style.display = "flex";
}

function abrirEdicao(f) {
    document.getElementById("funcId").value = f.id;
    document.getElementById("funcNome").value = f.nome || "";
    document.getElementById("funcCpf").value = f.cpf || "";
    document.getElementById("funcTelefone").value = f.telefone || "";
    document.getElementById("funcCargo").value = f.cargo || "";
    document.getElementById("funcAdmissao").value = f.dataAdmissao || "";
    document.getElementById("funcObra").value = f.obraAtualId || "";
    document.getElementById("funcStatus").value = f.status || "ativo";
    document.getElementById("funcPin").value = f.pin || "";
    campoSalario.value = f.salario ?? "";
    campoCustoHora.value = f.custoHora ?? "";
    atualizarCustoHora();
    document.getElementById("funcValeTransporte").checked = !!f.beneficios?.valeTransporte;
    document.getElementById("funcValeAlimentacao").checked = !!f.beneficios?.valeAlimentacao;
    document.getElementById("funcMotivoExclusao").value = f.beneficios?.motivoExclusao || "";
    document.getElementById("tituloModalFuncionario").textContent = "Editar funcionário";
    btnExcluir.style.display = papelUsuario === "admin" ? "block" : "none";
    modal.style.display = "flex";
}

function fecharModal() {
    modal.style.display = "none";
}

document.getElementById("btnNovoFuncionario").addEventListener("click", abrirNovo);
document.getElementById("btnCancelarFuncionario").addEventListener("click", fecharModal);
modal.addEventListener("click", (e) => { if (e.target === modal) fecharModal(); });

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const pin = document.getElementById("funcPin").value.trim();
    if (pin && !/^\d{4}$/.test(pin)) {
        alert("O PIN de ponto deve ter exatamente 4 dígitos, ou ficar em branco.");
        return;
    }

    const id = document.getElementById("funcId").value || null;
    const dados = {
        nome: document.getElementById("funcNome").value.trim(),
        cpf: document.getElementById("funcCpf").value.trim(),
        telefone: document.getElementById("funcTelefone").value.trim(),
        cargo: document.getElementById("funcCargo").value.trim(),
        dataAdmissao: document.getElementById("funcAdmissao").value,
        obraAtualId: document.getElementById("funcObra").value,
        status: document.getElementById("funcStatus").value,
        pin,
        salario: Number(campoSalario.value) || 0,
        custoHora: Number(campoCustoHora.value) || 0,
        beneficios: {
            valeTransporte: document.getElementById("funcValeTransporte").checked,
            valeAlimentacao: document.getElementById("funcValeAlimentacao").checked,
            motivoExclusao: document.getElementById("funcMotivoExclusao").value.trim(),
        },
    };

    await salvarDocumento(COLECAO, dados, id);
    fecharModal();
});

btnExcluir.addEventListener("click", async () => {
    const id = document.getElementById("funcId").value;
    if (!id) return;
    if (!confirm("Excluir este funcionário? O histórico de ponto dele não será apagado.")) return;
    await removerDocumento(COLECAO, id);
    fecharModal();
});

observarColecao("obras", (obras) => {
    obrasCache = obras;
    preencherSelectObras();
});

observarColecao(COLECAO, renderizarFuncionarios);

})();
