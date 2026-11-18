import type { Relogio } from "../domain/relogio";

export class RelogioDoSistema implements Relogio {
  agora(): Date {
    return new Date();
  }
}
