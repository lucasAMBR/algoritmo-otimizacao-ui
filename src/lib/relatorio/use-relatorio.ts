// ---------------------------------------------------------------------
// Hook que orquestra o Job em background (Web Worker) a partir da UI.
//
// Fluxo:
//  1. dispara o worker (Queue) -> status "gerando";
//  2. recebe mensagens de progresso (análogo a notificações WebSocket);
//  3. ao concluir o cálculo, gera o PDF na main thread e disponibiliza
//     o download pronto -> status "pronto".
// ---------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OpcoesRelatorio } from './simulacao';
import type { ProgressoRelatorio } from './tipos';

export type StatusRelatorio = 'idle' | 'gerando' | 'montando-pdf' | 'pronto' | 'erro';

export interface RelatorioPronto {
    url: string;
    nomeArquivo: string;
}

interface EstadoRelatorio {
    status: StatusRelatorio;
    fase: string;
    atual: number;
    total: number;
    erro: string | null;
    resultado: RelatorioPronto | null;
}

const ESTADO_INICIAL: EstadoRelatorio = {
    status: 'idle',
    fase: '',
    atual: 0,
    total: 0,
    erro: null,
    resultado: null,
};

export function useRelatorio() {
    const [estado, setEstado] = useState<EstadoRelatorio>(ESTADO_INICIAL);
    const workerRef = useRef<Worker | null>(null);
    const urlRef = useRef<string | null>(null);

    const limpar = useCallback(() => {
        workerRef.current?.terminate();
        workerRef.current = null;
        if (urlRef.current) {
            URL.revokeObjectURL(urlRef.current);
            urlRef.current = null;
        }
    }, []);

    useEffect(() => limpar, [limpar]);

    const gerar = useCallback(
        (opcoes: OpcoesRelatorio = {}) => {
            limpar();
            setEstado({ ...ESTADO_INICIAL, status: 'gerando', fase: 'Iniciando job...' });

            const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
            workerRef.current = worker;

            worker.onmessage = async (event: MessageEvent<ProgressoRelatorio>) => {
                const msg = event.data;
                if (msg.tipo === 'progresso') {
                    setEstado((s) => ({ ...s, status: 'gerando', fase: msg.fase, atual: msg.atual, total: msg.total }));
                    return;
                }
                if (msg.tipo === 'erro') {
                    setEstado((s) => ({ ...s, status: 'erro', erro: msg.mensagem }));
                    limpar();
                    return;
                }
                // concluido: monta o PDF (camada visual) na main thread
                setEstado((s) => ({ ...s, status: 'montando-pdf', fase: 'Montando PDF...' }));
                try {
                    const { gerarPdfBlob } = await import('./pdf');
                    const blob = await gerarPdfBlob(msg.dados);
                    const url = URL.createObjectURL(blob);
                    urlRef.current = url;
                    const nomeArquivo = `relatorio-otimizacao-${msg.dados.geradoEm.slice(0, 10)}.pdf`;
                    setEstado((s) => ({ ...s, status: 'pronto', resultado: { url, nomeArquivo } }));
                } catch (e) {
                    setEstado((s) => ({ ...s, status: 'erro', erro: e instanceof Error ? e.message : String(e) }));
                } finally {
                    worker.terminate();
                    workerRef.current = null;
                }
            };

            worker.onerror = (e) => {
                setEstado((s) => ({ ...s, status: 'erro', erro: e.message || 'Falha no job de relatório' }));
                limpar();
            };

            worker.postMessage(opcoes);
        },
        [limpar],
    );

    const resetar = useCallback(() => {
        limpar();
        setEstado(ESTADO_INICIAL);
    }, [limpar]);

    return { estado, gerar, resetar };
}
