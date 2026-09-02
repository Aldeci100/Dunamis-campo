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
const filtroFuncObra = document.getElementById("filtroFuncObra");
const filtroFuncStatus = document.getElementById("filtroFuncStatus");
const filtroFuncNome = document.getElementById("filtroFuncNome");

const rotuloStatus = { ativo: "Ativo", afastado: "Afastado", inativo: "Inativo" };
const rotuloAbono = {
    atestado: "Atestado médico",
    falta_justificada: "Falta justificada",
    folga: "Folga",
    feriado: "Feriado",
    outros: "Outros",
};

function formatarMoeda(valor) {
    return (valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarDataIso(iso) {
    if (!iso) return "";
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
}

let obrasCache = [];
let funcionariosCache = [];
let pontosCache = [];
let abonosCache = [];
let funcionarioEspelhoAtual = null;
let funcionarioAbonoAtual = null;

function renderizarResumo() {
    const ativos = funcionariosCache.filter((f) => f.status === "ativo");
    document.getElementById("totalFuncionariosAtivos").textContent = ativos.length;

    const afastados = funcionariosCache.filter((f) => f.status === "afastado").length;
    const inativos = funcionariosCache.filter((f) => f.status === "inativo").length;
    const extras = [];
    if (afastados) extras.push(`${afastados} afastado${afastados > 1 ? "s" : ""}`);
    if (inativos) extras.push(`${inativos} inativo${inativos > 1 ? "s" : ""}`);
    document.getElementById("totalFuncionariosOutros").textContent = extras.join(" · ");

    const porObra = {};
    let semObra = 0;
    ativos.forEach((f) => {
        if (f.obraAtualId) porObra[f.obraAtualId] = (porObra[f.obraAtualId] || 0) + 1;
        else semObra++;
    });

    const linhas = Object.entries(porObra)
        .map(([obraId, qtd]) => ({
            nome: obrasCache.find((o) => o.id === obraId)?.nome || "Obra removida",
            qtd,
        }))
        .sort((a, b) => b.qtd - a.qtd);

    if (semObra) linhas.push({ nome: "Sem obra no momento", qtd: semObra });

    document.getElementById("resumoPorObra").innerHTML = linhas.length
        ? linhas.map((l) => `<div style="display:flex;justify-content:space-between;padding:3px 0;">
              <span>${l.nome}</span><b style="color:var(--text);">${l.qtd}</b>
          </div>`).join("")
        : "";
}

function funcionariosFiltrados() {
    const obraId = filtroFuncObra.value;
    const status = filtroFuncStatus.value;
    const nome = filtroFuncNome.value.trim().toLowerCase();

    return funcionariosCache.filter((f) => {
        if (status && f.status !== status) return false;
        if (obraId === "__sem_obra__" && f.obraAtualId) return false;
        if (obraId && obraId !== "__sem_obra__" && f.obraAtualId !== obraId) return false;
        if (nome && !(f.nome || "").toLowerCase().includes(nome)) return false;
        return true;
    });
}

function renderizarFuncionarios(funcionarios) {
    funcionariosCache = funcionarios;
    renderizarResumo();
    renderizarListaFiltrada();
}

function renderizarListaFiltrada() {
    const funcionarios = funcionariosFiltrados().sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

    if (!funcionarios.length) {
        listaEl.innerHTML = funcionariosCache.length
            ? '<div class="vazio">Nenhum funcionário encontrado com esse filtro.</div>'
            : '<div class="vazio">Nenhum funcionário cadastrado ainda.<br>Toque no + para adicionar.</div>';
        return;
    }

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
            <div class="linha-2" style="margin-top:10px;">
                <button type="button" class="btn-secundaria btn-espelho" data-id="${f.id}">🕒 Espelho</button>
                <button type="button" class="btn-secundaria btn-abono" data-id="${f.id}">📋 Abonar falta</button>
            </div>
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

    listaEl.querySelectorAll(".btn-abono").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            abrirModalAbono(funcionarios.find((f) => f.id === btn.dataset.id));
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

function preencherFiltroObra() {
    const atual = filtroFuncObra.value;
    const opcoesObras = obrasCache
        .slice()
        .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
        .map((o) => `<option value="${o.id}">${o.nome}</option>`)
        .join("");
    filtroFuncObra.innerHTML = '<option value="">Todas as obras</option>' +
        opcoesObras +
        '<option value="__sem_obra__">Sem obra</option>';
    filtroFuncObra.value = atual;
}

filtroFuncObra.addEventListener("change", renderizarListaFiltrada);
filtroFuncStatus.addEventListener("change", renderizarListaFiltrada);
filtroFuncNome.addEventListener("input", renderizarListaFiltrada);

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
    btnExcluir.style.display = papeisUsuario.includes("admin") ? "block" : "none";
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

const modalAbono = document.getElementById("modalAbono");
const formAbono = document.getElementById("formAbono");
const listaAbonosEl = document.getElementById("listaAbonosFuncionario");

function abrirModalAbono(funcionario) {
    if (!funcionario) return;
    funcionarioAbonoAtual = funcionario;
    document.getElementById("abonoNomeFuncionario").textContent = funcionario.nome;
    formAbono.reset();
    document.getElementById("abonoData").value = new Date().toISOString().slice(0, 10);
    renderizarAbonosFuncionario();
    modalAbono.style.display = "flex";
}

function renderizarAbonosFuncionario() {
    if (!funcionarioAbonoAtual) return;
    const abonos = abonosCache
        .filter((a) => a.funcionarioId === funcionarioAbonoAtual.id)
        .sort((a, b) => (b.data || "").localeCompare(a.data || ""));

    listaAbonosEl.innerHTML = abonos.length
        ? abonos.map((a) => `
            <div class="item" style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
                <div>
                    <div class="nome">${formatarDataIso(a.data)} — ${rotuloAbono[a.tipo] || a.tipo}</div>
                    ${a.motivo ? `<div class="sub">${a.motivo}</div>` : ""}
                </div>
                <button type="button" class="btn-perigo btn-excluir-abono" data-id="${a.id}" style="padding:8px 12px;font-size:12px;white-space:nowrap;">Excluir</button>
            </div>
        `).join("")
        : '<div class="vazio">Nenhum abono lançado ainda.</div>';

    listaAbonosEl.querySelectorAll(".btn-excluir-abono").forEach((btn) => {
        btn.addEventListener("click", async () => {
            if (!confirm("Excluir este abono?")) return;
            await removerDocumento("abonos", btn.dataset.id);
        });
    });
}

document.getElementById("btnFecharAbono").addEventListener("click", () => {
    modalAbono.style.display = "none";
});
modalAbono.addEventListener("click", (e) => { if (e.target === modalAbono) modalAbono.style.display = "none"; });

formAbono.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!funcionarioAbonoAtual) return;

    await salvarDocumento("abonos", {
        funcionarioId: funcionarioAbonoAtual.id,
        data: document.getElementById("abonoData").value,
        tipo: document.getElementById("abonoTipo").value,
        motivo: document.getElementById("abonoMotivo").value.trim(),
    });

    formAbono.reset();
    document.getElementById("abonoData").value = new Date().toISOString().slice(0, 10);
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

    const abonoPorDia = {};
    abonosCache
        .filter((a) => a.funcionarioId === funcionario.id && (a.data || "").startsWith(mesIso))
        .forEach((a) => { abonoPorDia[a.data] = a; });

    const dias = Array.from(new Set([...Object.keys(porDia), ...Object.keys(abonoPorDia)])).sort();
    let totalMesHoras = 0;

    const linhas = dias.length
        ? dias.map((dia) => {
            const pontos = porDia[dia] || [];
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

            const abono = abonoPorDia[dia];
            if (abono) {
                pares.push(`<i>Abonado: ${rotuloAbono[abono.tipo] || abono.tipo}${abono.motivo ? " — " + abono.motivo : ""}</i>`);
            }

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

// ---------- Exportar lista (Excel/CSV e PDF) ----------

function funcionariosOrdenados() {
    return funcionariosFiltrados().sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
}

function nomeObraDoFuncionario(f) {
    if (!f.obraAtualId) return "Sem obra";
    return obrasCache.find((o) => o.id === f.obraAtualId)?.nome || "Obra removida";
}

function exportarCsv() {
    const linhas = [["Nome", "Função", "Obra", "Status"]];
    funcionariosOrdenados().forEach((f) => {
        linhas.push([f.nome || "", f.cargo || "", nomeObraDoFuncionario(f), rotuloStatus[f.status] || f.status || ""]);
    });

    const csv = linhas
        .map((linha) => linha.map((campo) => `"${String(campo).replace(/"/g, '""')}"`).join(";"))
        .join("\r\n");

    // BOM no início ajuda o Excel a reconhecer acentuação (UTF-8) certinho.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `funcionarios-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function gerarPdfFuncionarios() {
    const ordenados = funcionariosOrdenados();
    const linhas = ordenados
        .map((f) => `<tr><td>${f.nome || ""}</td><td>${f.cargo || "—"}</td><td>${nomeObraDoFuncionario(f)}</td><td>${rotuloStatus[f.status] || f.status}</td></tr>`)
        .join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Funcionários — Dunamis Services</title>
<style>
  body { font-family: system-ui, Arial, sans-serif; color: #111; padding: 32px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .sub { color: #555; font-size: 13px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; }
  th { background: #f2f2f2; }
  .btn-imprimir { margin-top: 24px; padding: 10px 18px; font-size: 14px; cursor: pointer; }
  @media print { .btn-imprimir { display: none; } }
</style>
</head>
<body>
  <h1>Dunamis Services — Funcionários</h1>
  <div class="sub">Gerado em ${new Date().toLocaleString("pt-BR")} · Total: ${ordenados.length}</div>
  <table>
    <thead><tr><th>Nome</th><th>Função</th><th>Obra</th><th>Status</th></tr></thead>
    <tbody>${linhas || '<tr><td colspan="4">Nenhum funcionário cadastrado.</td></tr>'}</tbody>
  </table>
  <button class="btn-imprimir" onclick="window.print()">Imprimir / Salvar como PDF</button>
</body>
</html>`;

    const janela = window.open("", "_blank");
    if (!janela) {
        alert("Não foi possível abrir o relatório. Verifique se o navegador bloqueou o pop-up.");
        return;
    }
    janela.document.write(html);
    janela.document.close();
}

document.getElementById("btnExportarCsv").addEventListener("click", exportarCsv);
document.getElementById("btnExportarPdf").addEventListener("click", gerarPdfFuncionarios);

observarColecao("obras", (obras) => {
    obrasCache = obras;
    preencherSelectObras();
    preencherFiltroObra();
    renderizarResumo();
    renderizarListaFiltrada();
});

observarColecao("pontos", (pontos) => {
    pontosCache = pontos;
});

observarColecao("abonos", (abonos) => {
    abonosCache = abonos;
    if (modalAbono.style.display === "flex") renderizarAbonosFuncionario();
});

observarColecao(COLECAO, renderizarFuncionarios);

})();
