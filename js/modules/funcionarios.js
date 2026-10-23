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
let funcionariosCarregados = null;
const nomesSincronizados = new Set();
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
    document.getElementById("funcUltimasFerias").value = f.ultimasFerias || "";
    document.getElementById("funcObra").value = f.obraAtualId || "";
    document.getElementById("funcStatus").value = f.status || "ativo";
    document.getElementById("funcPin").value = f.pin || "";
    campoSalario.value = f.salario ?? "";
    campoCustoHora.value = f.custoHora ?? "";
    atualizarCustoHora();
    document.getElementById("funcPericulosidade").value = f.periculosidade ?? "";
    document.getElementById("funcInsalubridade").value = f.insalubridade ?? "";
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
        ultimasFerias: document.getElementById("funcUltimasFerias").value,
        obraAtualId: document.getElementById("funcObra").value,
        obraAtualNome: obrasCache.find((o) => o.id === document.getElementById("funcObra").value)?.nome || "",
        status: document.getElementById("funcStatus").value,
        pin,
        salario: Number(campoSalario.value) || 0,
        custoHora: Number(campoCustoHora.value) || 0,
        periculosidade: Number(document.getElementById("funcPericulosidade").value) || 0,
        insalubridade: Number(document.getElementById("funcInsalubridade").value) || 0,
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

    const chaveDia = (ts) => {
        const d = new Date(ts);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    const porDia = {};
    pontosDoMes.forEach((p) => {
        const dia = chaveDia(p.timestamp);
        (porDia[dia] = porDia[dia] || []).push(p);
    });

    const abonoPorDia = {};
    abonosCache
        .filter((a) => a.funcionarioId === funcionario.id && (a.data || "").startsWith(mesIso))
        .forEach((a) => { abonoPorDia[a.data] = a; });

    const dias = Array.from(new Set([...Object.keys(porDia), ...Object.keys(abonoPorDia)])).sort();
    let totalMesHoras = 0;

    function celulaLocalizacao(p) {
        if (!p.geo) return "<i>sem localização</i>";
        const lat = p.geo.lat.toFixed(5);
        const lng = p.geo.lng.toFixed(5);
        return `<a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank">${lat}, ${lng}</a>` +
            (p.geo.precisao ? `<br><span class="peq">precisão ~${p.geo.precisao}m</span>` : "");
    }

    const linhas = dias.length
        ? dias.map((dia) => {
            const pontos = porDia[dia] || [];
            let entradaAberta = null;
            let horasDia = 0;
            pontos.forEach((p) => {
                if (p.tipo === "entrada") {
                    entradaAberta = p;
                } else if (p.tipo === "saida" && entradaAberta) {
                    horasDia += (p.timestamp - entradaAberta.timestamp) / 3600000;
                    entradaAberta = null;
                }
            });
            totalMesHoras += horasDia;

            const abono = abonoPorDia[dia];
            const linhasDia = pontos.map((p) => {
                const obra = obrasCache.find((o) => o.id === p.obraId);
                const rotulo = p.tipo === "entrada" ? (p.almoco ? "Volta do almoço" : "Entrada") : (p.almoco ? "Ida p/ almoço" : "Saída");
                return `<td>${rotulo}</td><td>${formatarHora(p.timestamp)}</td><td>${obra ? obra.nome : "—"}</td><td>${celulaLocalizacao(p)}</td>`;
            });
            if (abono) {
                linhasDia.push(`<td colspan="4"><i>Abonado: ${rotuloAbono[abono.tipo] || abono.tipo}${abono.motivo ? " — " + abono.motivo : ""}</i></td>`);
            }

            const n = linhasDia.length;
            return linhasDia.map((resto, i) => {
                const inicio = i === 0 ? `<td rowspan="${n}">${formatarDataIso(dia)}</td>` : "";
                const fimLinha = i === 0 ? `<td rowspan="${n}">${formatarHoras(horasDia)}</td>` : "";
                return `<tr>${inicio}${resto}${fimLinha}</tr>`;
            }).join("");
        }).join("")
        : '<tr><td colspan="6">Nenhum ponto registrado nesse mês.</td></tr>';

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Espelho de Ponto — ${funcionario.nome}</title>
<style>
  body { font-family: system-ui, Arial, sans-serif; color: #111; padding: 32px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 15px; margin-top: 4px; color: #444; font-weight: normal; }
  .dados { margin-top: 18px; font-size: 14px; line-height: 1.7; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; vertical-align: top; }
  th { background: #f2f2f2; }
  .peq { font-size: 11px; color: #666; }
  a { color: #0b5cad; }
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
    <thead><tr><th>Data</th><th>Tipo</th><th>Hora</th><th>Obra</th><th>Localização</th><th>Total do dia</th></tr></thead>
    <tbody>${linhas}</tbody>
    <tfoot><tr><td colspan="5">Total do mês</td><td>${formatarHoras(totalMesHoras)}</td></tr></tfoot>
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

// ---------- PINs de ponto (ver / trocar) ----------

const modalPins = document.getElementById("modalPins");
const listaPinsEl = document.getElementById("listaPins");
const buscaPinsEl = document.getElementById("buscaPins");
const contagemPinsEl = document.getElementById("contagemPins");

function pinsEmUso(exceto) {
    const mapa = {};
    funcionariosCache.forEach((f) => {
        if (f.id === exceto || !f.pin) return;
        (mapa[f.pin] = mapa[f.pin] || []).push(f.nome);
    });
    return mapa;
}

function gerarPinLivre(exceto) {
    const usados = pinsEmUso(exceto);
    for (let i = 0; i < 200; i++) {
        const pin = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
        if (!usados[pin]) return pin;
    }
    return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

function renderizarPins() {
    if (!funcionariosCache.length) {
        listaPinsEl.innerHTML = '<div class="vazio">Nenhum funcionário cadastrado.</div>';
        contagemPinsEl.textContent = "";
        return;
    }

    // guarda o que já foi digitado e ainda não salvo, pra não perder
    // quando outra linha é salva e a lista redesenha
    const pendentes = {};
    listaPinsEl.querySelectorAll(".item").forEach((el) => {
        const f = funcionariosCache.find((x) => x.id === el.dataset.id);
        const valor = el.querySelector(".input-pin").value;
        if (f && valor !== (f.pin || "")) pendentes[el.dataset.id] = valor;
    });

    // PIN crescente; quem não tem PIN vai pro fim; empate (PIN repetido)
    // desempata por nome
    const chavePin = (f) => (f.pin ? Number(f.pin) : Infinity);
    const lista = funcionariosCache
        .slice()
        .sort((a, b) => {
            const diff = chavePin(a) - chavePin(b);
            if (diff !== 0 && !Number.isNaN(diff)) return diff;
            return (a.nome || "").localeCompare(b.nome || "");
        });

    listaPinsEl.innerHTML = lista.map((f) => {
        const repetidoCom = f.pin ? (pinsEmUso(f.id)[f.pin] || []) : [];
        const aviso = !f.pin
            ? '<div class="sub" style="color:var(--warn);">Sem PIN — o Ponto não confere a identidade</div>'
            : repetidoCom.length
                ? `<div class="sub" style="color:var(--danger);">PIN repetido com: ${repetidoCom.join(", ")}</div>`
                : "";

        return `
        <div class="item" data-id="${f.id}" data-busca="${`${f.nome || ""} ${f.cargo || ""} ${f.pin || ""}`.toLowerCase().replace(/"/g, "")}">
            <div class="linha-topo">
                <div>
                    <div class="nome">${f.nome}</div>
                    <div class="sub">${f.cargo || ""}${f.cargo ? " · " : ""}${rotuloStatus[f.status] || f.status}</div>
                </div>
            </div>
            ${aviso}
            <div style="display:flex;gap:8px;align-items:center;margin-top:10px;">
                <input type="text" class="input-pin" maxlength="4" inputmode="numeric" placeholder="----" value="${f.pin || ""}" style="flex:1;letter-spacing:4px;text-align:center;${repetidoCom.length ? "border-color:var(--danger);" : ""}">
                <button type="button" class="btn-secundaria btn-gerar-pin" style="width:auto;padding:12px 14px;">🎲 Gerar</button>
                <button type="button" class="btn-primaria btn-salvar-pin" style="width:auto;margin-top:0;padding:12px 14px;">Salvar</button>
            </div>
        </div>`;
    }).join("");

    listaPinsEl.querySelectorAll(".item").forEach((el) => {
        const id = el.dataset.id;
        const input = el.querySelector(".input-pin");
        if (id in pendentes) input.value = pendentes[id];

        el.querySelector(".btn-gerar-pin").addEventListener("click", () => {
            input.value = gerarPinLivre(id);
        });

        el.querySelector(".btn-salvar-pin").addEventListener("click", async () => {
            const pin = input.value.trim();
            if (pin && !/^\d{4}$/.test(pin)) {
                alert("O PIN deve ter exatamente 4 dígitos, ou ficar em branco.");
                return;
            }
            await salvarDocumento(COLECAO, { pin }, id);
        });
    });

    aplicarBuscaPins();
}

// Só esconde/mostra as linhas (não redesenha), assim o que foi digitado
// e ainda não salvo continua lá enquanto você busca outro funcionário.
function aplicarBuscaPins() {
    const termo = buscaPinsEl.value.trim().toLowerCase();
    const itens = listaPinsEl.querySelectorAll(".item");
    let visiveis = 0;
    itens.forEach((el) => {
        const mostra = !termo || el.dataset.busca.includes(termo);
        el.style.display = mostra ? "" : "none";
        if (mostra) visiveis++;
    });
    contagemPinsEl.textContent = itens.length
        ? (termo ? `${visiveis} de ${itens.length} funcionários` : `${itens.length} funcionários, em ordem crescente de PIN`)
        : "";
}

buscaPinsEl.addEventListener("input", aplicarBuscaPins);

document.getElementById("btnAbrirPins").addEventListener("click", () => {
    listaPinsEl.innerHTML = "";
    buscaPinsEl.value = "";
    renderizarPins();
    modalPins.style.display = "flex";
});
document.getElementById("btnFecharPins").addEventListener("click", () => {
    modalPins.style.display = "none";
});
modalPins.addEventListener("click", (e) => { if (e.target === modalPins) modalPins.style.display = "none"; });

observarColecao("obras", (obras) => {
    obrasCache = obras;
    preencherSelectObras();
    preencherFiltroObra();
    renderizarResumo();
    renderizarListaFiltrada();
    sincronizarNomeObra();
});

observarColecao("pontos", (pontos) => {
    pontosCache = pontos;
});

observarColecao("abonos", (abonos) => {
    abonosCache = abonos;
    if (modalAbono.style.display === "flex") renderizarAbonosFuncionario();
});

// O funcionário com login próprio não pode ler a coleção de obras (tem valor de
// contrato etc.), então o nome da obra dele fica copiado no cadastro
// (obraAtualNome). Aqui mantemos essa cópia em dia — também cobre quem foi
// cadastrado antes e obra que mudou de nome.

function sincronizarNomeObra() {
    if (!funcionariosCarregados || !obrasCache.length) return;
    funcionariosCarregados.forEach((f) => {
        if (!f.obraAtualId) return;
        const nome = obrasCache.find((o) => o.id === f.obraAtualId)?.nome;
        const chave = f.id + "|" + nome;
        if (!nome || f.obraAtualNome === nome || nomesSincronizados.has(chave)) return;
        nomesSincronizados.add(chave);
        salvarDocumento(COLECAO, { obraAtualNome: nome }, f.id).catch(() => {});
    });
}

observarColecao(COLECAO, (funcionarios) => {
    funcionariosCarregados = funcionarios;
    renderizarFuncionarios(funcionarios);
    if (modalPins.style.display === "flex") renderizarPins();
    sincronizarNomeObra();
});

})();
