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

const rotuloTipo = {
    material: "Material", transporte: "Transporte", aluguel: "Aluguel",
    agua: "Água", luz: "Luz", outros: "Outros",
};

let obrasCache = [];
let funcionariosCache = [];
let pontosCache = [];
let despesasCache = [];
let ultimoResumo = {};

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
    let maoDeObra = 0;
    const porFuncionario = {};
    pontosCache
        .filter((p) => p.obraId === obraId)
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

    const grupos = {};
    pontosCache
        .filter((p) => p.timestamp >= inicio && p.timestamp < fim)
        .forEach((p) => {
            const chave = p.obraId + "|" + p.funcionarioId;
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
                        <div class="sub">${formatarHoras(dados.horas)} × ${formatarMoeda(dados.custoHora)}/h${dados.custoHora ? "" : " (defina o custo/hora em Funcionários)"}</div>
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
                        <div class="nome">${d.descricao || rotuloTipo[d.tipo] || d.tipo}</div>
                        <div class="sub">${rotuloTipo[d.tipo] || d.tipo}</div>
                    </div>
                    <span class="selo selo-andamento">${formatarMoeda(d.valor)}</span>
                </div>
            </div>
        `).join("")
        : '<div class="vazio">Sem despesas lançadas nessa obra no mês.</div>';

    modalDetalhe.style.display = "flex";
}

document.getElementById("btnFecharDetalhe").addEventListener("click", () => (modalDetalhe.style.display = "none"));
modalDetalhe.addEventListener("click", (e) => { if (e.target === modalDetalhe) modalDetalhe.style.display = "none"; });

filtroMes.addEventListener("change", renderizar);
filtroMes.value = new Date().toISOString().slice(0, 7);

observarColecao("obras", (l) => { obrasCache = l; renderizar(); });
observarColecao("funcionarios", (l) => { funcionariosCache = l; renderizar(); });
observarColecao("pontos", (l) => { pontosCache = l; renderizar(); });
observarColecao("despesas", (l) => { despesasCache = l; renderizar(); });

})();
