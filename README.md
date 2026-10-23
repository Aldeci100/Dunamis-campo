# Dunamis Services

App (PWA) para controlar obras, ponto de funcionários de campo, RH e SST.
Funciona instalado no celular (Adicionar à tela de início), sem precisar
de loja de aplicativo. Layout responsivo: no celular fica em uma coluna
só (mobile-first, essencial pro Ponto em campo); em telas largas
(computador, a partir de ~860px), as listas e cards viram grade de
várias colunas pra aproveitar o espaço horizontal, em vez de ficar tudo
empilhado numa coluna estreita com rolagem comprida.

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
  por nome e filtro por status na lista; botões **▶️ Iniciar obra** (planejada/
  parada → andamento, preenche a data de início se estiver vazia) e
  **✅ Finalizar obra** (andamento → concluída, preenche a data de fim se
  estiver vazia) direto no card, sem precisar abrir o formulário — o selo
  de status muda de cor na hora. Botão 📄 Relatório mostra quantos
  funcionários estão alocados na obra e gera automaticamente o cruzamento de
  mão de obra + despesas (com tipo e observação) contra o valor do contrato,
  já calculando margem ou prejuízo — *admin*. Na mão de obra, funcionário
  **atualmente alocado** à obra entra pelo salário mensal (× meses corridos
  desde o início da obra); quem não está alocado mas tem ponto batido ali
  (ex: terceirizado avulso) entra pelas horas × custo/hora. Botão
  🧾 Notas Fiscais registra número, valor, data de emissão e **data de
  faturamento** de cada NF emitida — essa data alimenta sozinha o cálculo
  de impostos do mês em Obrigações
- **Funcionários** — cadastro, obra atual, direito a vale-transporte/alimentação,
  botão **🔑 Ver / trocar PINs de ponto** (lista todos os PINs de uma vez
  em ordem crescente, com busca por nome/cargo/PIN, destaca repetidos e em
  branco, gera PIN livre com um toque e salva por funcionário — é o mesmo
  campo PIN do cadastro),
  **periculosidade e insalubridade (%, opcionais)** — entram automaticamente
  no cálculo de FGTS, INSS e 13º em Obrigações, já que têm natureza salarial —
  espelho de ponto (uma linha por marcação: data, entrada/saída, hora, obra e
  localização com link pro Google Maps, mais o total do dia e do mês — pronto
  pra imprimir com assinaturas), abono de falta, resumo no topo (total de ativos e quantos
  estão em cada obra, sempre com o total geral independente de filtro), busca
  por nome e filtro por obra e por status, e exportação da lista (nome/função/
  obra/status, seguindo o filtro ativo) em Excel (CSV) ou PDF — *rh*
- **Ponto** — check-in/check-out por obra com geolocalização. Dois jeitos:
  - **Individual (recomendado)** — *funcionario*: cada funcionário tem login
    próprio (e-mail ou CPF + senha), instala o app no celular e vê/bate só o
    ponto **dele** (não enxerga os outros nem nada de obras/financeiro). A
    obra vem do cadastro dele. Cria-se em **Usuários** → marcar "Funcionário",
    escolher quem é e, se quiser, já preencher a senha inicial
  - **Aparelho da obra** — *campo*: login único compartilhado, ex:
    `campo@dunamis.com`, num aparelho fixo do encarregado; cada funcionário
    confirma com o próprio PIN de 4 dígitos (cadastrado em **Funcionários**)
    para evitar que um bata o ponto pelo outro
- **Despesas** — material, transporte, aluguel, água, luz, outros, por obra,
  com total, campo de observação livre, opção de criar novos tipos próprios
  direto no formulário ("+ Adicionar novo tipo..."), anexo de comprovante/
  nota fiscal (botão 📎, até ~700KB, guardado no Firestore) e busca por
  descrição (pra conferir rápido se uma despesa parecida já foi lançada
  antes de cadastrar de novo) — *financeiro*
- **Navios** — cadastro de embarcação + vendas de mercadoria/serviço por navio, com
  status de pagamento e botão 🧾 Notas Fiscais (registro de NF emitida, só de
  referência — o faturamento pra impostos já vem das Vendas, pra não contar
  em dobro) — *financeiro*
- **Anexos** — nota fiscal/orçamento/comprovante anexados em Obras, Navios e
  Despesas (botão 📎, até ~700KB, guardado no Firestore)
- **SST** — ASO, EPI, treinamentos (NR-35 etc.) e ocorrências, com aviso de vencido/vencendo — *sst*
- **Financeiro** — fechamento mensal por obra: mão de obra (salário mensal de
  quem está alocado na obra + horas × custo/hora de quem não está, mesma
  regra do Relatório de Obras) e Despesas, mostradas **separadas** (dois
  totais distintos, não um número só misturado) além do custo total e da
  margem/prejuízo contra o valor do contrato. Botão 🧾 **Gerar folha do mês
  (PDF)** monta a folha de pagamento detalhada de todos os funcionários
  ativos — nunca mistura despesas — separando claramente **o que vai pro
  bolso do funcionário** (líquido = bruto − INSS retido) do **que é
  imposto/encargo** (INSS retido + FGTS + INSS patronal), com o detalhe em
  R$ de periculosidade, insalubridade e hora extra de cada um, e a obra de
  cada um, pro mês selecionado no filtro acima. Mesma separação no
  relatório de Obrigações — *financeiro*
- **Usuários** — libera o acesso de cada e-mail (ou CPF) a um setor e, se
  quiser, já cria o login com senha inicial; vincula o acesso "Funcionário" ao
  cadastro da pessoa — *admin*
- **Obrigações** — folha do mês com o detalhe em R$ de cada adicional por
  funcionário (salário + periculosidade + insalubridade + **hora extra**,
  calculada a partir das horas batidas no Ponto além de 220h/mês, com
  adicional configurável — padrão 50%, mínimo da CF art. 7º) + FGTS 8% +
  INSS retido (tabela progressiva de referência) + INSS patronal 20% sobre
  a folha, separando **pagamento líquido ao funcionário** de **impostos/
  encargos**; 13º salário proporcional (avos trabalhados no ano, sobre
  salário + periculosidade + insalubridade — hora extra não entra no 13º,
  limitação conhecida) e alerta de férias vencidas ou perto de vencer (com
  base na data das últimas férias, cadastrada em Funcionários, ou na
  admissão se nunca tirou) — tudo calculado sozinho a partir dos
  funcionários ativos. Insalubridade usa como base o salário mínimo
  nacional, e o adicional de hora extra, configuráveis na própria tela
  (Configurações fiscais).
  Impostos da empresa (regime **Lucro Presumido**): PIS (0,65%), COFINS
  (3%), ISS e ICMS calculados por mês sobre o faturamento (Notas Fiscais de
  Obras entram pela data de faturamento delas + vendas dos Navios, ambos
  automaticamente; um campo manual complementa faturamento sem NF
  cadastrada ainda); IRPJ (15% + adicional
  de 10% acima de R$60.000) e CSLL (9%) calculados por **trimestre**
  (apuração real do Lucro Presumido, não é mensal). Alíquotas de ISS/ICMS e
  % de presunção de IRPJ/CSLL são configuráveis na própria tela — confirme
  com o contador antes de mudar os padrões. Tem também um botão de
  **relatório mensal em PDF** (🖨️, com seletor de mês) que junta folha,
  FGTS, INSS, impostos do mês e do trimestre e férias vencidas num único
  documento pra imprimir ou salvar — *rh*, *financeiro*

## Próximos passos (ver docs/MODELO-DE-DADOS.md)
- Upload de foto/laudo em SST (ASO, ocorrências) — mesma ideia dos
  anexos de Obras/Navios, só falta ligar nessas telas também
- Exportar o fechamento do Financeiro em PDF/planilha
