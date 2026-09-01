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

function formatarDataIso(iso) {
    if (!iso) return "";
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
}

let obrasCache = [];
let pontosCache = [];
let funcionarioEspelhoAtual = null;

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
            <button type="button" class="btn-secundaria btn-espelho" data-id="${f.id}" style="margin-top:10px;">🕒 Espelho de ponto</button>
        </div>`;
    }).join("");

    listaEl.querySelectorAll(".item").forEach((el) => {
        el.addEventListener("click", () => abrirEdicao(funcionarios.find((f) => f.id === el.dataset.id)));
    });

    listaEl.querySelectorAll(".btn-espelho").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            abrirModalEspelho(funcionarios.find((f) => f.id === btn.dataset.id));
        });
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

const modalEspelho = document.getElementById("modalEspelho");
const campoMesEspelho = document.getElementById("espelhoMes");

function abrirModalEspelho(funcionario) {
    if (!funcionario) return;
    funcionarioEspelhoAtual = funcionario;
    document.getElementById("espelhoNomeFuncionario").textContent = funcionario.nome;
    campoMesEspelho.value = new Date().toISOString().slice(0, 7);
    modalEspelho.style.display = "flex";
}

document.getElementById("btnCancelarEspelho").addEventListener("click", () => {
    modalEspelho.style.display = "none";
});
modalEspelho.addEventListener("click", (e) => { if (e.target === modalEspelho) modalEspelho.style.display = "none"; });

function formatarHora(timestamp) {
    return new Date(timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatarHoras(horas) {
    return (horas || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "h";
}

function nomeMesAno(mesIso) {
    const [ano, mes] = mesIso.split("-").map(Number);
    const nomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${nomes[mes - 1]} de ${ano}`;
}

document.getElementById("btnGerarEspelho").addEventListener("click", () => {
    const funcionario = funcionarioEspelhoAtual;
    const mesIso = campoMesEspelho.value;
    if (!funcionario || !mesIso) return;

    const [ano, mesNum] = mesIso.split("-").map(Number);
    const inicio = new Date(ano, mesNum - 1, 1, 0, 0, 0).getTime();
    const fim = new Date(ano, mesNum, 1, 0, 0, 0).getTime();

    const pontosDoMes = pontosCache
        .filter((p) => p.funcionarioId === funcionario.id && p.timestamp >= inicio && p.timestamp < fim)
        .sort((a, b) => a.timestamp - b.timestamp);

    const porDia = {};
    pontosDoMes.forEach((p) => {
        const dia = new Date(p.timestamp).toISOString().slice(0, 10);
        (porDia[dia] = porDia[dia] || []).push(p);
    });

    const dias = Object.keys(porDia).sort();
    let totalMesHoras = 0;

    const linhas = dias.length
        ? dias.map((dia) => {
            const pontos = porDia[dia];
            const pares = [];
            let entradaAberta = null;
            let horasDia = 0;
            pontos.forEach((p) => {
                if (p.tipo === "entrada") {
                    entradaAberta = p;
                } else if (p.tipo === "saida" && entradaAberta) {
                    pares.push(`${formatarHora(entradaAberta.timestamp)} — ${formatarHora(p.timestamp)}`);
                    horasDia += (p.timestamp - entradaAberta.timestamp) / 3600000;
                    entradaAberta = null;
                }
            });
            if (entradaAberta) pares.push(`${formatarHora(entradaAberta.timestamp)} — (sem saída)`);
            totalMesHoras += horasDia;

            return `<tr><td>${formatarDataIso(dia)}</td><td>${pares.join("<br>")}</td><td>${formatarHoras(horasDia)}</td></tr>`;
        }).join("")
        : '<tr><td colspan="3">Nenhum ponto registrado nesse mês.</td></tr>';

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Espelho de Ponto — ${funcionario.nome}</title>
<style>
  body { font-family: system-ui, Arial, sans-serif; color: #111; padding: 32px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 15px; margin-top: 4px; color: #444; font-weight: normal; }
  .dados { margin-top: 18px; font-size: 14px; line-height: 1.7; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; vertical-align: top; }
  th { background: #f2f2f2; }
  tfoot td { font-weight: bold; border-top: 2px solid #333; }
  .assinaturas { display: flex; gap: 40px; margin-top: 60px; }
  .assinatura { flex: 1; border-top: 1px solid #333; padding-top: 6px; font-size: 13px; text-align: center; }
  .btn-imprimir { margin-top: 30px; padding: 10px 18px; font-size: 14px; cursor: pointer; }
  @media print { .btn-imprimir { display: none; } }
</style>
</head>
<body>
  <h1>Dunamis Services</h1>
  <h2>Espelho de Ponto — ${nomeMesAno(mesIso)}</h2>

  <div class="dados">
    <div><b>Funcionário:</b> ${funcionario.nome}</div>
    <div><b>Cargo:</b> ${funcionario.cargo || "—"}</div>
    <div><b>CPF:</b> ${funcionario.cpf || "—"}</div>
  </div>

  <table>
    <thead><tr><th>Data</th><th>Marcações</th><th>Total do dia</th></tr></thead>
    <tbody>${linhas}</tbody>
    <tfoot><tr><td colspan="2">Total do mês</td><td>${formatarHoras(totalMesHoras)}</td></tr></tfoot>
  </table>

  <div class="assinaturas">
    <div class="assinatura">Assinatura do funcionário</div>
    <div class="assinatura">Assinatura do responsável</div>
  </div>

  <button class="btn-imprimir" onclick="window.print()">Imprimir / Salvar como PDF</button>
</body>
</html>`;

    const janela = window.open("", "_blank");
    if (!janela) {
        alert("Não foi possível abrir o espelho. Verifique se o navegador bloqueou o pop-up.");
        return;
    }
    janela.document.write(html);
    janela.document.close();
    modalEspelho.style.display = "none";
});

observarColecao("obras", (obras) => {
    obrasCache = obras;
    preencherSelectObras();
});

observarColecao("pontos", (pontos) => {
    pontosCache = pontos;
});

observarColecao(COLECAO, renderizarFuncionarios);

})();
