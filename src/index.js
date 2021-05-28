const { response } = require("express");
const express = require("express");
const { v4: uuidv4 } = require("uuid");

const app = express();

app.use(express.json());

const customers = [];

//Middleware que verifica se o CPF é existente
function verifyIfExistsAccountCPF(request, response, next) {
  const { cpf } = request.headers;

  const customer = customers.find(customer => customer.cpf === cpf);

  if (!customer) {
    return response.status(400).json({ error: "Customer not found!" })
  }

  //Método de passar o customer do Middleware para as demais requisições
  request.customer = customer;

  return next();
}

//Função que faz o balanço geral da conta (Depositos - Saques)
function getBalance(statement) {
  const balance = statement.reduce((acc, operation) => {
    if(operation.type === 'credit'){
      return acc + operation.amount;
    }else{
      return acc - operation.amount;
    }
  }, 0);

  return balance;
}

//Rota que cria contas
app.post("/account", (request, response) => {
  const { cpf, name } = request.body;
  
  //Some retorna true or false
  const customersAlreadyExists = customers.some(
    (customer) => customer.cpf === cpf
  );
  
  if (customersAlreadyExists) {
    return response.status(400).json({ error: "Customer already exists!" });
  }

  customers.push({
    cpf,
    name,
    id: uuidv4(),
    statement: [],
  });

  return response.status(201).send();
});

/**
 * Formas de inserir um middleware
 * 1 - Direto na requisição =>  app.get("/recurso", middleware1, middleware2, (request, response) (Otimizado quando apenas uma rota usa o middleware)
 * 2 - Usando app.use => app.use(middleware1) (colocar am cima das rotas que vão utilizar. Otimizado quando várias rotas usam o mesmo middleware)
 */

//Chamada do Middleware que verifica o CPF com formato escolhido  de uso com app.use
app.use(verifyIfExistsAccountCPF);

//Rota que lista o extrato bancário do cliente
app.get("/statement", (request, response) => {
  const { customer } = request;
  return response.json(customer.statement)
});

//Rota que faz o deposito na conta
app.post("/deposit", (request, response) => {
  const { description, amount } = request.body;

  const { customer } = request;

  const statementOperation = {
    description,
    amount,
    created_at: new Date(),
    type: "credit"
  };

  customer.statement.push(statementOperation);

  return response.status(201).send();
});

//Rota que fz o saque na conta
app.post("/withdraw", (request, response) => {
  const { amount } = request.body;
  const { customer } = request;

  const balance = getBalance(customer.statement);

  if(balance < amount){
    return response.status(400).json({ error: "insufficient funds!" });
  }

  const statementOperation = {
    amount,
    created_at: new Date(),
    type: "debit"
  };

  customer.statement.push(statementOperation);

  return response.status(201).send();
});

//Rota que lista o extrato bancário filtrado pelo dia
app.get("/statement/date", (request, response) => {
  const { customer } = request;
  const { date } = request.query;
  
  //Pega o dia independente da hora
  const dateFormat = new Date(date + " 00:00");

  const statement = customer.statement.filter((statement) => statement.created_at.toDateString() === new Date(dateFormat).toDateString());

  if(statement.length === 0){
    return response.status(404).json({ message: "You don't have any statement in this day!" })
  }

  return response.json(statement)
});

//Rota que lista o balance geral do cliente
app.get("/balance", (request, response) => {
  const { customer } = request;

  const balance = getBalance(customer.statement);

  return response.json(balance);
})

//Rota que permite a alteração de informações da conta (Por aqui somente o nome pois o CPF e o ID são imutáveis, ou seja, informações críticas)
app.put("/account/", (request, response) => {
  const { name } = request.body;
  const { customer } = request;

  customer.name = name;

  return response.status(201).send();
});

//Rota que permite a listagem de informações da conta (Nome, CPF, ID e Extrato Bancário Completo)
app.get("/account", (request, response) => {
  const { customer } = request;

  return response.json(customer);
});

//Rota que permite a deleção da conta bancária
app.delete("/account/:id", (request, response) => {
  const { id } = request.params;
  const { customer } = request;
  
  const balance = getBalance(customer.statement); 
  const accountIndex = customers.findIndex(customer => customer.id === id);

  if (accountIndex === -1) {
    return response.status(404).json({ error: "Account Not Found" });
  }
  
  if (balance !== 0){
    return response.status(400).json({ error: "To delete an account, it isn't have found" });
  }

  //Splice espera 2 parâmetros: 1º: Onde começa a remoção; 2º: Onde termina a remoção. (Isso tudo claro dentro de um array)
  customers.splice(accountIndex, 1);

  return response.status(200).json(customers);
});

app.listen(3334);