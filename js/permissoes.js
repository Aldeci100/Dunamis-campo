// =====================================================
// CONTROLE DE ACESSO POR PAPEL
// =====================================================
// Papéis possíveis: admin, rh, sst, financeiro, campo.
// Uma pessoa pode ter vários papéis (ex: RH + Campo). "admin" sempre
// tem acesso a tudo. Os demais só acessam o que está liberado para
// os papéis deles (ver docs/MODELO-DE-DADOS.md).
//
// Os papéis de cada usuário ficam em usuarios/{email} no Firestore,
// campo "papel" — pode ser string (um só, formato antigo) ou lista
// (vários, formato atual); normalizamos pra lista aqui. Quem cadastra
// isso é a tela pages/usuarios.html (só admin acessa).
//
// Incluir depois de firebase-init.js e auth-guard.js.

let papeisUsuario = null; // array de strings, ou null se não configurado
let papelCarregado = false;

function normalizarPapeis(bruto) {
    if (!bruto) return null;
    const lista = Array.isArray(bruto) ? bruto : [bruto];
    return lista.length ? lista : null;
}

async function carregarPapel() {
    if (papelCarregado) return papeisUsuario;

    if (!firebaseConfigurado) {
        // Modo local: um usuário só, sem sentido restringir por papel.
        papeisUsuario = ["admin"];
        papelCarregado = true;
        return papeisUsuario;
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
    papeisUsuario = doc.exists ? normalizarPapeis(doc.data().papel) : null;
    papelCarregado = true;
    return papeisUsuario;
}

// Chamar no topo de cada página restrita: const ok = await exigirPapel(["rh"]);
// "admin" sempre passa, não precisa listar.
async function exigirPapel(papeisPermitidos) {
    await carregarPapel();

    const ehAdmin = !!papeisUsuario && papeisUsuario.includes("admin");
    const temAlgum = !!papeisUsuario && papeisUsuario.some((p) => papeisPermitidos.includes(p));
    const semPermissao = !papeisUsuario || (!ehAdmin && !temAlgum);

    if (semPermissao) {
        document.body.innerHTML = telaSemAcesso(
            !papeisUsuario
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
