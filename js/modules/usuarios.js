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
    funcionario: "Funcionário",
};

const checkFuncionario = document.getElementById("papelFuncionario");
const blocoFuncionario = document.getElementById("blocoFuncionarioVinculado");
const selectFuncionario = document.getElementById("usuarioFuncionarioId");
const blocoSenha = document.getElementById("blocoSenhaInicial");
const campoSenha = document.getElementById("usuarioSenha");
let funcionariosCache = [];

function preencherSelectFuncionarios(selecionado) {
    selectFuncionario.innerHTML = '<option value="">Escolha o funcionário...</option>' +
        funcionariosCache
            .filter((f) => f.status === "ativo" || f.id === selecionado)
            .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
            .map((f) => `<option value="${f.id}">${f.nome}${f.cargo ? " — " + f.cargo : ""}</option>`)
            .join("");
    selectFuncionario.value = selecionado || "";
}

function atualizarBlocoFuncionario() {
    blocoFuncionario.style.display = checkFuncionario.checked ? "block" : "none";
}
checkFuncionario.addEventListener("change", () => {
    // "Campo" abre a lista de TODOS os funcionários (aparelho da obra) e
    // sobrepõe o modo individual — então não deixa os dois juntos por engano.
    if (checkFuncionario.checked) document.getElementById("papelCampo").checked = false;
    atualizarBlocoFuncionario();
});

// Cria o login (e-mail/CPF + senha) sem derrubar a sessão do admin: usa uma
// segunda instância do Firebase só pra isso.
async function criarLoginFirebase(email, senha) {
    const app = firebase.apps.find((a) => a.name === "criador-de-login") ||
        firebase.initializeApp(firebaseConfig, "criador-de-login");
    try {
        await app.auth().createUserWithEmailAndPassword(email, senha);
    } finally {
        await app.auth().signOut();
    }
}

function renderizarUsuarios(usuarios) {
    if (!usuarios.length) {
        listaEl.innerHTML = '<div class="vazio">Nenhum acesso liberado ainda.<br>Toque no + para liberar o primeiro (comece pelo seu próprio e-mail, como admin).</div>';
        return;
    }

    usuarios.sort((a, b) => (a.nome || a.id).localeCompare(b.nome || b.id));

    listaEl.innerHTML = usuarios.map((u) => {
        const papeis = normalizarPapeis(u.papel) || [];
        const selos = papeis.map((p) => `<span class="selo selo-ativo">${rotuloPapel[p] || p}</span>`).join(" ");
        const vinculado = u.funcionarioId ? funcionariosCache.find((f) => f.id === u.funcionarioId) : null;
        return `
        <div class="item" data-id="${u.id}">
            <div class="linha-topo">
                <div>
                    <div class="nome">${u.nome || u.id}</div>
                    <div class="sub">${u.id.endsWith("@funcionario.dunamis") ? "CPF " + u.id.split("@")[0] : u.id}${vinculado ? " · ficha: " + vinculado.nome : ""}</div>
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
    preencherSelectFuncionarios("");
    atualizarBlocoFuncionario();
    blocoSenha.style.display = "block";
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
    preencherSelectFuncionarios(u.funcionarioId || "");
    atualizarBlocoFuncionario();
    blocoSenha.style.display = "none"; // login já existe; senha nova só pelo Console

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

    const email = campoEmail.disabled ? campoEmail.value : emailDeLogin(campoEmail.value);
    if (!email) {
        alert("Informe o e-mail ou o CPF.");
        return;
    }

    const ehFuncionario = papeisSelecionados.includes("funcionario");
    if (ehFuncionario && !selectFuncionario.value) {
        alert("Escolha qual funcionário é esse acesso.");
        return;
    }
    if (ehFuncionario && papeisSelecionados.some((p) => p !== "funcionario")) {
        if (!confirm("Atenção: junto com outros setores (Campo, RH, Administrador...) esse acesso deixa de ser individual e passa a ver os outros funcionários. Pra ver só o próprio ponto, deixe marcado apenas \"Funcionário\"." + String.fromCharCode(10, 10) + "Salvar mesmo assim?")) return;
    }

    const dados = {
        nome: document.getElementById("usuarioNome").value.trim(),
        papel: papeisSelecionados,
        funcionarioId: ehFuncionario ? selectFuncionario.value : null,
    };

    const senha = campoSenha.value;
    const criandoLogin = firebaseConfigurado && !campoEmail.disabled && senha;
    if (criandoLogin && senha.length < 6) {
        alert("A senha precisa ter pelo menos 6 caracteres.");
        return;
    }

    await salvarDocumento(COLECAO, dados, email);

    let aviso = "";
    if (criandoLogin) {
        try {
            await criarLoginFirebase(email, senha);
            const usuarioTxt = email.endsWith("@funcionario.dunamis") ? "CPF " + email.split("@")[0] : email;
            aviso = "Login criado.\n\nUsuário: " + usuarioTxt + "\nSenha: " + senha + "\n\nPasse isso pra pessoa.";
        } catch (err) {
            aviso = err.code === "auth/email-already-in-use"
                ? "Acesso liberado. Esse login já existia — a senha dele continua a que já era."
                : "Acesso liberado, mas NÃO consegui criar o login (" + (err.code || err.message) + "). Crie no Console do Firebase → Authentication.";
        }
    }

    fecharModal();
    if (aviso) alert(aviso);
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
    observarColecao("funcionarios", (lista) => { funcionariosCache = lista; });
    observarColecao(COLECAO, renderizarUsuarios);
})();
