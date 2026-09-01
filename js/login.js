// =====================================
// LOGIN - DUNAMIS SERVICES
// =====================================

document.addEventListener("DOMContentLoaded", () => {

    const aviso = document.getElementById("avisoModo");
    if (!firebaseConfigurado) {
        aviso.style.display = "block";
        aviso.textContent =
            "Modo local (sem nuvem): os dados ficam só neste aparelho. " +
            "Configure o Firebase em js/firebase-init.js para RH e SST " +
            "verem os mesmos dados em tempo real.";
    }

    const form = document.getElementById("formLogin");
    const botao = form.querySelector(".btnLogin");
    const campoEmail = document.getElementById("loginEmail");
    const campoSenha = document.getElementById("loginSenha");
    const btnOlho = document.getElementById("btnOlho");

    btnOlho.addEventListener("click", () => {
        const mostrando = campoSenha.type === "text";
        campoSenha.type = mostrando ? "password" : "text";
        btnOlho.textContent = mostrando ? "👁️" : "🙈";
        btnOlho.setAttribute("aria-label", mostrando ? "Mostrar senha" : "Ocultar senha");
    });

    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const usuario = campoEmail.value;
        const senha = campoSenha.value;

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
