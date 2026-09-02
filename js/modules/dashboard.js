// =====================================
// PAINEL — mostra só os cards liberados para os papéis do usuário
// =====================================

(async function () {
    await carregarPapel();

    if (!papeisUsuario) {
        document.getElementById("gradeCards").style.display = "none";
        document.getElementById("avisoSemPapel").style.display = "block";
        return;
    }

    const ehAdmin = papeisUsuario.includes("admin");

    document.querySelectorAll("#gradeCards .card-modulo").forEach((card) => {
        const papeis = card.dataset.papeis.split(",").filter(Boolean);
        const liberado = ehAdmin || papeis.some((p) => papeisUsuario.includes(p));
        card.style.display = liberado ? "" : "none";
    });
})();
