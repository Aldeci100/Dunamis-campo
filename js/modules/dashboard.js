// =====================================
// PAINEL — mostra só os cards liberados para o papel do usuário
// =====================================

(async function () {
    await carregarPapel();

    if (!papelUsuario) {
        document.getElementById("gradeCards").style.display = "none";
        document.getElementById("avisoSemPapel").style.display = "block";
        return;
    }

    document.querySelectorAll("#gradeCards .card-modulo").forEach((card) => {
        const papeis = card.dataset.papeis.split(",").filter(Boolean);
        const liberado = papelUsuario === "admin" || papeis.includes(papelUsuario);
        card.style.display = liberado ? "" : "none";
    });
})();
