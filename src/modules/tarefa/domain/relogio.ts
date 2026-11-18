// Porta de tempo: o domínio/aplicação nunca chamam `new Date()` direto, para os testes
// controlarem datas e ordem.
export interface Relogio {
  agora(): Date;
}
