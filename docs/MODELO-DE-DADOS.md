# Modelo de dados — Dunamis Services

Coleções no Firestore. Acesso controlado por papel — ver seção
**Usuários e papéis** no fim deste documento e [firestore.rules](../firestore.rules).

## obras
Unidade central — tudo (ponto, despesa, material) se liga a uma obra.

```
obras/{obraId}
  nome            string
  cliente         string   (ex: "Enave")
  endereco        string
  valor           number   (R$, opcional — valor do contrato/nota fiscal)
  aliquotaImposto number   (%, opcional — imposto sobre a nota; usado no
                            Financeiro pra calcular valor líquido e margem)
  status          "planejada" | "andamento" | "concluida" | "parada"
  dataInicio      date
  dataPrevisaoFim date
  responsavelId   string   (funcionarioId do encarregado/técnico)
  criadoEm        timestamp
```

## funcionarios
```
funcionarios/{funcionarioId}
  nome              string
  cpf               string
  cargo             string
  dataAdmissao      date
  status            "ativo" | "inativo" | "afastado"
  telefone          string
  obraAtualId       string   (referência obras/{obraId})
  pin               string   (4 dígitos, opcional — confirma quem bate o ponto no
                              login compartilhado "campo"; não é credencial de
                              segurança, texto puro é aceitável)
  salario           number   (R$/mês, opcional — se preenchido, custoHora é
                              calculado sozinho: salário ÷ 220h, jornada CLT)
  custoHora         number   (R$/hora — calculado a partir do salário, ou
                              digitado na mão para diarista/terceirizado sem
                              salário fixo; é o que o Financeiro usa)
  beneficios
    valeTransporte  bool
    valeAlimentacao bool
    motivoExclusao  string   (por que não tem direito, se for o caso)
```

## alocacoes
Histórico de qual funcionário passou por qual obra (equipe varia por obra).
```
alocacoes/{id}
  funcionarioId   string
  obraId          string
  dataInicio      date
  dataFim         date | null
  funcao          string
```

## pontos
Check-in/check-out mobile com geolocalização.
```
pontos/{id}
  funcionarioId   string
  obraId          string
  tipo            "entrada" | "saida"
  timestamp       timestamp
  geo             { lat, lng, precisao }
  fotoUrl         string | null
```

## despesas
Cobre material, transporte, aluguel, água, luz — tudo rateado por obra.
```
despesas/{id}
  obraId          string
  tipo            "material" | "transporte" | "aluguel" | "agua" | "luz" | "outros"
  descricao       string
  valor           number
  data            date
  comprovanteUrl  string | null
  lancadoPor      string   (funcionarioId)
```

## sst (segurança do trabalho)
Tela única com 4 abas. Cada uma com badge de vencido/vencendo/válido
calculado a partir da data de validade (não fica salvo, é calculado
na hora de exibir).
```
aso/{id}            funcionarioId, tipo(admissional/periodico/demissional), dataRealizacao, dataValidade
epis/{id}           funcionarioId, item, dataEntrega, validade
treinamentos/{id}   funcionarioId, norma (NR-35, NR-10...), dataRealizacao, dataValidade
ocorrencias/{id}    obraId, funcionarioId (opcional), descricao, data
```
Upload de foto/laudo (`arquivoUrl`/`fotoUrl`) ainda não existe — precisa
de Firebase Storage configurado, que é um passo à parte.

## Relatório por obra
Botão "📄 Gerar relatório" em cada item de Obras. Abre uma aba nova com
HTML impresso (Ctrl+P / "Salvar como PDF" — sem lib de PDF, sem custo).
Não fica salvo em nenhum lugar, é montado na hora com o mesmo cálculo
do Financeiro (mão de obra por funcionário, despesas, valor líquido,
margem), só que olhando **todos os períodos** da obra, não um mês.

## financeiro (fechamento)
Não é coleção própria — a tela cruza `pontos` (pares entrada/saída ×
`custoHora` do funcionário = mão de obra) com `despesas`, agrupado por
obra e por mês. Nada é salvo, é recalculado toda vez que a tela abre.

No detalhe de cada obra, se ela tiver `valor` preenchido, mostra também:
valor líquido (valor − imposto da nota, usando `aliquotaImposto`) e a
margem (líquido − custo acumulado da obra em **todos** os meses, não só
o mês filtrado — comparar o valor total do contrato com o custo de um
mês só daria um número errado numa obra de vários meses).

## usuarios
Define o que cada pessoa pode acessar. Documento indexado pelo **e-mail
em minúsculo** (não por uid), para o admin conseguir cadastrar o acesso
sabendo só o e-mail — sem precisar ir atrás do UID no Authentication.
```
usuarios/{email}
  nome    string
  papel   "admin" | "rh" | "sst" | "financeiro" | "campo"
```

## Usuários e papéis

A conta de login (e-mail/senha) é criada no **Console do Firebase →
Authentication** — isso continua manual, fora do app. O que o app
controla é *o que essa conta pode acessar*, via `usuarios/{email}`.

| Papel | Acessa |
|---|---|
| admin | tudo, inclusive a tela Usuários, e é o único que pode **excluir** funcionário ou despesa |
| rh | Funcionários (cadastra e edita; excluir é só admin) |
| sst | SST (ASO, EPI, treinamentos, ocorrências) |
| financeiro | Despesas / Financeiro (lança e edita; excluir é só admin) |
| campo | Ponto |

Quem não tem papel configurado vê uma tela de "sem permissão" ao
logar. O primeiro admin precisa ser criado manualmente no Firestore
(ver instrução no topo de [firestore.rules](../firestore.rules)) —
depois disso, os demais acessos são liberados pela própria tela
Usuários.

## Status do MVP
- [x] Obras (CRUD)
- [x] Funcionários (CRUD + benefícios)
- [x] Ponto mobile (check-in/out por obra + geolocalização)
- [x] Papéis de usuário (RH / SST / financeiro / campo) com permissões no Firestore
- [x] Despesas / materiais por obra
- [x] SST (ASO, EPI, treinamentos, ocorrências)
- [x] Financeiro (fechamento, rateio de custo por obra)

## Próximas ideias (não pedidas ainda, ficam anotadas)
- Upload de foto/laudo em SST (ASO, ocorrências) — depende de Firebase Storage
- Exportar o fechamento do Financeiro em PDF/planilha
- Papel "campo" hoje lê a lista inteira de funcionários ativos no Ponto;
  se a equipe crescer muito, considerar restringir por obra selecionada
