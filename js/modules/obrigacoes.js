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
let configGeral = { aliquotaIss: 0, aliquotaIcms: 0, presuncaoIrpj: 32, presuncaoCsll: 32 };
let faturamentoPorMes = {}; // { "2026-09": 15000 }

function formatarMoeda(valor) {
    return (valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso) {
    if (!iso) return "";
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
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

function limitesMes(hoje) {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
    return { inicioIso: inicio.toISOString().slice(0, 10), fimIso: fim.toISOString().slice(0, 10) };
}

function limitesTrimestre(hoje) {
    const trimestre = Math.floor(hoje.getMonth() / 3);
    const inicio = new Date(hoje.getFullYear(), trimestre * 3, 1);
    const fim = new Date(hoje.getFullYear(), trimestre * 3 + 3, 1);
    return {
        inicioIso: inicio.toISOString().slice(0, 10),
        fimIso: fim.toISOString().slice(0, 10),
        numero: trimestre + 1,
        ano: hoje.getFullYear(),
        primeiroMesIndex: trimestre * 3,
    };
}

function renderizarImpostosEmpresa() {
    const hoje = new Date();
    const mesIso = hoje.toISOString().slice(0, 7);

    // ---- mensal: PIS, COFINS, ISS, ICMS ----
    const { inicioIso: inicioMes, fimIso: fimMes } = limitesMes(hoje);
    const servicosObrasMes = faturamentoPorMes[mesIso] || 0;
    const servicosNaviosMes = somaVendasNavioPorTipo("servico", inicioMes, fimMes);
    const mercadoriasMes = somaVendasNavioPorTipo("mercadoria", inicioMes, fimMes);
    const servicosMes = servicosObrasMes + servicosNaviosMes;
    const faturamentoMes = servicosMes + mercadoriasMes;

    const pis = faturamentoMes * PIS_ALIQUOTA;
    const cofins = faturamentoMes * COFINS_ALIQUOTA;
    const iss = servicosMes * (configGeral.aliquotaIss / 100);
    const icms = mercadoriasMes * (configGeral.aliquotaIcms / 100);
    const totalMes = pis + cofins + iss + icms;

    totalImpostosMesEl.textContent = formatarMoeda(totalMes);
    detalheImpostosMesEl.innerHTML =
        `Faturamento do mês: ${formatarMoeda(faturamentoMes)} ` +
        `(serviços ${formatarMoeda(servicosMes)} + mercadorias ${formatarMoeda(mercadoriasMes)})<br>` +
        `PIS (0,65%): ${formatarMoeda(pis)} · COFINS (3%): ${formatarMoeda(cofins)}<br>` +
        `ISS (${configGeral.aliquotaIss || 0}%): ${formatarMoeda(iss)}` +
        `${configGeral.aliquotaIss ? "" : " — configure a alíquota do seu município acima"}` +
        ` · ICMS (${configGeral.aliquotaIcms || 0}%): ${formatarMoeda(icms)}` +
        `${mercadoriasMes && !configGeral.aliquotaIcms ? " — configure a alíquota acima" : ""}`;

    // ---- trimestral: IRPJ, CSLL (apuração do Lucro Presumido é por
    // trimestre, não mensal — por isso soma os 3 meses do trimestre) ----
    const { inicioIso: inicioTri, fimIso: fimTri, numero: numeroTri, ano: anoTri, primeiroMesIndex } = limitesTrimestre(hoje);

    let servicosObrasTri = 0;
    for (let m = 0; m < 3; m++) {
        const chave = new Date(hoje.getFullYear(), primeiroMesIndex + m, 1).toISOString().slice(0, 7);
        servicosObrasTri += faturamentoPorMes[chave] || 0;
    }
    const servicosNaviosTri = somaVendasNavioPorTipo("servico", inicioTri, fimTri);
    const mercadoriasTri = somaVendasNavioPorTipo("mercadoria", inicioTri, fimTri);
    const servicosTri = servicosObrasTri + servicosNaviosTri;

    const presuncaoIrpj = (configGeral.presuncaoIrpj ?? 32) / 100;
    const presuncaoCsll = (configGeral.presuncaoCsll ?? 32) / 100;

    const baseIrpj = servicosTri * presuncaoIrpj + mercadoriasTri * PRESUNCAO_IRPJ_MERCADORIA;
    const baseCsll = servicosTri * presuncaoCsll + mercadoriasTri * PRESUNCAO_CSLL_MERCADORIA;

    const irpjAdicional = Math.max(0, baseIrpj - IRPJ_ADICIONAL_LIMITE_TRIMESTRE) * IRPJ_ADICIONAL_ALIQUOTA;
    const irpj = baseIrpj * IRPJ_ALIQUOTA + irpjAdicional;
    const csll = baseCsll * CSLL_ALIQUOTA;
    const totalTri = irpj + csll;

    totalImpostosTriEl.textContent = formatarMoeda(totalTri);
    detalheImpostosTriEl.innerHTML =
        `${numeroTri}º trimestre de ${anoTri} · Faturamento do trimestre: ${formatarMoeda(servicosTri + mercadoriasTri)}<br>` +
        `IRPJ (15%${irpjAdicional ? " + adicional de 10% sobre o excedente de R$60.000" : ""}): ${formatarMoeda(irpj)} · ` +
        `CSLL (9%): ${formatarMoeda(csll)}`;
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

observarColecao("funcionarios", (l) => {
    funcionariosCache = l;
    renderizarTudo();
});

observarColecao("vendas_navio", (l) => {
    vendasNavioCache = l;
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
