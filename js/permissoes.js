// =====================================================
// CONTROLE DE ACESSO POR PAPEL
// =====================================================
// Papéis possíveis: admin, rh, sst, financeiro, campo.
// "admin" sempre tem acesso a tudo. Os demais só acessam o que está
// liberado para o papel deles (ver docs/MODELO-DE-DADOS.md).
//
// O papel de cada usuário fica em usuarios/{email} no Firestore.
// Quem cadastra isso é a tela pages/usuarios.html (só admin acessa).
//
// Incluir depois de firebase-init.js e auth-guard.js.

let papelUsuario = null;
let papelCarregado = false;

async function carregarPapel() {
    if (papelCarregado) return papelUsuario;

    if (!firebaseConfigurado) {
        // Modo local: um usuário só, sem sentido restringir por papel.
        papelUsuario = "admin";
        papelCarregado = true;
        return papelUsuario;
    }

    await new Promise((resolve) => {
        firebaseAuth.onAuthStateChanged((usuario) => resolve(usuario));
    });

    const usuario = firebaseAuth.currentUser;
    if (!usuario) {
        papelCarregado = true;
        return null;
    }

    const doc = await firebaseDb.collection("usuarios").doc(usuario.email.toLowerCase()).get();
    papelUsuario = doc.exists ? doc.data().papel : null;
    papelCarregado = true;
    return papelUsuario;
}

// Chamar no topo de cada página restrita: const ok = await exigirPapel(["rh"]);
// "admin" sempre passa, não precisa listar.
async function exigirPapel(papeisPermitidos) {
    await carregarPapel();

    const semPermissao = !papelUsuario || (papelUsuario !== "admin" && !papeisPermitidos.includes(papelUsuario));

    if (semPermissao) {
        document.body.innerHTML = telaSemAcesso(
            !papelUsuario
                ? "Seu usuário ainda não tem permissão configurada. Peça para o administrador liberar seu acesso em Usuários."
                : "Você não tem permissão para acessar esta área."
        );
    }

    return !semPermissao;
}

function telaSemAcesso(mensagem) {
    return `
        <div class="tela">
            <div class="vazio" style="margin-top:100px;">
                🔒<br><br>${mensagem}<br><br>
                <a href="dashboard.html" style="color:var(--accent);">‹ Voltar ao painel</a>
            </div>
        </div>`;
}
