// =====================================
// MÓDULO USUÁRIOS (admin) — controla os papéis/setores de cada pessoa
// =====================================

const COLECAO = "usuarios";

const listaEl = document.getElementById("listaUsuarios");
const modal = document.getElementById("modalUsuario");
const form = document.getElementById("formUsuario");
const btnExcluir = document.getElementById("btnExcluirUsuario");
const campoEmail = document.getElementById("usuarioEmail");
const checkboxesPapel = form.querySelectorAll('input[type="checkbox"][id^="papel"]');

const rotuloPapel = {
    admin: "Administrador",
    rh: "RH",
    sst: "Segurança do Trabalho",
    financeiro: "Financeiro",
    campo: "Campo",
};

function renderizarUsuarios(usuarios) {
    if (!usuarios.length) {
        listaEl.innerHTML = '<div class="vazio">Nenhum acesso liberado ainda.<br>Toque no + para liberar o primeiro (comece pelo seu próprio e-mail, como admin).</div>';
        return;
    }

    usuarios.sort((a, b) => (a.nome || a.id).localeCompare(b.nome || b.id));

    listaEl.innerHTML = usuarios.map((u) => {
        const papeis = normalizarPapeis(u.papel) || [];
        const selos = papeis.map((p) => `<span class="selo selo-ativo">${rotuloPapel[p] || p}</span>`).join(" ");
        return `
        <div class="item" data-id="${u.id}">
            <div class="linha-topo">
                <div>
                    <div class="nome">${u.nome || u.id}</div>
                    <div class="sub">${u.id}</div>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">${selos}</div>
            </div>
        </div>`;
    }).join("");

    listaEl.querySelectorAll(".item").forEach((el) => {
        el.addEventListener("click", () => abrirEdicao(usuarios.find((u) => u.id === el.dataset.id)));
    });
}

function abrirNovo() {
    form.reset();
    document.getElementById("usuarioIdOriginal").value = "";
    document.getElementById("tituloModalUsuario").textContent = "Liberar acesso";
    campoEmail.disabled = false;
    btnExcluir.style.display = "none";
    modal.style.display = "flex";
}

function abrirEdicao(u) {
    document.getElementById("usuarioIdOriginal").value = u.id;
    campoEmail.value = u.id;
    campoEmail.disabled = true;
    document.getElementById("usuarioNome").value = u.nome || "";

    const papeis = normalizarPapeis(u.papel) || [];
    checkboxesPapel.forEach((cb) => { cb.checked = papeis.includes(cb.value); });

    document.getElementById("tituloModalUsuario").textContent = "Editar acesso";
    btnExcluir.style.display = "block";
    modal.style.display = "flex";
}

function fecharModal() {
    modal.style.display = "none";
}

document.getElementById("btnNovoUsuario").addEventListener("click", abrirNovo);
document.getElementById("btnCancelarUsuario").addEventListener("click", fecharModal);
modal.addEventListener("click", (e) => { if (e.target === modal) fecharModal(); });

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const papeisSelecionados = Array.from(checkboxesPapel).filter((cb) => cb.checked).map((cb) => cb.value);
    if (!papeisSelecionados.length) {
        alert("Marque pelo menos um setor/papel.");
        return;
    }

    const email = campoEmail.value.trim().toLowerCase();
    const dados = {
        nome: document.getElementById("usuarioNome").value.trim(),
        papel: papeisSelecionados,
    };

    await salvarDocumento(COLECAO, dados, email);
    fecharModal();
});

btnExcluir.addEventListener("click", async () => {
    const id = document.getElementById("usuarioIdOriginal").value;
    if (!id) return;
    if (!confirm("Remover o acesso deste usuário? A conta de login continua existindo, só perde acesso ao sistema.")) return;
    await removerDocumento(COLECAO, id);
    fecharModal();
});

(async function iniciar() {
    const ok = await exigirPapel([]);
    if (!ok) return;
    observarColecao(COLECAO, renderizarUsuarios);
})();
