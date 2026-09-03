# Dunamis Services

App (PWA) para controlar obras, ponto de funcionários de campo, RH e SST.
Funciona instalado no celular (Adicionar à tela de início), sem precisar
de loja de aplicativo.

## Como testar agora (modo local, sem Firebase)

1. Abra `index.html` num navegador (ou publique num servidor estático).
2. Digite qualquer e-mail/senha — no modo local, o login não é validado.
3. Cadastre uma obra em **Obras**, depois um funcionário em **Funcionários**
   (associe à obra), depois teste **Ponto**.

Nesse modo os dados ficam só no navegador/aparelho (localStorage) — bom
para validar as telas antes de configurar a nuvem. O controle de acesso
por papel (RH só vê RH, etc.) não se aplica aqui — localmente todo
mundo vira "admin" e enxerga tudo, já que não existem contas de
verdade nesse modo.

## Ligar a nuvem (Firebase) — necessário para uso real

Com vários funcionários e vários setores (RH, SST, financeiro) vendo os
mesmos dados, é obrigatório configurar o Firebase:

1. Crie um projeto em https://console.firebase.google.com (recomendo um
   projeto **novo**, separado do `erp-credito`, já que são sistemas
   diferentes).
2. Ative **Authentication → E-mail/senha** e crie os usuários (um por
   pessoa que vai acessar: campo, RH, SST, financeiro).
3. Ative **Firestore Database** (modo produção).
4. Cole as regras de `firestore.rules` deste projeto no Console.
5. Em **Configurações do projeto → Seus apps → Web**, copie a config e
   cole em [js/firebase-init.js](js/firebase-init.js).
6. Publique os arquivos num host (Firebase Hosting, Netlify, etc.) com
   HTTPS — geolocalização e "instalar como app" exigem HTTPS.
7. **Crie o primeiro admin manualmente**: Firestore Database → Dados →
   Iniciar coleção `usuarios` → ID do documento = **seu e-mail em
   minúsculo** → campo `papel` (string) = `admin`. Sem isso, ninguém
   consegue entrar em nada (nem na tela de liberar acesso dos outros).
   Depois desse primeiro, os demais usuários são liberados pela própria
   tela **Usuários** dentro do app.
Anexos (nota fiscal, orçamento) em Obras/Navios não precisam de
nenhum passo extra — o arquivo fica guardado direto no Firestore
(ver docs/MODELO-DE-DADOS.md). O Firebase Storage foi propositalmente
descartado aqui porque hoje só está disponível no plano pago (Blaze).

## Estrutura

```
index.html          login
manifest.json        config do PWA (instalar no celular)
sw.js                cache offline básico
css/style.css         estilo único, mobile-first
js/firebase-init.js   config do Firebase (edite aqui)
js/dados.js            camada de dados (Firestore ou local, mesma API)
js/auth-guard.js       protege as páginas internas (exige login)
js/permissoes.js        controla o acesso por papel (rh/sst/financeiro/campo/admin)
js/modules/            um arquivo por módulo (obras.js, funcionarios.js, ponto.js, usuarios.js)
pages/                  telas internas
docs/MODELO-DE-DADOS.md coleções do Firestore e o que falta construir
```

## Módulos prontos
- **Obras** — cadastro, status (planejada/andamento/concluída/parada), com busca
  por nome e filtro por status na lista; botão 📄 Relatório mostra quantos
  funcionários estão alocados na obra e gera automaticamente o cruzamento de
  mão de obra + despesas (com tipo e observação) contra o valor do contrato,
  já calculando margem ou prejuízo — *admin*. Na mão de obra, funcionário
  **atualmente alocado** à obra entra pelo salário mensal (× meses corridos
  desde o início da obra); quem não está alocado mas tem ponto batido ali
  (ex: terceirizado avulso) entra pelas horas × custo/hora
- **Funcionários** — cadastro, obra atual, direito a vale-transporte/alimentação,
  espelho de ponto, abono de falta, resumo no topo (total de ativos e quantos
  estão em cada obra, sempre com o total geral independente de filtro), busca
  por nome e filtro por obra e por status, e exportação da lista (nome/função/
  obra/status, seguindo o filtro ativo) em Excel (CSV) ou PDF — *rh*
- **Ponto** — check-in/check-out por obra com geolocalização — *campo*
  (login único compartilhado, ex: `campo@dunamis.com`, num aparelho fixo
  da obra/encarregado; cada funcionário confirma com o próprio PIN de
  4 dígitos, cadastrado em **Funcionários**, para evitar que um bata o
  ponto pelo outro)
- **Despesas** — material, transporte, aluguel, água, luz, outros, por obra,
  com total, campo de observação livre, opção de criar novos tipos próprios
  direto no formulário ("+ Adicionar novo tipo...") e anexo de comprovante/
  nota fiscal (botão 📎, até ~700KB, guardado no Firestore) — *financeiro*
- **Navios** — cadastro de embarcação + vendas de mercadoria/serviço por navio, com status de pagamento — *financeiro*
- **Anexos** — nota fiscal/orçamento/comprovante anexados em Obras, Navios e
  Despesas (botão 📎, até ~700KB, guardado no Firestore)
- **SST** — ASO, EPI, treinamentos (NR-35 etc.) e ocorrências, com aviso de vencido/vencendo — *sst*
- **Financeiro** — fechamento mensal por obra: mão de obra (salário mensal de
  quem está alocado na obra + horas × custo/hora de quem não está, mesma
  regra do Relatório de Obras) cruzada com as Despesas lançadas, mostrando o
  custo total por obra no mês e a margem/prejuízo contra o valor do
  contrato — *financeiro*
- **Usuários** — libera o acesso de cada e-mail a um setor — *admin*

## Próximos passos (ver docs/MODELO-DE-DADOS.md)
- Upload de foto/laudo em SST (ASO, ocorrências) — mesma ideia dos
  anexos de Obras/Navios, só falta ligar nessas telas também
- Exportar o fechamento do Financeiro em PDF/planilha
