// =====================================
// MÓDULO OBRIGAÇÕES (acesso: rh, financeiro) — folha, FGTS, INSS,
// 13º e férias, calculados a partir dos funcionários cadastrados.
// =====================================
// IMPORTANTE: os valores aqui são estimativas, não substituem o
// contador. A tabela do INSS é reajustada todo ano — confira se ainda
// está atualizada antes de confiar nos números.

(async function () {
const ok = await exigirPapel(["rh", "financeiro"]);
if (!ok) return;

const listaFolhaEl = document.getElementById("listaFolha");
const lista13El = document.getElementById("lista13");
const listaFeriasEl = document.getElementById("listaFerias");
const blocoImpostosEmpresaEl = document.getElementById("blocoImpostosEmpresa");
const totalFolhaEl = document.getElementById("totalFolha");
const resumoFolhaEl = document.getElementById("resumoFolha");

const FGTS_PERCENTUAL = 0.08;

// Tabela de referência do INSS (empregado), progressiva por faixa —
// ATUALIZAR todo início de ano, o governo reajusta os valores.
const FAIXAS_INSS = [
    { ate: 1412.00, aliquota: 0.075 },
    { ate: 2666.68, aliquota: 0.09 },
    { ate: 4000.03, aliquota: 0.12 },
    { ate: 7786.02, aliquota: 0.14 },
];

let funcionariosCache = [];

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

    totalFolhaEl.textContent = formatarMoeda(totalSalarios);
    resumoFolhaEl.textContent =
        `${ativos.length} funcionário${ativos.length > 1 ? "s" : ""} · ` +
        `FGTS do mês: ${formatarMoeda(totalFgts)} · INSS retido: ${formatarMoeda(totalInss)}`;
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

function renderizarImpostosEmpresa() {
    const totalFolha = funcionariosCache
        .filter((f) => f.status === "ativo")
        .reduce((soma, f) => soma + (f.salario || 0), 0);
    const patronalEstimado = totalFolha * 0.20;

    blocoImpostosEmpresaEl.innerHTML = `
        <p style="margin:0 0 10px;">
            ICMS, ISS e o DAS do Simples Nacional variam muito conforme o
            <b>regime tributário</b> da empresa e a atividade — não vou
            estimar um valor até isso estar confirmado, pra não te passar
            um número errado que você paga a mais ou a menos.
        </p>
        <p style="margin:0 0 10px;">
            Confirme com o contador qual é o regime (Simples Nacional,
            Lucro Presumido ou Lucro Real) e qual Anexo/atividade se
            aplica, aí eu configuro o cálculo certinho aqui.
        </p>
        <p style="margin:0;color:var(--text-dim);font-size:13px;">
            Referência (só se a empresa <u>não</u> for Simples Nacional):
            INSS patronal ≈ 20% sobre a folha bruta de ativos =
            ${formatarMoeda(patronalEstimado)}/mês. No Simples, isso
            normalmente já vem embutido no DAS.
        </p>`;
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

observarColecao("funcionarios", (l) => {
    funcionariosCache = l;
    renderizarTudo();
});

})();
