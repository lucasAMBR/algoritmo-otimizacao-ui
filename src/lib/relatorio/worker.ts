// ---------------------------------------------------------------------
// Web Worker — Job em background (equivalente a uma Queue no browser).
//
// O processamento das ~280 simulações roda fora da main thread, evitando
// o congelamento da UI ("timeout"). O progresso e o resultado final são
// enviados por mensagens (postMessage), análogo a notificações WebSocket.
//
// Esta camada NÃO gera o PDF: apenas calcula e coleta métricas. A geração
// visual do PDF acontece na main thread (ver pdf.tsx).
// ---------------------------------------------------------------------

import { gerarRelatorio, type OpcoesRelatorio } from './simulacao';
import type { ProgressoRelatorio } from './tipos';

self.onmessage = (event: MessageEvent<OpcoesRelatorio>) => {
    const enviar = (msg: ProgressoRelatorio) => self.postMessage(msg);
    try {
        const dados = gerarRelatorio(enviar, event.data ?? {});
        enviar({ tipo: 'concluido', dados });
    } catch (e) {
        enviar({ tipo: 'erro', mensagem: e instanceof Error ? e.message : String(e) });
    }
};
