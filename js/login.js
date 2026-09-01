// =====================================
// LOGIN - GESTÃO DE CAMPO
// =====================================

document.addEventListener("DOMContentLoaded", () => {

    const aviso = document.getElementById("avisoModo");
    if (!firebaseConfigurado) {
        aviso.textContent =
            "Modo local (sem nuvem): os dados ficam só neste aparelho. " +
            "Configure o Firebase em js/firebase-init.js para RH e SST " +
            "verem os mesmos dados em tempo real.";
    }

    const form = document.getElementById("formLogin");
    const botao = form.querySelector(".btnLogin");

    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const usuario = form.querySelector('input[type="email"]').value;
        const senha = form.querySelector('input[type="password"]').value;

        if (!firebaseConfigurado) {
            localStorage.setItem("gc_usuarioLogado", usuario);
            window.location.href = "pages/dashboard.html";
            return;
        }

        botao.disabled = true;
        botao.textContent = "Entrando...";

        firebaseAuth.signInWithEmailAndPassword(usuario, senha)
            .then(() => {
                window.location.href = "pages/dashboard.html";
            })
            .catch(() => {
                botao.disabled = false;
                botao.textContent = "ENTRAR";
                alert("Não foi possível entrar. Confira o e-mail e a senha.");
            });
    });

});
