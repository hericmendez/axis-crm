# MVC na prática

## Model

Mongoose schema/model.

Exemplo:

```text
models/Lead.ts
```

## View

Como o Axis é principalmente WhatsApp/API, a resposta HTTP/JSON funciona como representação de saída. Um React separado será a interface administrativa.

## Controller

Exemplo conceitual:

```ts
async create(req, res) {
  const lead = await leadService.create(req.body);
  return res.status(201).json(lead);
}
```

Sem regra complexa.

## Service

```ts
async create(input) {
  // valida regras
  // normaliza dados
  // chama repository
}
```

## Repository

```ts
async create(data) {
  return LeadModel.create(data);
}
```
