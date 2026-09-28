// =====================================
// MÓDULO OBRIGAÇÕES (acesso: rh, financeiro) — folha, FGTS, INSS, 13º,
// férias e impostos da empresa (Lucro Presumido), calculados a partir
// dos funcionários, vendas de navio e configurações fiscais.
// =====================================
// IMPORTANTE: os valores aqui são estimativas, não substituem o
// contador. A tabela do INSS é reajustada todo ano — confira se ainda
// está atualizada antes de confiar nos números. Os percentuais de
// presunção de IRPJ/CSLL variam conforme a atividade exata — confirme
// com o contador antes de mudar os padrões.

(async function () {
const ok = await exigirPapel(["rh", "financeiro"]);
if (!ok) return;

const listaFolhaEl = document.getElementById("listaFolha");
const lista13El = document.getElementById("lista13");
const listaFeriasEl = document.getElementById("listaFerias");
const totalFolhaEl = document.getElementById("totalFolha");
const resumoFolhaEl = document.getElementById("resumoFolha");

const inputAliquotaIss = document.getElementById("configAliquotaIss");
const inputAliquotaIcms = document.getElementById("configAliquotaIcms");
const inputPresuncaoIrpj = document.getElementById("configPresuncaoIrpj");
const inputPresuncaoCsll = document.getElementById("configPresuncaoCsll");
const inputFaturamentoMes = document.getElementById("faturamentoServicosMes");
const inputRelatorioMes = document.getElementById("relatorioMes");
const totalImpostosMesEl = document.getElementById("totalImpostosMes");
const detalheImpostosMesEl = document.getElementById("detalheImpostosMes");
const totalImpostosTriEl = document.getElementById("totalImpostosTri");
const detalheImpostosTriEl = document.getElementById("detalheImpostosTri");

const COLECAO_CONFIG_FISCAL = "configFiscal";

const FGTS_PERCENTUAL = 0.08;
const INSS_PATRONAL_ALIQUOTA = 0.20; // CPP — Lucro Presumido não embute isso em nenhuma guia única

// Tabela de referência do INSS (empregado), progressiva por faixa —
// ATUALIZAR todo início de ano, o governo reajusta os valores.
const FAIXAS_INSS = [
    { ate: 1412.00, aliquota: 0.075 },
    { ate: 2666.68, aliquota: 0.09 },
    { ate: 4000.03, aliquota: 0.12 },
    { ate: 7786.02, aliquota: 0.14 },
];

// Regras fixas do Lucro Presumido (estáveis, não mudam por município/estado
// como ISS/ICMS mudam). Presunção de serviços é configurável (ver
// configGeral) porque depende de ser prestação pura (32%) ou empreitada
// com fornecimento de material (pode cair pra 8%).
const PIS_ALIQUOTA = 0.0065;
const COFINS_ALIQUOTA = 0.03;
const PRESUNCAO_IRPJ_MERCADORIA = 0.08;
const PRESUNCAO_CSLL_MERCADORIA = 0.12;
const IRPJ_ALIQUOTA = 0.15;
const IRPJ_ADICIONAL_ALIQUOTA = 0.10;
const IRPJ_ADICIONAL_LIMITE_TRIMESTRE = 60000; // R$20.000/mês × 3, apuração é trimestral
const CSLL_ALIQUOTA = 0.09;

let funcionariosCache = [];
let vendasNavioCache = [];
let notasFiscaisCache = [];
let configGeral = { aliquotaIss: 0, aliquotaIcms: 0, presuncaoIrpj: 32, presuncaoCsll: 32 };
let faturamentoPorMes = {}; // { "2026-09": 15000 } — complemento manual, além das notas fiscais

function formatarMoeda(valor) {
    return (valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso) {
    if (!iso) return "";
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
}

function nomeMes(mesIso) {
    const [ano, mes] = mesIso.split("-").map(Number);
    const nomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${nomes[mes - 1]} de ${ano}`;
}

function calcularInss(salario) {
    if (!salario) return 0;
    const teto = FAIXAS_INSS[FAIXAS_INSS.length - 1].ate;
    const base = Math.min(salario, teto);
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

function renderizarFolha(ativos) {
    if (!ativos.length) {
        listaFolhaEl.innerHTML = '<div class="vazio">Nenhum funcionário ativo cadastrado.</div>';
        totalFolhaEl.textContent = formatarMoeda(0);
        resumoFolhaEl.textContent = "";
        return;
    }

    let totalSalarios = 0, totalFgts = 0, totalInss = 0;

    listaFolhaEl.innerHTML = ativos
        .slice()
        .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
        .map((f) => {
            const salario = f.salario || 0;
            const fgts = salario * FGTS_PERCENTUAL;
            const inss = calcularInss(salario);
            totalSalarios += salario;
            totalFgts += fgts;
            totalInss += inss;

            return `
            <div class="item">
                <div class="linha-topo">
                    <div>
                        <div class="nome">${f.nome}</div>
                        <div class="sub">Salário: ${formatarMoeda(salario)}${salario ? "" : " (não cadastrado)"}</div>
                    </div>
                </div>
                <div class="sub" style="margin-top:8px;">
                    FGTS (8%): ${formatarMoeda(fgts)} · INSS retido do funcionário: ${formatarMoeda(inss)}
                </div>
            </div>`;
        }).join("");

    const inssPatronal = totalSalarios * INSS_PATRONAL_ALIQUOTA;

    totalFolhaEl.textContent = formatarMoeda(totalSalarios);
    resumoFolhaEl.innerHTML =
        `${ativos.length} funcionário${ativos.length > 1 ? "s" : ""} · ` +
        `FGTS do mês: ${formatarMoeda(totalFgts)} · INSS retido: ${formatarMoeda(totalInss)}<br>` +
        `INSS patronal (20% sobre a folha, obrigação separada da empresa): ${formatarMoeda(inssPatronal)}`;
}

function decimoProporcional(funcionario, hoje) {
    const anoAtual = hoje.getFullYear();
    const admissao = funcionario.dataAdmissao ? new Date(funcionario.dataAdmissao + "T00:00:00") : null;

    let inicio = new Date(anoAtual, 0, 1);
    if (admissao && admissao > inicio) {
        inicio = admissao.getDate() <= 15
            ? new Date(admissao.getFullYear(), admissao.getMonth(), 1)
            : new Date(admissao.getFullYear(), admissao.getMonth() + 1, 1);
    }

    let meses = (hoje.getFullYear() - inicio.getFullYear()) * 12 + (hoje.getMonth() - inicio.getMonth());
    if (hoje.getDate() >= 15) meses += 1;
    meses = Math.max(0, Math.min(12, meses));

    const salario = funcionario.salario || 0;
    const valor = (salario / 12) * meses;
    return { meses, valor, fgts: valor * FGTS_PERCENTUAL };
}

function renderizar13(ativos, hoje) {
    const comSalario = ativos.filter((f) => f.salario > 0);
    if (!comSalario.length) {
        lista13El.innerHTML = '<div class="vazio">Nenhum funcionário ativo com salário cadastrado.</div>';
        return;
    }

    lista13El.innerHTML = comSalario
        .slice()
        .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
        .map((f) => {
            const d = decimoProporcional(f, hoje);
            return `
            <div class="item">
                <div class="linha-topo">
                    <div>
                        <div class="nome">${f.nome}</div>
                        <div class="sub">${d.meses}/12 avos trabalhados em ${hoje.getFullYear()}</div>
                    </div>
                    <span class="selo selo-andamento">${formatarMoeda(d.valor)}</span>
                </div>
                <div class="sub" style="margin-top:8px;">FGTS sobre o 13º: ${formatarMoeda(d.fgts)}</div>
            </div>`;
        }).join("");
}

// Período aquisitivo: 12 meses a partir da base (últimas férias, ou
// admissão se nunca tirou). Período concessivo: os 12 meses seguintes,
// prazo legal pra conceder as férias — depois disso, vencido.
function situacaoFerias(funcionario, hoje) {
    const baseIso = funcionario.ultimasFerias || funcionario.dataAdmissao;
    if (!baseIso) return null;

    const base = new Date(baseIso + "T00:00:00");
    const fimAquisitivo = new Date(base);
    fimAquisitivo.setFullYear(base.getFullYear() + 1);
    if (hoje < fimAquisitivo) return null; // ainda no período aquisitivo, nada a avisar

    const fimConcessivo = new Date(base);
    fimConcessivo.setFullYear(base.getFullYear() + 2);

    const diasParaVencer = Math.round((fimConcessivo - hoje) / 86400000);
    if (diasParaVencer < 0) {
        return { classe: "vencido", texto: `Período concessivo vencido há ${Math.abs(diasParaVencer)}d (venceu em ${formatarData(fimConcessivo.toISOString().slice(0, 10))})` };
    }
    if (diasParaVencer <= 60) {
        return { classe: "vencendo", texto: `Período concessivo vence em ${diasParaVencer}d (${formatarData(fimConcessivo.toISOString().slice(0, 10))})` };
    }
    return null;
}

function renderizarFerias(ativos, hoje) {
    const alertas = ativos
        .map((f) => ({ f, situacao: situacaoFerias(f, hoje) }))
        .filter((x) => x.situacao);

    if (!alertas.length) {
        listaFeriasEl.innerHTML = '<div class="vazio">Nenhuma férias vencida ou perto de vencer no momento.</div>';
        return;
    }

    listaFeriasEl.innerHTML = alertas
        .sort((a, b) => (a.f.nome || "").localeCompare(b.f.nome || ""))
        .map(({ f, situacao }) => `
            <div class="item">
                <div class="linha-topo">
                    <div>
                        <div class="nome">${f.nome}</div>
                        <div class="sub">${situacao.texto}</div>
                    </div>
                    <span class="selo selo-${situacao.classe}">${situacao.classe === "vencido" ? "Vencido" : "Vencendo"}</span>
                </div>
            </div>`
        ).join("");
}

function preencherFormularioConfig() {
    inputAliquotaIss.value = configGeral.aliquotaIss || "";
    inputAliquotaIcms.value = configGeral.aliquotaIcms || "";
    inputPresuncaoIrpj.value = configGeral.presuncaoIrpj ?? 32;
    inputPresuncaoCsll.value = configGeral.presuncaoCsll ?? 32;

    const mesIso = new Date().toISOString().slice(0, 7);
    inputFaturamentoMes.value = faturamentoPorMes[mesIso] || "";
}

function somaVendasNavioPorTipo(tipo, inicioIso, fimIsoExclusivo) {
    return vendasNavioCache
        .filter((v) => v.tipo === tipo && v.data >= inicioIso && v.data < fimIsoExclusivo)
        .reduce((soma, v) => soma + (Number(v.valorTotal) || 0), 0);
}

// Só notas de OBRA entram aqui — notas de navio não contam pra não
// duplicar com vendas_navio, que já alimenta o cálculo sozinho.
function somaNotasFiscaisObra(inicioIso, fimIsoExclusivo) {
    return notasFiscaisCache
        .filter((n) => n.entidadeTipo === "obra" && n.dataFaturamento >= inicioIso && n.dataFaturamento < fimIsoExclusivo)
        .reduce((soma, n) => soma + (Number(n.valor) || 0), 0);
}

function limitesMes(mesIso) {
    const [ano, mes] = mesIso.split("-").map(Number);
    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 1);
    return { inicioIso: inicio.toISOString().slice(0, 10), fimIso: fim.toISOString().slice(0, 10) };
}

function limitesTrimestre(mesIso) {
    const [ano, mes] = mesIso.split("-").map(Number);
    const trimestre = Math.floor((mes - 1) / 3);
    const inicio = new Date(ano, trimestre * 3, 1);
    const fim = new Date(ano, trimestre * 3 + 3, 1);
    return {
        inicioIso: inicio.toISOString().slice(0, 10),
        fimIso: fim.toISOString().slice(0, 10),
        numero: trimestre + 1,
        ano,
        primeiroMesIndex: trimestre * 3,
    };
}

// ---- mensal: PIS, COFINS, ISS, ICMS, sobre o faturamento do mês ----
function calcularImpostosMensais(mesIso) {
    const { inicioIso, fimIso } = limitesMes(mesIso);
    const servicosObras = (faturamentoPorMes[mesIso] || 0) + somaNotasFiscaisObra(inicioIso, fimIso);
    const servicosNavios = somaVendasNavioPorTipo("servico", inicioIso, fimIso);
    const mercadorias = somaVendasNavioPorTipo("mercadoria", inicioIso, fimIso);
    const servicos = servicosObras + servicosNavios;
    const faturamento = servicos + mercadorias;

    const pis = faturamento * PIS_ALIQUOTA;
    const cofins = faturamento * COFINS_ALIQUOTA;
    const iss = servicos * (configGeral.aliquotaIss / 100);
    const icms = mercadorias * (configGeral.aliquotaIcms / 100);

    return { mesIso, servicos, mercadorias, faturamento, pis, cofins, iss, icms, total: pis + cofins + iss + icms };
}

// ---- trimestral: IRPJ, CSLL (apuração do Lucro Presumido é por
// trimestre, não mensal — por isso soma os 3 meses do trimestre) ----
function calcularImpostosTrimestrais(mesIso) {
    const { inicioIso, fimIso, numero, ano, primeiroMesIndex } = limitesTrimestre(mesIso);

    let servicosObras = somaNotasFiscaisObra(inicioIso, fimIso);
    for (let m = 0; m < 3; m++) {
        const chave = new Date(ano, primeiroMesIndex + m, 1).toISOString().slice(0, 7);
        servicosObras += faturamentoPorMes[chave] || 0;
    }
    const servicosNavios = somaVendasNavioPorTipo("servico", inicioIso, fimIso);
    const mercadorias = somaVendasNavioPorTipo("mercadoria", inicioIso, fimIso);
    const servicos = servicosObras + servicosNavios;

    const presuncaoIrpj = (configGeral.presuncaoIrpj ?? 32) / 100;
    const presuncaoCsll = (configGeral.presuncaoCsll ?? 32) / 100;

    const baseIrpj = servicos * presuncaoIrpj + mercadorias * PRESUNCAO_IRPJ_MERCADORIA;
    const baseCsll = servicos * presuncaoCsll + mercadorias * PRESUNCAO_CSLL_MERCADORIA;

    const irpjAdicional = Math.max(0, baseIrpj - IRPJ_ADICIONAL_LIMITE_TRIMESTRE) * IRPJ_ADICIONAL_ALIQUOTA;
    const irpj = baseIrpj * IRPJ_ALIQUOTA + irpjAdicional;
    const csll = baseCsll * CSLL_ALIQUOTA;

    return { numero, ano, servicos, mercadorias, baseIrpj, baseCsll, irpj, irpjAdicional, csll, total: irpj + csll };
}

function renderizarImpostosEmpresa() {
    const mesIso = new Date().toISOString().slice(0, 7);
    const m = calcularImpostosMensais(mesIso);
    const t = calcularImpostosTrimestrais(mesIso);

    totalImpostosMesEl.textContent = formatarMoeda(m.total);
    detalheImpostosMesEl.innerHTML =
        `Faturamento do mês: ${formatarMoeda(m.faturamento)} ` +
        `(serviços ${formatarMoeda(m.servicos)} + mercadorias ${formatarMoeda(m.mercadorias)})<br>` +
        `PIS (0,65%): ${formatarMoeda(m.pis)} · COFINS (3%): ${formatarMoeda(m.cofins)}<br>` +
        `ISS (${configGeral.aliquotaIss || 0}%): ${formatarMoeda(m.iss)}` +
        `${configGeral.aliquotaIss ? "" : " — configure a alíquota do seu município acima"}` +
        ` · ICMS (${configGeral.aliquotaIcms || 0}%): ${formatarMoeda(m.icms)}` +
        `${m.mercadorias && !configGeral.aliquotaIcms ? " — configure a alíquota acima" : ""}`;

    totalImpostosTriEl.textContent = formatarMoeda(t.total);
    detalheImpostosTriEl.innerHTML =
        `${t.numero}º trimestre de ${t.ano} · Faturamento do trimestre: ${formatarMoeda(t.servicos + t.mercadorias)}<br>` +
        `IRPJ (15%${t.irpjAdicional ? " + adicional de 10% sobre o excedente de R$60.000" : ""}): ${formatarMoeda(t.irpj)} · ` +
        `CSLL (9%): ${formatarMoeda(t.csll)}`;
}

function renderizarTudo() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const ativos = funcionariosCache.filter((f) => f.status === "ativo");

    renderizarFolha(ativos);
    renderizar13(ativos, hoje);
    renderizarFerias(ativos, hoje);
    renderizarImpostosEmpresa();
}

function gerarRelatorioPdf() {
    const mesIso = inputRelatorioMes.value || new Date().toISOString().slice(0, 7);
    const m = calcularImpostosMensais(mesIso);
    const t = calcularImpostosTrimestrais(mesIso);

    const ativos = funcionariosCache.filter((f) => f.status === "ativo");
    const totalSalarios = ativos.reduce((soma, f) => soma + (f.salario || 0), 0);
    const totalFgtsFolha = totalSalarios * FGTS_PERCENTUAL;
    const totalInssRetido = ativos.reduce((soma, f) => soma + calcularInss(f.salario || 0), 0);
    const inssPatronal = totalSalarios * INSS_PATRONAL_ALIQUOTA;
    const totalMesGeral = totalSalarios + totalFgtsFolha + totalInssRetido + inssPatronal + m.total;

    const linhasFolha = ativos.length
        ? ativos.slice().sort((a, b) => (a.nome || "").localeCompare(b.nome || "")).map((f) => {
            const salario = f.salario || 0;
            return `<tr><td>${f.nome}</td><td>${formatarMoeda(salario)}</td><td>${formatarMoeda(salario * FGTS_PERCENTUAL)}</td><td>${formatarMoeda(calcularInss(salario))}</td></tr>`;
        }).join("")
        : '<tr><td colspan="4">Nenhum funcionário ativo cadastrado.</td></tr>';

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const alertasFerias = ativos
        .map((f) => ({ f, situacao: situacaoFerias(f, hoje) }))
        .filter((x) => x.situacao)
        .sort((a, b) => (a.f.nome || "").localeCompare(b.f.nome || ""));
    const linhasFerias = alertasFerias.length
        ? alertasFerias.map(({ f, situacao }) => `<tr><td>${f.nome}</td><td>${situacao.texto}</td></tr>`).join("")
        : '<tr><td colspan="2">Nenhuma vencida ou perto de vencer no momento.</td></tr>';

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Obrigações — ${nomeMes(mesIso)}</title>
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
  .aviso-box { background: #fff7e6; border: 1px solid #f5a623; border-radius: 8px; padding: 12px; font-size: 13px; margin-top: 16px; line-height: 1.5; }
  .rodape { margin-top: 36px; font-size: 12px; color: #888; }
  .btn-imprimir { margin-top: 20px; padding: 10px 18px; font-size: 14px; cursor: pointer; }
  @media print { .btn-imprimir { display: none; } }
</style>
</head>
<body>
  <h1>Dunamis Services — Relatório de Obrigações</h1>
  <div class="sub">Referência: ${nomeMes(mesIso)} · Gerado em ${new Date().toLocaleString("pt-BR")}</div>

  <div class="aviso-box">
    ⚠️ Valores estimados (regime Lucro Presumido). Folha, 13º e férias
    refletem o cadastro <b>atual</b> dos funcionários, não necessariamente
    o que valia num mês passado. IRPJ/CSLL são de apuração trimestral —
    não pague junto com os impostos mensais. Confirme sempre com o
    contador antes de pagar qualquer guia.
  </div>

  <h2>Total a pagar em ${nomeMes(mesIso)}</h2>
  <div class="resumo">
    <div>Salários: ${formatarMoeda(totalSalarios)}</div>
    <div>FGTS (8%): ${formatarMoeda(totalFgtsFolha)}</div>
    <div>INSS retido dos funcionários: ${formatarMoeda(totalInssRetido)}</div>
    <div>INSS patronal (20%): ${formatarMoeda(inssPatronal)}</div>
    <div>PIS (0,65%): ${formatarMoeda(m.pis)}</div>
    <div>COFINS (3%): ${formatarMoeda(m.cofins)}</div>
    <div>ISS (${configGeral.aliquotaIss || 0}%): ${formatarMoeda(m.iss)}</div>
    <div>ICMS (${configGeral.aliquotaIcms || 0}%): ${formatarMoeda(m.icms)}</div>
    <div style="grid-column:1/-1;"><b>Total do mês (sem IRPJ/CSLL): ${formatarMoeda(totalMesGeral)}</b></div>
  </div>

  <h2>Folha — ${ativos.length} funcionário${ativos.length === 1 ? "" : "s"} ativo${ativos.length === 1 ? "" : "s"}</h2>
  <table>
    <thead><tr><th>Funcionário</th><th>Salário</th><th>FGTS</th><th>INSS retido</th></tr></thead>
    <tbody>${linhasFolha}</tbody>
    <tfoot><tr><td><b>Total</b></td><td><b>${formatarMoeda(totalSalarios)}</b></td><td><b>${formatarMoeda(totalFgtsFolha)}</b></td><td><b>${formatarMoeda(totalInssRetido)}</b></td></tr></tfoot>
  </table>

  <h2>Faturamento usado no cálculo (${nomeMes(mesIso)})</h2>
  <div class="resumo">
    <div>Serviços (Obras + Navios): ${formatarMoeda(m.servicos)}</div>
    <div>Mercadorias (Navios): ${formatarMoeda(m.mercadorias)}</div>
  </div>

  <h2>IRPJ + CSLL — ${t.numero}º trimestre de ${t.ano} (apuração trimestral)</h2>
  <div class="resumo">
    <div>Faturamento do trimestre: ${formatarMoeda(t.servicos + t.mercadorias)}</div>
    <div>Base presumida IRPJ: ${formatarMoeda(t.baseIrpj)}</div>
    <div>IRPJ (15%${t.irpjAdicional ? " + adicional" : ""}): ${formatarMoeda(t.irpj)}</div>
    <div>CSLL (9%): ${formatarMoeda(t.csll)}</div>
    <div style="grid-column:1/-1;"><b>Total do trimestre: ${formatarMoeda(t.total)}</b> — pague só quando o trimestre fechar, não neste mês.</div>
  </div>

  <h2>Férias vencidas ou perto de vencer (situação atual)</h2>
  <table>
    <thead><tr><th>Funcionário</th><th>Situação</th></tr></thead>
    <tbody>${linhasFerias}</tbody>
  </table>

  <button class="btn-imprimir" onclick="window.print()">Imprimir / Salvar como PDF</button>
  <div class="rodape">Dunamis Services — relatório gerado automaticamente a partir dos dados do app. Não substitui o contador.</div>
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

document.getElementById("btnSalvarConfigFiscal").addEventListener("click", async () => {
    await salvarDocumento(COLECAO_CONFIG_FISCAL, {
        aliquotaIss: Number(inputAliquotaIss.value) || 0,
        aliquotaIcms: Number(inputAliquotaIcms.value) || 0,
        presuncaoIrpj: Number(inputPresuncaoIrpj.value) || 32,
        presuncaoCsll: Number(inputPresuncaoCsll.value) || 32,
    }, "geral");
});

document.getElementById("btnSalvarFaturamento").addEventListener("click", async () => {
    const mesIso = new Date().toISOString().slice(0, 7);
    await salvarDocumento(COLECAO_CONFIG_FISCAL, {
        faturamentoServicos: Number(inputFaturamentoMes.value) || 0,
    }, mesIso);
});

const relatorioMesLabelEl = document.getElementById("relatorioMesLabel");

function atualizarLabelRelatorioMes() {
    const mesIso = inputRelatorioMes.value || new Date().toISOString().slice(0, 7);
    relatorioMesLabelEl.textContent = nomeMes(mesIso);
}

function mudarMesRelatorio(delta) {
    const atual = inputRelatorioMes.value || new Date().toISOString().slice(0, 7);
    const [ano, mes] = atual.split("-").map(Number);
    const nova = new Date(ano, mes - 1 + delta, 1);
    inputRelatorioMes.value = nova.toISOString().slice(0, 7);
    atualizarLabelRelatorioMes();
}

inputRelatorioMes.value = new Date().toISOString().slice(0, 7);
atualizarLabelRelatorioMes();
inputRelatorioMes.addEventListener("change", atualizarLabelRelatorioMes);
document.getElementById("btnMesAnterior").addEventListener("click", () => mudarMesRelatorio(-1));
document.getElementById("btnMesProximo").addEventListener("click", () => mudarMesRelatorio(1));
document.getElementById("btnGerarRelatorio").addEventListener("click", gerarRelatorioPdf);

observarColecao("funcionarios", (l) => {
    funcionariosCache = l;
    renderizarTudo();
});

observarColecao("vendas_navio", (l) => {
    vendasNavioCache = l;
    renderizarImpostosEmpresa();
});

observarColecao("notasFiscais", (l) => {
    notasFiscaisCache = l;
    renderizarImpostosEmpresa();
});

observarColecao(COLECAO_CONFIG_FISCAL, (docs) => {
    const geral = docs.find((d) => d.id === "geral");
    configGeral = {
        aliquotaIss: geral?.aliquotaIss || 0,
        aliquotaIcms: geral?.aliquotaIcms || 0,
        presuncaoIrpj: geral?.presuncaoIrpj ?? 32,
        presuncaoCsll: geral?.presuncaoCsll ?? 32,
    };
    faturamentoPorMes = {};
    docs.forEach((d) => {
        if (/^\d{4}-\d{2}$/.test(d.id)) faturamentoPorMes[d.id] = d.faturamentoServicos || 0;
    });
    preencherFormularioConfig();
    renderizarImpostosEmpresa();
});

})();
