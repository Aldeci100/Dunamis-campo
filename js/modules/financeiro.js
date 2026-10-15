// =====================================
// MÓDULO FINANCEIRO (acesso: financeiro) — fechamento mensal por obra
// =====================================
// Não é uma coleção própria: cruza pontos (mão de obra, via custoHora do
// funcionário) + despesas já lançadas, agrupado por obra e por mês.

(async function () {
const ok = await exigirPapel(["financeiro"]);
if (!ok) return;

const filtroMes = document.getElementById("filtroMes");
const totalGeralEl = document.getElementById("totalGeral");
const listaObrasEl = document.getElementById("listaObrasFinanceiro");
const modalDetalhe = document.getElementById("modalDetalheObra");
const tituloDetalhe = document.getElementById("tituloDetalheObra");
const listaMaoDeObraEl = document.getElementById("listaMaoDeObra");
const listaDespesasObraEl = document.getElementById("listaDespesasObra");

const TIPOS_FIXOS = {
    material: "Material", transporte: "Transporte", aluguel: "Aluguel",
    agua: "Água", luz: "Luz", outros: "Outros",
};

const JORNADA_MENSAL_HORAS = 220; // divisor padrão CLT (jornada de 44h/semana)
const FGTS_PERCENTUAL = 0.08;
const INSS_PATRONAL_ALIQUOTA = 0.20;

// Tabela de referência do INSS (empregado), progressiva por faixa —
// mesma tabela usada em Obrigações. ATUALIZAR todo início de ano.
const FAIXAS_INSS = [
    { ate: 1412.00, aliquota: 0.075 },
    { ate: 2666.68, aliquota: 0.09 },
    { ate: 4000.03, aliquota: 0.12 },
    { ate: 7786.02, aliquota: 0.14 },
];

let obrasCache = [];
let funcionariosCache = [];
let pontosCache = [];
let despesasCache = [];
let tiposCustomCache = [];
let configGeral = { salarioMinimo: 0 };
let ultimoResumo = {};

function calcularInss(remuneracao) {
    if (!remuneracao) return 0;
    const teto = FAIXAS_INSS[FAIXAS_INSS.length - 1].ate;
    const base = Math.min(remuneracao, teto);
    let inss = 0;
    let faixaAnterior = 0;
    for (const faixa of FAIXAS_INSS) {
        if (base > faixaAnterior) {
            inss += (Math.min(base, faixa.ate) - faixaAnterior) * faixa.aliquota;
            faixaAnterior = faixa.ate;
        }
    }
    return inss;
}

// Mesma regra de Obrigações: periculosidade sobre o próprio salário,
// insalubridade sobre o salário mínimo nacional (configGeral.salarioMinimo).
function valorPericulosidade(f) {
    return (f.salario || 0) * ((f.periculosidade || 0) / 100);
}

function valorInsalubridade(f) {
    return (configGeral.salarioMinimo || 0) * ((f.insalubridade || 0) / 100);
}

function remuneracaoTotal(f) {
    return (f.salario || 0) + valorPericulosidade(f) + valorInsalubridade(f);
}

function nomeMes(mesIso) {
    const [ano, mes] = mesIso.split("-").map(Number);
    const nomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${nomes[mes - 1]} de ${ano}`;
}

function rotuloTipo(tipo) {
    if (TIPOS_FIXOS[tipo]) return TIPOS_FIXOS[tipo];
    const custom = tiposCustomCache.find((t) => t.id === tipo);
    return custom ? custom.nome : tipo;
}

// Meses corridos entre o início da obra e hoje (ou o fim, se já concluída),
// contando o mês de início — mínimo 1.
function mesesDecorridos(dataInicioIso, dataFimIso) {
    if (!dataInicioIso) return 1;
    const inicio = new Date(dataInicioIso + "T00:00:00");
    const fim = dataFimIso ? new Date(dataFimIso + "T00:00:00") : new Date();
    const meses = (fim.getFullYear() - inicio.getFullYear()) * 12 + (fim.getMonth() - inicio.getMonth()) + 1;
    return Math.max(1, meses);
}

function custoMensalFuncionario(f) {
    return f.salario > 0 ? f.salario : (f.custoHora || 0) * JORNADA_MENSAL_HORAS;
}

function formatarMoeda(valor) {
    return (valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarHoras(horas) {
    return (horas || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "h";
}

function nomeFuncionario(id) {
    const f = funcionariosCache.find((x) => x.id === id);
    return f ? f.nome : "Funcionário removido";
}

// Custo acumulado da obra em TODOS os períodos (não só o mês filtrado),
// pra comparar com o valor do contrato — margem não faz sentido olhando
// só um mês se a obra atravessa vários.
function calcularCustoTotalObra(obraId) {
    const obra = obrasCache.find((o) => o.id === obraId);
    const cobertosPorSalario = new Set();
    let maoDeObra = 0;

    funcionariosCache
        .filter((f) => f.status === "ativo" && f.obraAtualId === obraId)
        .forEach((f) => {
            const custoMensal = custoMensalFuncionario(f);
            if (!custoMensal) return;
            const meses = mesesDecorridos(obra?.dataInicio, obra?.status === "concluida" ? obra.dataFim : null);
            maoDeObra += custoMensal * meses;
            cobertosPorSalario.add(f.id);
        });

    const porFuncionario = {};
    pontosCache
        .filter((p) => p.obraId === obraId && !cobertosPorSalario.has(p.funcionarioId))
        .forEach((p) => {
            (porFuncionario[p.funcionarioId] = porFuncionario[p.funcionarioId] || []).push(p);
        });

    Object.entries(porFuncionario).forEach(([funcionarioId, pontos]) => {
        pontos.sort((a, b) => a.timestamp - b.timestamp);
        let horas = 0, entradaAberta = null;
        pontos.forEach((p) => {
            if (p.tipo === "entrada") entradaAberta = p.timestamp;
            else if (p.tipo === "saida" && entradaAberta != null) {
                horas += (p.timestamp - entradaAberta) / 3600000;
                entradaAberta = null;
            }
        });
        const custoHora = funcionariosCache.find((f) => f.id === funcionarioId)?.custoHora || 0;
        maoDeObra += horas * custoHora;
    });

    const despesas = despesasCache
        .filter((d) => d.obraId === obraId)
        .reduce((soma, d) => soma + (Number(d.valor) || 0), 0);

    return maoDeObra + despesas;
}

function calcularResumo() {
    const mes = filtroMes.value;
    if (!mes) return {};

    const [ano, mesNum] = mes.split("-").map(Number);
    const inicio = new Date(ano, mesNum - 1, 1, 0, 0, 0).getTime();
    const fim = new Date(ano, mesNum, 1, 0, 0, 0).getTime();

    const resumo = {};
    obrasCache.forEach((o) => {
        resumo[o.id] = { nome: o.nome, maoDeObra: 0, despesas: 0, funcionarios: {}, despesasList: [] };
    });

    // Funcionários ATUALMENTE alocados a uma obra entram pelo salário
    // mensal cheio (não pelas horas batidas no mês) — representa melhor o
    // custo de quem está fixo na obra mesmo sem bater ponto todo dia.
    const cobertosPorSalario = new Set(); // "obraId|funcionarioId"
    funcionariosCache
        .filter((f) => f.status === "ativo" && f.obraAtualId && resumo[f.obraAtualId])
        .forEach((f) => {
            const custoMensal = custoMensalFuncionario(f);
            if (!custoMensal) return;
            resumo[f.obraAtualId].funcionarios[f.id] = { salarial: true, custoMensal, subtotal: custoMensal };
            resumo[f.obraAtualId].maoDeObra += custoMensal;
            cobertosPorSalario.add(f.obraAtualId + "|" + f.id);
        });

    const grupos = {};
    pontosCache
        .filter((p) => p.timestamp >= inicio && p.timestamp < fim)
        .forEach((p) => {
            const chave = p.obraId + "|" + p.funcionarioId;
            if (cobertosPorSalario.has(chave)) return;
            (grupos[chave] = grupos[chave] || []).push(p);
        });

    Object.entries(grupos).forEach(([chave, pontos]) => {
        const [obraId, funcionarioId] = chave.split("|");
        if (!resumo[obraId]) return;

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
        const subtotal = horas * custoHora;
        resumo[obraId].funcionarios[funcionarioId] = { horas, custoHora, subtotal };
        resumo[obraId].maoDeObra += subtotal;
    });

    despesasCache
        .filter((d) => (d.data || "").startsWith(mes))
        .forEach((d) => {
            if (!resumo[d.obraId]) return;
            resumo[d.obraId].despesas += Number(d.valor) || 0;
            resumo[d.obraId].despesasList.push(d);
        });

    return resumo;
}

function renderizar() {
    ultimoResumo = calcularResumo();

    const obrasComAtividade = Object.entries(ultimoResumo)
        .filter(([, r]) => r.maoDeObra > 0 || r.despesas > 0)
        .map(([obraId, r]) => ({ obraId, ...r, total: r.maoDeObra + r.despesas }))
        .sort((a, b) => b.total - a.total);

    const totalGeral = obrasComAtividade.reduce((soma, o) => soma + o.total, 0);
    totalGeralEl.textContent = formatarMoeda(totalGeral);

    if (!obrasComAtividade.length) {
        listaObrasEl.innerHTML = '<div class="vazio">Nenhuma movimentação (ponto ou despesa) nesse mês ainda.</div>';
        return;
    }

    listaObrasEl.innerHTML = obrasComAtividade.map((o) => `
        <div class="item" data-id="${o.obraId}">
            <div class="linha-topo">
                <div>
                    <div class="nome">${o.nome}</div>
                    <div class="sub">Mão de obra: ${formatarMoeda(o.maoDeObra)} · Despesas: ${formatarMoeda(o.despesas)}</div>
                </div>
                <span class="selo selo-andamento">${formatarMoeda(o.total)}</span>
            </div>
        </div>
    `).join("");

    listaObrasEl.querySelectorAll(".item").forEach((el) => {
        el.addEventListener("click", () => abrirDetalhe(el.dataset.id));
    });
}

function abrirDetalhe(obraId) {
    const r = ultimoResumo[obraId];
    if (!r) return;

    tituloDetalhe.textContent = r.nome;

    const obra = obrasCache.find((o) => o.id === obraId);
    const resumoEl = document.getElementById("resumoContratoObra");
    if (obra?.valor) {
        const aliquota = obra.aliquotaImposto || 0;
        const valorImposto = obra.valor * aliquota / 100;
        const valorLiquido = obra.valor - valorImposto;
        const custoTotal = calcularCustoTotalObra(obraId);
        const margem = valorLiquido - custoTotal;
        resumoEl.style.display = "block";
        resumoEl.innerHTML = `
            <div class="sub">Valor do contrato: ${formatarMoeda(obra.valor)}</div>
            ${aliquota ? `<div class="sub">Imposto da nota (${aliquota}%): -${formatarMoeda(valorImposto)} · Líquido: ${formatarMoeda(valorLiquido)}</div>` : ""}
            <div class="sub">Custo até agora (todos os meses): ${formatarMoeda(custoTotal)}</div>
            <div class="grande" style="font-size:20px;color:var(--${margem >= 0 ? "ok" : "danger"});margin-top:4px;">
                ${margem >= 0 ? "Margem" : "Prejuízo"}: ${formatarMoeda(Math.abs(margem))}
            </div>`;
    } else {
        resumoEl.style.display = "none";
        resumoEl.innerHTML = "";
    }

    const funcs = Object.entries(r.funcionarios);
    listaMaoDeObraEl.innerHTML = funcs.length
        ? funcs.map(([funcionarioId, dados]) => `
            <div class="item">
                <div class="linha-topo">
                    <div>
                        <div class="nome">${nomeFuncionario(funcionarioId)}</div>
                        <div class="sub">${dados.salarial
                            ? "Salário mensal (alocado nesta obra)"
                            : `${formatarHoras(dados.horas)} × ${formatarMoeda(dados.custoHora)}/h${dados.custoHora ? "" : " (defina o custo/hora em Funcionários)"}`}</div>
                    </div>
                    <span class="selo selo-andamento">${formatarMoeda(dados.subtotal)}</span>
                </div>
            </div>
        `).join("")
        : '<div class="vazio">Sem ponto registrado nessa obra no mês.</div>';

    listaDespesasObraEl.innerHTML = r.despesasList.length
        ? r.despesasList.map((d) => `
            <div class="item">
                <div class="linha-topo">
                    <div>
                        <div class="nome">${d.descricao || rotuloTipo(d.tipo)}</div>
                        <div class="sub">${rotuloTipo(d.tipo)}</div>
                    </div>
                    <span class="selo selo-andamento">${formatarMoeda(d.valor)}</span>
                </div>
            </div>
        `).join("")
        : '<div class="vazio">Sem despesas lançadas nessa obra no mês.</div>';

    modalDetalhe.style.display = "flex";
}

function nomeObraDoFuncionario(f) {
    if (!f.obraAtualId) return "Sem obra";
    return obrasCache.find((o) => o.id === f.obraAtualId)?.nome || "Obra removida";
}

function gerarFolhaPdf() {
    const mesIso = filtroMes.value || new Date().toISOString().slice(0, 7);
    const ativos = funcionariosCache.filter((f) => f.status === "ativo");

    let totalBruto = 0, totalFgts = 0, totalInss = 0;

    const linhas = ativos.length
        ? ativos.slice().sort((a, b) => (a.nome || "").localeCompare(b.nome || "")).map((f) => {
            const bruto = remuneracaoTotal(f);
            const fgts = bruto * FGTS_PERCENTUAL;
            const inss = calcularInss(bruto);
            const liquido = bruto - inss;
            totalBruto += bruto;
            totalFgts += fgts;
            totalInss += inss;

            const adicionais = [];
            if (f.periculosidade) adicionais.push(`Pericul. ${f.periculosidade}%`);
            if (f.insalubridade) adicionais.push(`Insalub. ${f.insalubridade}%`);

            return `<tr>
                <td>${f.nome}${adicionais.length ? `<br><span style="color:#888;font-size:12px;">${adicionais.join(" · ")}</span>` : ""}</td>
                <td>${nomeObraDoFuncionario(f)}</td>
                <td>${formatarMoeda(bruto)}</td>
                <td>${formatarMoeda(inss)}</td>
                <td><b>${formatarMoeda(liquido)}</b></td>
                <td>${formatarMoeda(fgts)}</td>
            </tr>`;
        }).join("")
        : '<tr><td colspan="6">Nenhum funcionário ativo cadastrado.</td></tr>';

    const totalLiquido = totalBruto - totalInss;
    const inssPatronal = totalBruto * INSS_PATRONAL_ALIQUOTA;
    const totalImpostos = totalInss + totalFgts + inssPatronal;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Folha de Pagamento — ${nomeMes(mesIso)}</title>
<style>
  body { font-family: system-ui, Arial, sans-serif; color: #111; padding: 32px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 16px; margin-top: 28px; border-bottom: 2px solid #333; padding-bottom: 4px; }
  .sub { color: #555; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; }
  th { background: #f2f2f2; }
  .resumo { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; margin-top: 10px; font-size: 14px; }
  .resumo b { font-size: 16px; }
  .bloco { border: 1px solid #ddd; border-radius: 8px; padding: 12px 16px; margin-top: 12px; }
  .aviso-box { background: #fff7e6; border: 1px solid #f5a623; border-radius: 8px; padding: 12px; font-size: 13px; margin-top: 16px; line-height: 1.5; }
  .rodape { margin-top: 36px; font-size: 12px; color: #888; }
  .btn-imprimir { margin-top: 20px; padding: 10px 18px; font-size: 14px; cursor: pointer; }
  @media print { .btn-imprimir { display: none; } }
</style>
</head>
<body>
  <h1>Dunamis Services — Folha de Pagamento</h1>
  <div class="sub">Referência: ${nomeMes(mesIso)} · Gerado em ${new Date().toLocaleString("pt-BR")}</div>

  <div class="aviso-box">
    ⚠️ Valores estimados a partir do cadastro <b>atual</b> dos
    funcionários (o app não guarda histórico de salário por mês).
    Confirme sempre com o contador/contabilidade antes de fechar a
    folha oficial.
  </div>

  <h2>Pagamento aos funcionários</h2>
  <div class="bloco">
    <div class="resumo">
      <div>Funcionários ativos: ${ativos.length}</div>
      <div>Total bruto (salário + adicionais): ${formatarMoeda(totalBruto)}</div>
      <div>(−) INSS retido dos funcionários: ${formatarMoeda(totalInss)}</div>
      <div style="grid-column:1/-1;"><b>Líquido a pagar aos funcionários: ${formatarMoeda(totalLiquido)}</b></div>
    </div>
  </div>

  <h2>Impostos e encargos (obrigações da empresa)</h2>
  <div class="bloco">
    <div class="resumo">
      <div>INSS retido (recolhido ao INSS em nome do funcionário): ${formatarMoeda(totalInss)}</div>
      <div>FGTS (8%): ${formatarMoeda(totalFgts)}</div>
      <div>INSS patronal (20%): ${formatarMoeda(inssPatronal)}</div>
      <div style="grid-column:1/-1;"><b>Total de impostos/encargos: ${formatarMoeda(totalImpostos)}</b></div>
    </div>
  </div>

  <div class="resumo" style="margin-top:14px;">
    <div style="grid-column:1/-1;"><b>Total geral (líquido + impostos): ${formatarMoeda(totalLiquido + totalImpostos)}</b></div>
  </div>

  <h2>Detalhamento por funcionário</h2>
  <table>
    <thead><tr><th>Funcionário</th><th>Obra</th><th>Bruto</th><th>INSS retido</th><th>Líquido a pagar</th><th>FGTS</th></tr></thead>
    <tbody>${linhas}</tbody>
    <tfoot><tr><td colspan="2"><b>Total</b></td><td><b>${formatarMoeda(totalBruto)}</b></td><td><b>${formatarMoeda(totalInss)}</b></td><td><b>${formatarMoeda(totalLiquido)}</b></td><td><b>${formatarMoeda(totalFgts)}</b></td></tr></tfoot>
  </table>

  <button class="btn-imprimir" onclick="window.print()">Imprimir / Salvar como PDF</button>
  <div class="rodape">Dunamis Services — folha gerada automaticamente a partir dos dados do app. Não substitui o contador.</div>
</body>
</html>`;

    const janela = window.open("", "_blank");
    if (!janela) {
        alert("Não foi possível abrir a folha. Verifique se o navegador bloqueou o pop-up.");
        return;
    }
    janela.document.write(html);
    janela.document.close();
}

document.getElementById("btnGerarFolha").addEventListener("click", gerarFolhaPdf);

document.getElementById("btnFecharDetalhe").addEventListener("click", () => (modalDetalhe.style.display = "none"));
modalDetalhe.addEventListener("click", (e) => { if (e.target === modalDetalhe) modalDetalhe.style.display = "none"; });

filtroMes.addEventListener("change", renderizar);
filtroMes.value = new Date().toISOString().slice(0, 7);

observarColecao("obras", (l) => { obrasCache = l; renderizar(); });
observarColecao("funcionarios", (l) => { funcionariosCache = l; renderizar(); });
observarColecao("pontos", (l) => { pontosCache = l; renderizar(); });
observarColecao("despesas", (l) => { despesasCache = l; renderizar(); });
observarColecao("tiposDespesa", (l) => { tiposCustomCache = l; renderizar(); });
observarColecao("configFiscal", (docs) => {
    const geral = docs.find((d) => d.id === "geral");
    configGeral = { salarioMinimo: geral?.salarioMinimo || 0 };
});

})();
