// =====================================
// MÓDULO PONTO (mobile, com geolocalização) — acesso: campo
// =====================================

(async function () {
const ok = await exigirPapel(["campo"]);
if (!ok) return;

const selectFunc = document.getElementById("pontoFuncionario");
const selectObra = document.getElementById("pontoObra");
const btnBater = document.getElementById("btnBaterPonto");
const pinInput = document.getElementById("pontoPin");
const geoInfo = document.getElementById("pontoGeoInfo");
const ultimoRegistroEl = document.getElementById("pontoUltimoRegistro");
const horaAtualEl = document.getElementById("pontoHoraAtual");
const listaHojeEl = document.getElementById("listaPontosHoje");

let funcionariosCache = [];
let obrasCache = [];
let proximoTipo = "entrada";

function atualizarRelogio() {
    horaAtualEl.textContent = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
atualizarRelogio();
setInterval(atualizarRelogio, 1000 * 30);

function preencherFuncionarios() {
    const salvo = localStorage.getItem("gc_pontoFuncionarioId");
    selectFunc.innerHTML = funcionariosCache
        .filter((f) => f.status === "ativo")
        .map((f) => `<option value="${f.id}">${f.nome}</option>`)
        .join("");
    if (salvo && funcionariosCache.some((f) => f.id === salvo)) selectFunc.value = salvo;
    aoTrocarFuncionario();
}

function preencherObras() {
    selectObra.innerHTML = obrasCache
        .filter((o) => o.status === "andamento" || o.status === "planejada")
        .map((o) => `<option value="${o.id}">${o.nome}</option>`)
        .join("");
}

function aoTrocarFuncionario() {
    const func = funcionariosCache.find((f) => f.id === selectFunc.value);
    if (func && func.obraAtualId) selectObra.value = func.obraAtualId;
    pinInput.value = "";
    atualizarEstadoBotao();
    carregarRegistrosHoje();
}

function inicioDoDia() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

async function carregarRegistrosHoje() {
    const funcId = selectFunc.value;
    if (!funcId) return;

    const todos = await listarColecao("pontos");
    const hoje = todos
        .filter((p) => p.funcionarioId === funcId && p.timestamp >= inicioDoDia())
        .sort((a, b) => a.timestamp - b.timestamp);

    if (!hoje.length) {
        listaHojeEl.innerHTML = '<div class="vazio">Nenhum registro hoje.</div>';
        ultimoRegistroEl.textContent = "Nenhum registro hoje";
        proximoTipo = "entrada";
    } else {
        listaHojeEl.innerHTML = hoje.map((p) => {
            const obra = obrasCache.find((o) => o.id === p.obraId);
            const hora = new Date(p.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
            return `<div class="item">
                <div class="linha-topo">
                    <div>
                        <div class="nome">${p.tipo === "entrada" ? "Entrada" : "Saída"} · ${hora}</div>
                        <div class="sub">${obra ? obra.nome : ""}${p.geo ? " · localização registrada" : ""}</div>
                    </div>
                </div>
            </div>`;
        }).join("");

        const ultimo = hoje[hoje.length - 1];
        proximoTipo = ultimo.tipo === "entrada" ? "saida" : "entrada";
        const horaUltimo = new Date(ultimo.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        ultimoRegistroEl.textContent = `Última marcação: ${ultimo.tipo === "entrada" ? "entrada" : "saída"} às ${horaUltimo}`;
    }

    atualizarEstadoBotao();
}

function atualizarEstadoBotao() {
    const pronto = !!selectFunc.value && !!selectObra.value;
    btnBater.disabled = !pronto;
    btnBater.textContent = proximoTipo === "entrada" ? "Marcar entrada" : "Marcar saída";
    btnBater.className = "btn-ponto " + (proximoTipo === "entrada" ? "btn-entrada" : "btn-saida");
    geoInfo.textContent = pronto ? "Toque para registrar com sua localização atual." : "Selecione o funcionário e a obra para começar.";
}

function obterLocalizacao() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                precisao: Math.round(pos.coords.accuracy),
            }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 8000 }
        );
    });
}

btnBater.addEventListener("click", async () => {
    const funcId = selectFunc.value;
    const obraId = selectObra.value;
    if (!funcId || !obraId) return;

    const func = funcionariosCache.find((f) => f.id === funcId);
    if (func && func.pin && pinInput.value.trim() !== func.pin) {
        geoInfo.textContent = "PIN incorreto. Confira com o funcionário e tente novamente.";
        return;
    }

    btnBater.disabled = true;
    geoInfo.textContent = "Obtendo localização...";

    const geo = await obterLocalizacao();

    await salvarDocumento("pontos", {
        funcionarioId: funcId,
        obraId,
        tipo: proximoTipo,
        timestamp: Date.now(),
        geo,
    });

    localStorage.setItem("gc_pontoFuncionarioId", funcId);
    pinInput.value = "";

    geoInfo.textContent = geo
        ? `Localização registrada (precisão ~${geo.precisao}m).`
        : "Registrado sem localização (sem permissão ou sinal de GPS).";

    await carregarRegistrosHoje();
});

selectFunc.addEventListener("change", aoTrocarFuncionario);
selectObra.addEventListener("change", () => { atualizarEstadoBotao(); });

observarColecao("funcionarios", (lista) => {
    funcionariosCache = lista;
    preencherFuncionarios();
});

observarColecao("obras", (lista) => {
    obrasCache = lista;
    preencherObras();
    aoTrocarFuncionario();
});

})();
