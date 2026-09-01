// Redireciona para o login se não houver sessão ativa.
// Incluir em toda página dentro de /pages, depois do firebase-init.js.

(function () {
    if (!firebaseConfigurado) {
        if (!localStorage.getItem("gc_usuarioLogado")) {
            window.location.href = "../index.html";
        }
        return;
    }

    firebaseAuth.onAuthStateChanged((usuario) => {
        if (!usuario) window.location.href = "../index.html";
    });
})();

function sair() {
    if (firebaseConfigurado) {
        firebaseAuth.signOut().then(() => (window.location.href = "../index.html"));
    } else {
        localStorage.removeItem("gc_usuarioLogado");
        window.location.href = "../index.html";
    }
}
