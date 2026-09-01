// =====================================================
// CAMADA DE DADOS
// =====================================================
// Mesma coleção funciona no Firestore (nuvem, tempo real) ou no
// localStorage (modo local, enquanto o Firebase não está configurado).
// Os módulos (obras.js, funcionarios.js, ponto.js) só chamam estas
// funções e não precisam saber qual dos dois está sendo usado.

function chaveLocal(colecao) {
    return "gc_" + colecao;
}

function lerLocal(colecao) {
    try {
        return JSON.parse(localStorage.getItem(chaveLocal(colecao))) || [];
    } catch {
        return [];
    }
}

function gravarLocal(colecao, lista) {
    localStorage.setItem(chaveLocal(colecao), JSON.stringify(lista));
    // "storage" só dispara em outras abas; disparamos manualmente para
    // que a própria aba que salvou também atualize a tela na hora.
    window.dispatchEvent(new CustomEvent("gc-dados-locais", { detail: { colecao } }));
}

function gerarId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function listarColecao(colecao) {
    if (firebaseConfigurado) {
        const snap = await firebaseDb.collection(colecao).get();
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
    return lerLocal(colecao);
}

async function salvarDocumento(colecao, dados, id) {
    if (firebaseConfigurado) {
        if (id) {
            await firebaseDb.collection(colecao).doc(id).set(dados, { merge: true });
            return id;
        }
        const ref = await firebaseDb.collection(colecao).add(dados);
        return ref.id;
    }

    const lista = lerLocal(colecao);
    if (id) {
        const i = lista.findIndex((item) => item.id === id);
        if (i >= 0) lista[i] = { ...lista[i], ...dados, id };
        else lista.push({ ...dados, id });
    } else {
        id = gerarId();
        lista.push({ ...dados, id });
    }
    gravarLocal(colecao, lista);
    return id;
}

async function removerDocumento(colecao, id) {
    if (firebaseConfigurado) {
        await firebaseDb.collection(colecao).doc(id).delete();
        return;
    }
    gravarLocal(colecao, lerLocal(colecao).filter((item) => item.id !== id));
}

// Observa mudanças na coleção. Retorna função para cancelar a observação.
function observarColecao(colecao, callback) {
    if (firebaseConfigurado) {
        return firebaseDb.collection(colecao).onSnapshot((snap) => {
            callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
    }

    callback(lerLocal(colecao));

    const escutaOutraAba = (e) => {
        if (e.key === chaveLocal(colecao)) callback(lerLocal(colecao));
    };
    const escutaMesmaAba = (e) => {
        if (e.detail.colecao === colecao) callback(lerLocal(colecao));
    };

    window.addEventListener("storage", escutaOutraAba);
    window.addEventListener("gc-dados-locais", escutaMesmaAba);

    return () => {
        window.removeEventListener("storage", escutaOutraAba);
        window.removeEventListener("gc-dados-locais", escutaMesmaAba);
    };
}
