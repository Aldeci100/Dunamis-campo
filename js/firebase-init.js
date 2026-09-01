// =====================================================
// FIREBASE - CONFIGURAÇÃO
// =====================================================
// Crie um projeto novo em https://console.firebase.google.com
// (separado do erp-credito) e cole a config dele aqui.
// Console → Configurações do projeto → Seus apps → SDK.
//
// Enquanto a config abaixo continuar com o valor de exemplo, o app
// funciona 100% local (localStorage, sem login) só para você testar
// as telas. Para RH/SST verem os dados de todo mundo em tempo real,
// a nuvem precisa estar configurada.

const firebaseConfig = {
    apiKey: "AIzaSyA-DETimdV-ke25elm5XYaZrdKYB9HpPTQ",
    authDomain: "dunamisgestao-f4724.firebaseapp.com",
    projectId: "dunamisgestao-f4724",
    storageBucket: "dunamisgestao-f4724.firebasestorage.app",
    messagingSenderId: "906834004938",
    appId: "1:906834004938:web:35bea472dd9a67ccad9d33"
};

const firebaseConfigurado = firebaseConfig.apiKey !== "SUA_API_KEY_AQUI";

let firebaseAuth = null;
let firebaseDb = null;

if (firebaseConfigurado && window.firebase) {
    firebase.initializeApp(firebaseConfig);
    firebaseAuth = firebase.auth();
    if (firebase.firestore) firebaseDb = firebase.firestore();
}
