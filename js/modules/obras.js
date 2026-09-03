// =====================================
// MÓDULO OBRAS (acesso: admin)
// =====================================

(async function () {
const ok = await exigirPapel(["admin"]);
if (!ok) return;

const COLECAO = "obras";

const listaEl = document.getElementById("listaObras");
const modal = document.getElementById("modalObra");
const form = document.getElementById("formObra");
const btnExcluir = document.getElementById("btnExcluirObra");
const filtroObraStatus = document.getElementById("filtroObraStatus");
const filtroObraNome = document.getElementById("filtroObraNome");

let obrasCache = [];
let funcionariosCache = [];
let pontosCache = [];
let despesasCache = [];
let tiposDespesaCache = [];
let anexosCache = [];
let obraAnexosAtual = null;

const rotuloStatus = {
    planejada: "Planejada",
    andamento: "Em andamento",
    concluida: "Concluída",
    parada: "Parada",
};

const TIPOS_DESPESA_FIXOS = {
    material: "Material",
    transporte: "Transporte",
    aluguel: "Aluguel",
    agua: "Água",
    luz: "Luz",
    outros: "Outros",
};

function rotuloTipoDespesa(tipo) {
    if (TIPOS_DESPESA_FIXOS[tipo]) return TIPOS_DESPESA_FIXOS[tipo];
    const custom = tiposDespesaCache.find((t) => t.id === tipo);
    return custom ? custom.nome : tipo;
}

function formatarData(iso) {
    if (!iso) return "";
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
}

function formatarMoeda(valor) {
    return (valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function renderizarObras(obras) {
    obrasCache = obras;
    renderizarListaFiltrada();
}

function obrasFiltradas() {
    const status = filtroObraStatus.value;
    const nome = filtroObraNome.value.trim().toLowerCase();
    return obrasCache.filter((o) => {
        if (status && o.status !== status) return false;
        if (nome && !(o.nome || "").toLowerCase().includes(nome)) return false;
        return true;
    });
}

function renderizarListaFiltrada() {
    if (!obrasCache.length) {
        listaEl.innerHTML = '<div class="vazio">Nenhuma obra cadastrada ainda.<br>Toque no + para criar a primeira.</div>';
        return;
    }

    const obras = obrasFiltradas();

    if (!obras.length) {
        listaEl.innerHTML = '<div class="vazio">Nenhuma obra encontrada com esse filtro.</div>';
        return;
    }

    const ordem = { andamento: 0, planejada: 1, parada: 2, concluida: 3 };
    obras.sort((a, b) => (ordem[a.status] ?? 9) - (ordem[b.status] ?? 9));

    listaEl.innerHTML = obras.map((o) => `
        <div class="item" data-id="${o.id}">
            <div class="linha-topo">
                <div>
                    <div class="nome">${o.nome}</div>
                    <div class="sub">${o.cliente || ""}${o.endereco ? " · " + o.endereco : ""}${o.valor ? " · " + formatarMoeda(o.valor) : ""}</div>
                    ${o.valor && o.aliquotaImposto ? `<div class="sub">Líquido após imposto (${o.aliquotaImposto}%): ${formatarMoeda(o.valor - (o.valor * o.aliquotaImposto / 100))}</div>` : ""}
                </div>
                <span class="selo selo-${o.status}">${rotuloStatus[o.status] || o.status}</span>
            </div>
            ${o.dataInicio || o.dataFim ? `<div class="sub" style="margin-top:8px;">
                ${o.dataInicio ? "Início: " + formatarData(o.dataInicio) : ""}
                ${o.dataFim ? " · Previsão: " + formatarData(o.dataFim) : ""}
            </div>` : ""}
            <div class="linha-2" style="margin-top:10px;">
                <button type="button" class="btn-secundaria btn-relatorio" data-id="${o.id}">📄 Relatório</button>
                <button type="button" class="btn-secundaria btn-anexos" data-id="${o.id}">📎 Anexos</button>
            </div>
        </div>
    `).join("");

    listaEl.querySelectorAll(".item").forEach((el) => {
        el.addEventListener("click", () => abrirEdicao(obras.find((o) => o.id === el.dataset.id)));
    });

    listaEl.querySelectorAll(".btn-relatorio").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            gerarRelatorio(btn.dataset.id);
        });
    });

    listaEl.querySelectorAll(".btn-anexos").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            abrirModalAnexos(obras.find((o) => o.id === btn.dataset.id));
        });
    });
}

function abrirNovo() {
    form.reset();
    document.getElementById("obraId").value = "";
    document.getElementById("tituloModalObra").textContent = "Nova obra";
    btnExcluir.style.display = "none";
    modal.style.display = "flex";
}

function abrirEdicao(obra) {
    document.getElementById("obraId").value = obra.id;
    document.getElementById("obraNome").value = obra.nome || "";
    document.getElementById("obraCliente").value = obra.cliente || "";
    document.getElementById("obraEndereco").value = obra.endereco || "";
    document.getElementById("obraValor").value = obra.valor ?? "";
    document.getElementById("obraAliquotaImposto").value = obra.aliquotaImposto ?? "";
    document.getElementById("obraStatus").value = obra.status || "planejada";
    document.getElementById("obraDataInicio").value = obra.dataInicio || "";
    document.getElementById("obraDataFim").value = obra.dataFim || "";
    document.getElementById("tituloModalObra").textContent = "Editar obra";
    btnExcluir.style.display = "block";
    modal.style.display = "flex";
}

function fecharModal() {
    modal.style.display = "none";
}

document.getElementById("btnNovaObra").addEventListener("click", abrirNovo);
document.getElementById("btnCancelarObra").addEventListener("click", fecharModal);
modal.addEventListener("click", (e) => { if (e.target === modal) fecharModal(); });
filtroObraStatus.addEventListener("change", renderizarListaFiltrada);
filtroObraNome.addEventListener("input", renderizarListaFiltrada);

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("obraId").value || null;
    const dados = {
        nome: document.getElementById("obraNome").value.trim(),
        cliente: document.getElementById("obraCliente").value.trim(),
        endereco: document.getElementById("obraEndereco").value.trim(),
        valor: Number(document.getElementById("obraValor").value) || 0,
        aliquotaImposto: Number(document.getElementById("obraAliquotaImposto").value) || 0,
        status: document.getElementById("obraStatus").value,
        dataInicio: document.getElementById("obraDataInicio").value,
        dataFim: document.getElementById("obraDataFim").value,
    };

    await salvarDocumento(COLECAO, dados, id);
    fecharModal();
});

btnExcluir.addEventListener("click", async () => {
    const id = document.getElementById("obraId").value;
    if (!id) return;
    if (!confirm("Excluir esta obra? Isso não apaga pontos/despesas já lançados.")) return;
    await removerDocumento(COLECAO, id);
    fecharModal();
});

function formatarHoras(horas) {
    return (horas || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "h";
}

const JORNADA_MENSAL_HORAS = 220; // divisor padrão CLT (jornada de 44h/semana)

// Meses corridos entre o início da obra e hoje (ou o fim, se já concluída),
// contando o mês de início — mínimo 1. Usado pra estimar quantos meses de
// salário um funcionário alocado acumulou na obra.
function mesesDecorridos(dataInicioIso, dataFimIso) {
    if (!dataInicioIso) return 1;
    const inicio = new Date(dataInicioIso + "T00:00:00");
    const fim = dataFimIso ? new Date(dataFimIso + "T00:00:00") : new Date();
    const meses = (fim.getFullYear() - inicio.getFullYear()) * 12 + (fim.getMonth() - inicio.getMonth()) + 1;
    return Math.max(1, meses);
}

function calcularResumoObra(obraId) {
    const obra = obrasCache.find((o) => o.id === obraId);
    const cobertosPorSalario = new Set();

    // Funcionários ATUALMENTE alocados à obra entram pelo salário mensal
    // (× meses corridos desde o início da obra), não pelas horas batidas —
    // representa melhor o custo de quem está fixo na obra mesmo sem bater
    // ponto todo dia.
    const funcionariosSalario = funcionariosCache
        .filter((f) => f.status === "ativo" && f.obraAtualId === obraId)
        .map((f) => {
            const custoMensal = f.salario > 0 ? f.salario : (f.custoHora || 0) * JORNADA_MENSAL_HORAS;
            if (!custoMensal) return null;
            cobertosPorSalario.add(f.id);
            const meses = mesesDecorridos(obra?.dataInicio, obra?.status === "concluida" ? obra.dataFim : null);
            return { nome: f.nome, salarial: true, meses, custoMensal, subtotal: custoMensal * meses };
        })
        .filter(Boolean);

    const porFuncionario = {};
    pontosCache
        .filter((p) => p.obraId === obraId && !cobertosPorSalario.has(p.funcionarioId))
        .forEach((p) => {
            (porFuncionario[p.funcionarioId] = porFuncionario[p.funcionarioId] || []).push(p);
        });

    const funcionariosHoras = Object.entries(porFuncionario).map(([funcionarioId, pontos]) => {
        pontos.sort((a, b) => a.timestamp - b.timestamp);
        let horas = 0;
        let entradaAberta = null;
        pontos.forEach((p) => {
            if (p.tipo === "entrada") entradaAberta = p.timestamp;
            else if (p.tipo === "saida" && entradaAberta != null) {
                horas += (p.timestamp - entradaAberta) / 3600000;
                entradaAberta = null;
            }
        });
        const func = funcionariosCache.find((f) => f.id === funcionarioId);
        const custoHora = func?.custoHora || 0;
        return { nome: func ? func.nome : "Funcionário removido", salarial: false, horas, custoHora, subtotal: horas * custoHora };
    });

    const funcionarios = [...funcionariosSalario, ...funcionariosHoras];

    const despesasDaObra = despesasCache.filter((d) => d.obraId === obraId);
    const totalMaoDeObra = funcionarios.reduce((soma, f) => soma + f.subtotal, 0);
    const totalDespesas = despesasDaObra.reduce((soma, d) => soma + (Number(d.valor) || 0), 0);

    return { funcionarios, despesasDaObra, totalMaoDeObra, totalDespesas, custoTotal: totalMaoDeObra + totalDespesas };
}

function gerarRelatorio(obraId) {
    const obra = obrasCache.find((o) => o.id === obraId);
    if (!obra) return;

    const r = calcularResumoObra(obraId);
    const aliquota = obra.aliquotaImposto || 0;
    const valorImposto = (obra.valor || 0) * aliquota / 100;
    const valorLiquido = (obra.valor || 0) - valorImposto;
    const margem = valorLiquido - r.custoTotal;
    const funcionariosAlocados = funcionariosCache.filter((f) => f.status === "ativo" && f.obraAtualId === obraId).length;

    const linhasFuncionarios = r.funcionarios.length
        ? r.funcionarios.map((f) => f.salarial
            ? `<tr><td>${f.nome}</td><td>Salário mensal × ${f.meses} ${f.meses > 1 ? "meses" : "mês"}</td><td>${formatarMoeda(f.custoMensal)}</td><td>${formatarMoeda(f.subtotal)}</td></tr>`
            : `<tr><td>${f.nome}</td><td>${formatarHoras(f.horas)}</td><td>${formatarMoeda(f.custoHora)}</td><td>${formatarMoeda(f.subtotal)}</td></tr>`
          ).join("")
        : '<tr><td colspan="4">Nenhum ponto registrado nessa obra.</td></tr>';

    const linhasDespesas = r.despesasDaObra.length
        ? r.despesasDaObra.map((d) => `<tr><td>${d.descricao || rotuloTipoDespesa(d.tipo)}${d.observacao ? `<br><span style="color:#888;font-size:12px;">${d.observacao}</span>` : ""}</td><td>${rotuloTipoDespesa(d.tipo)}</td><td>${formatarData(d.data)}</td><td>${formatarMoeda(d.valor)}</td></tr>`).join("")
        : '<tr><td colspan="4">Nenhuma despesa lançada nessa obra.</td></tr>';

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório — ${obra.nome}</title>
<style>
  body { font-family: system-ui, Arial, sans-serif; color: #111; padding: 32px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 16px; margin-top: 28px; border-bottom: 2px solid #333; padding-bottom: 4px; }
  .sub { color: #555; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; }
  th { background: #f2f2f2; }
  .resumo { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; margin-top: 10px; font-size: 14px; }
  .resumo b { font-size: 16px; }
  .positivo { color: #16803c; }
  .negativo { color: #c0362c; }
  .rodape { margin-top: 36px; font-size: 12px; color: #888; }
  .btn-imprimir { margin-top: 20px; padding: 10px 18px; font-size: 14px; cursor: pointer; }
  @media print { .btn-imprimir { display: none; } }
</style>
</head>
<body>
  <h1>Dunamis Services — Relatório de obra</h1>
  <div class="sub">Gerado em ${new Date().toLocaleString("pt-BR")}</div>

  <h2>${obra.nome}</h2>
  <div class="resumo">
    <div>Cliente: ${obra.cliente || "—"}</div>
    <div>Status: ${rotuloStatus[obra.status] || obra.status}</div>
    <div>Endereço: ${obra.endereco || "—"}</div>
    <div>Início: ${formatarData(obra.dataInicio) || "—"} · Previsão de fim: ${formatarData(obra.dataFim) || "—"}</div>
    <div><b>Funcionários alocados nesta obra: ${funcionariosAlocados}</b></div>
  </div>

  <h2>Financeiro</h2>
  <div class="resumo">
    <div>Valor do contrato: ${formatarMoeda(obra.valor)}</div>
    <div>Imposto da nota (${aliquota}%): -${formatarMoeda(valorImposto)}</div>
    <div>Valor líquido: ${formatarMoeda(valorLiquido)}</div>
    <div>Custo total (mão de obra + despesas): ${formatarMoeda(r.custoTotal)}</div>
    <div style="grid-column:1/-1;"><b class="${margem >= 0 ? "positivo" : "negativo"}">${margem >= 0 ? "Margem" : "Prejuízo"}: ${formatarMoeda(Math.abs(margem))}</b></div>
  </div>

  <h2>Mão de obra (todos os períodos)</h2>
  <table>
    <thead><tr><th>Funcionário</th><th>Horas / período</th><th>Valor</th><th>Subtotal</th></tr></thead>
    <tbody>${linhasFuncionarios}</tbody>
    <tfoot><tr><td colspan="3"><b>Total mão de obra</b></td><td><b>${formatarMoeda(r.totalMaoDeObra)}</b></td></tr></tfoot>
  </table>
  <div class="sub" style="margin-top:6px;">
    Funcionários atualmente alocados à obra entram pelo salário mensal
    (desde o início da obra); os demais, pelas horas batidas no Ponto.
  </div>

  <h2>Despesas</h2>
  <table>
    <thead><tr><th>Descrição</th><th>Tipo</th><th>Data</th><th>Valor</th></tr></thead>
    <tbody>${linhasDespesas}</tbody>
    <tfoot><tr><td colspan="3"><b>Total despesas</b></td><td><b>${formatarMoeda(r.totalDespesas)}</b></td></tr></tfoot>
  </table>

  <button class="btn-imprimir" onclick="window.print()">Imprimir / Salvar como PDF</button>
  <div class="rodape">Dunamis Services — relatório gerado automaticamente a partir dos dados do app.</div>
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

// ---------- Anexos (notas fiscais, orçamentos) ----------

const modalAnexos = document.getElementById("modalAnexos");
const formAnexo = document.getElementById("formAnexo");
const listaAnexosEl = document.getElementById("listaAnexosObra");
const btnEnviarAnexo = document.getElementById("btnEnviarAnexo");

function abrirModalAnexos(obra) {
    if (!obra) return;
    obraAnexosAtual = obra;
    document.getElementById("anexosNomeObra").textContent = obra.nome;
    formAnexo.reset();
    renderizarAnexos();
    modalAnexos.style.display = "flex";
}

function renderizarAnexos() {
    if (!obraAnexosAtual) return;
    const anexos = anexosCache
        .filter((a) => a.entidadeTipo === "obra" && a.entidadeId === obraAnexosAtual.id)
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
    if (!obraAnexosAtual) return;

    const arquivo = document.getElementById("anexoArquivo").files[0];
    if (!arquivo) return;

    btnEnviarAnexo.disabled = true;
    btnEnviarAnexo.textContent = "Enviando...";

    try {
        await enviarAnexo(
            "obra",
            obraAnexosAtual.id,
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

observarColecao(COLECAO, renderizarObras);
observarColecao("funcionarios", (l) => { funcionariosCache = l; });
observarColecao("pontos", (l) => { pontosCache = l; });
observarColecao("despesas", (l) => { despesasCache = l; });
observarColecao("tiposDespesa", (l) => { tiposDespesaCache = l; });
observarColecao("anexos", (l) => {
    anexosCache = l;
    if (modalAnexos.style.display === "flex") renderizarAnexos();
});

})();
