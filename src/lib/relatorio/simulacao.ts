// ---------------------------------------------------------------------
// Camada de orquestração / coleta de métricas.
//
// - Padrão Strategy: cada algoritmo é encapsulado por um objeto que
//   implementa `AlgoritmoStrategy`, padronizando a chamada `executar`.
// - Rigor estatístico: cada Strategy é executada sobre o MESMO conjunto
//   de instâncias independentes (20 por padrão) e o resultado é a média.
// - Esta camada é pura e roda dentro do Web Worker (background job).
// ---------------------------------------------------------------------

import { gerarInstancias, type InstanciaProblema } from './dominio';
import {
    executarAG,
    executarSE,
    executarSET,
    executarTS,
    type ParametrosAG,
    type ParametrosTS,
} from './algoritmos';
import type {
    DadosRelatorio,
    MetricaExecucao,
    ParametrosAGDetalhe,
    ProgressoRelatorio,
    ResultadoMedio,
} from './tipos';

// ---------------------------------------------------------------------
// Strategy
// ---------------------------------------------------------------------
export interface AlgoritmoStrategy {
    metodo: string;
    configuracao: string;
    // Presente apenas nas estratégias do AG: os 5 parâmetros usados.
    agParams?: ParametrosAGDetalhe;
    executar(inst: InstanciaProblema): MetricaExecucao;
}

function criarStrategyAG(configuracao: string, params: ParametrosAG): AlgoritmoStrategy {
    return {
        metodo: 'AG',
        configuracao,
        agParams: { tp: params.tp, tc: params.tc, tm: params.tm, ig: params.ig, ng: params.ng },
        executar: (inst) => executarAG(inst, params),
    };
}

function criarStrategySE(): AlgoritmoStrategy {
    return {
        metodo: 'SE',
        configuracao: 'Padrão (Steepest Ascent)',
        executar: (inst) => executarSE(inst),
    };
}

function criarStrategySET(tentativas: number): AlgoritmoStrategy {
    return {
        metodo: 'SET',
        configuracao: `TMAX = ${tentativas}`,
        executar: (inst) => executarSET(inst, tentativas),
    };
}

function criarStrategyTS(params: ParametrosTS): AlgoritmoStrategy {
    return {
        metodo: 'TS',
        configuracao: `TI=${params.ti}, TF=${params.tf}, FR=${params.fr}`,
        executar: (inst) => executarTS(inst, params),
    };
}

// ---------------------------------------------------------------------
// Configuração base (baseline) e variações da Parte I
// ---------------------------------------------------------------------
export const BASELINE_AG: ParametrosAG = { tp: 50, tc: 0.5, tm: 0.2, ig: 0.1, ng: 50 };

const VARIACOES_AG = {
    TP: [10, 50, 100],
    TC: [20, 50, 80], // percentuais — convertidos para fração (0..1)
    TM: [0, 0.2, 0.8],
    IG: [0, 0.1, 0.7],
    NG: [10, 50, 100, 200],
};

function construirStrategiesParteI(): AlgoritmoStrategy[] {
    // Grid completo (produto cartesiano) de todas as combinações dos 5
    // parâmetros: TP × TC × TM × IG × NG = 3·3·3·3·4 = 324 configurações.
    // Com 20 simulações por configuração, totaliza 6480 execuções do AG.
    const lista: AlgoritmoStrategy[] = [];
    let indice = 0;

    for (const tp of VARIACOES_AG.TP) {
        for (const tc of VARIACOES_AG.TC) {
            for (const tm of VARIACOES_AG.TM) {
                for (const ig of VARIACOES_AG.IG) {
                    for (const ng of VARIACOES_AG.NG) {
                        indice += 1;
                        const rotulo = `C${String(indice).padStart(3, '0')}`;
                        lista.push(criarStrategyAG(rotulo, { tp, tc: tc / 100, tm, ig, ng }));
                    }
                }
            }
        }
    }

    return lista;
}

function construirStrategiesBasicos(n: number): AlgoritmoStrategy[] {
    const paramsTS: ParametrosTS[] = [
        { ti: 2000, tf: 0.1, fr: 0.8 },
        { ti: 2000, tf: 0.01, fr: 0.8 },
        { ti: 2000, tf: 0.1, fr: 0.9 },
        { ti: 2000, tf: 0.01, fr: 0.9 },
    ];
    return [
        criarStrategySE(),
        criarStrategySET(n), // [N, N/2]
        criarStrategySET(Math.floor(n / 2)),
        ...paramsTS.map(criarStrategyTS),
    ];
}

// ---------------------------------------------------------------------
// Execução com rigor estatístico (médias de N simulações independentes)
// ---------------------------------------------------------------------
function executarComRigor(strategy: AlgoritmoStrategy, instancias: InstanciaProblema[]): ResultadoMedio {
    let somaGanhoPct = 0;
    let somaPontuacao = 0;
    let somaTempo = 0;
    let somaIter = 0;
    let somaDemandas = 0;
    let somaHoras = 0;
    for (const inst of instancias) {
        const m = strategy.executar(inst);
        somaGanhoPct += m.ganhoPercentual;
        somaPontuacao += m.ganho;
        somaTempo += m.tempoMs;
        somaIter += m.iteracoes;
        somaDemandas += m.demandasEntregues;
        somaHoras += m.horasUsadas;
    }
    const k = instancias.length;
    return {
        metodo: strategy.metodo,
        configuracao: strategy.configuracao,
        ganhoMedio: somaGanhoPct / k,
        pontuacaoMedia: somaPontuacao / k,
        tempoMedioMs: somaTempo / k,
        iteracoesMedia: somaIter / k,
        demandasMedia: somaDemandas / k,
        horasMedia: somaHoras / k,
        simulacoes: k,
        agParams: strategy.agParams,
    };
}

export interface OpcoesRelatorio {
    n?: number;
    simulacoes?: number;
}

// ---------------------------------------------------------------------
// Ponto de entrada do Job: roda toda a Parte I, elenca o Top 3 e roda a
// Parte II, devolvendo a estrutura completa para a geração do PDF.
// ---------------------------------------------------------------------
export function gerarRelatorio(
    progresso: (p: ProgressoRelatorio) => void,
    opcoes: OpcoesRelatorio = {},
): DadosRelatorio {
    const n = opcoes.n ?? 50;
    const simulacoes = opcoes.simulacoes ?? 20;

    const instancias = gerarInstancias(simulacoes, n);
    const capacidadeMedia =
        instancias.reduce((acc, i) => acc + i.capacidade, 0) / instancias.length;
    const cargaTotalMedia =
        instancias.reduce((acc, i) => acc + i.demandas.reduce((s, d) => s + d.tempo, 0), 0)
        / instancias.length;
    const backlogExemplo = instancias[0].demandas.slice(0, 12).map((d) => ({
        nome: d.nome,
        prioridade: d.prioridade,
        tempo: d.tempo,
    }));

    const stratsI = construirStrategiesParteI();
    const stratsII = construirStrategiesBasicos(n);
    const total = stratsI.length + stratsII.length;
    let feito = 0;

    const parteI: ResultadoMedio[] = [];
    for (const s of stratsI) {
        parteI.push(executarComRigor(s, instancias));
        feito += 1;
        progresso({ tipo: 'progresso', fase: 'Parte I — Análise de Parâmetros (AG)', atual: feito, total });
    }

    const topTresAG = [...parteI].sort((a, b) => b.ganhoMedio - a.ganhoMedio).slice(0, 3);

    const parteII: ResultadoMedio[] = [];
    for (const s of stratsII) {
        parteII.push(executarComRigor(s, instancias));
        feito += 1;
        progresso({ tipo: 'progresso', fase: 'Parte II — Comparativo (SE / SET / TS)', atual: feito, total });
    }

    const comparativoFinal = [...topTresAG, ...parteII];

    return {
        geradoEm: new Date().toISOString(),
        n,
        simulacoesPorConfig: simulacoes,
        capacidadeMedia: +capacidadeMedia.toFixed(1),
        cargaTotalMedia: +cargaTotalMedia.toFixed(1),
        backlogExemplo,
        baselineAG: {
            TP: BASELINE_AG.tp,
            'TC (%)': BASELINE_AG.tc * 100,
            TM: BASELINE_AG.tm,
            IG: BASELINE_AG.ig,
            NG: BASELINE_AG.ng,
        },
        parteI,
        topTresAG,
        parteII,
        comparativoFinal,
    };
}
