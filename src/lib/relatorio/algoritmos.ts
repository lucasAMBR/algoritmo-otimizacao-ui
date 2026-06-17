// ---------------------------------------------------------------------
// Implementações puras dos algoritmos de otimização.
// Cada função executa UMA simulação sobre uma instância e devolve as
// métricas padronizadas (ganho, tempo, iterações). Não há dependência
// de DOM/React, permitindo execução dentro do Web Worker.
//
// Portado a partir das telas já existentes:
//  - AG  -> algoritmos-geneticos.tsx
//  - SE/SET/TS -> algortimos-basicos.tsx
// ---------------------------------------------------------------------

import {
    avaliar,
    pontuacao,
    tempoTotal,
    type Demanda,
    type InstanciaProblema,
} from './dominio';
import type { MetricaExecucao } from './tipos';

// Monta as métricas de sprint de uma solução final (demandas selecionadas).
// O ganho percentual usa a fórmula clássica de melhoria em otimização
// (maximização): ((V_final - V_inicial) / |V_inicial|) * 100, onde V_inicial
// é a pontuação da solução inicial de referência da instância (inst.baseline).
function montarMetrica(
    inst: InstanciaProblema, sol: number[], inicio: number, iteracoes: number,
): MetricaExecucao {
    const { demandas, capacidade, baseline } = inst;
    const ganho = pontuacao(sol, demandas, capacidade);
    return {
        ganho,
        ganhoPercentual: ((ganho - baseline) / Math.abs(baseline)) * 100,
        tempoMs: performance.now() - inicio,
        iteracoes,
        demandasEntregues: sol.reduce((acc, v) => acc + (v === 1 ? 1 : 0), 0),
        horasUsadas: tempoTotal(sol, demandas),
    };
}

// =====================================================================
// ALGORITMO GENÉTICO (AG)
// =====================================================================

export interface ParametrosAG {
    tp: number; // Tamanho da população
    tc: number; // Taxa de cruzamento (0..1)
    tm: number; // Taxa de mutação (0..1)
    ig: number; // Intervalo de geração / elitismo (0..1)
    ng: number; // Número de gerações
}

function cromossomo(demandas: Demanda[], cMax: number): number[] {
    const n = demandas.length;
    const s = new Array(n).fill(0);
    let v = 0;
    let c = 0;
    let j = 0;
    while (v <= cMax && c !== n) {
        j = Math.floor(Math.random() * n);
        if (s[j] === 0) {
            s[j] = 1;
            v += demandas[j].tempo;
            c += 1;
        }
    }
    if (c !== n) s[j] = 0;
    return s;
}

function popIni(demandas: Demanda[], tp: number, cMax: number): number[][] {
    const pop: number[][] = [];
    for (let i = 0; i < tp; i++) pop.push(cromossomo(demandas, cMax));
    return pop;
}

function avalia(demandas: Demanda[], sol: number[]): number {
    let v = 0;
    for (let i = 0; i < demandas.length; i++) {
        if (sol[i] === 1) v += [0, 10, 5, 1][demandas[i].prioridade];
    }
    return v;
}

function aptidao(demandas: Demanda[], pop: number[][], cMax: number): number[] {
    const fit = pop.map((sol) => {
        let f = avalia(demandas, sol);
        if (tempoTotal(sol, demandas) === cMax) f = f * 100;
        return f;
    });
    const soma = fit.reduce((acc, v) => acc + v, 0);
    if (soma === 0) return fit.map(() => 1 / fit.length);
    return fit.map((f) => f / soma);
}

function ordena(pop: number[][], fit: number[]): [number[][], number[]] {
    const pares = pop.map((p, i) => ({ p, f: fit[i] }));
    pares.sort((a, b) => b.f - a.f);
    return [pares.map((x) => x.p), pares.map((x) => x.f)];
}

function roleta(fit: number[], tp: number): number {
    const ale = Math.random();
    let ind = 0;
    let soma = fit[ind];
    while (soma < ale && ind < tp - 1) {
        ind += 1;
        soma += fit[ind];
    }
    return ind;
}

function cruzamento(p1: number[], p2: number[], ponto: number): [number[], number[]] {
    return [
        [...p1.slice(0, ponto), ...p2.slice(ponto)],
        [...p2.slice(0, ponto), ...p1.slice(ponto)],
    ];
}

function mutacao(d: number[]): number[] {
    const novo = [...d];
    const pos = Math.floor(Math.random() * novo.length);
    novo[pos] = 1 - novo[pos];
    return novo;
}

function descendentes(
    n: number, pop: number[][], fit: number[], tp: number, tc: number, tm: number,
): number[][] {
    const qd = 2 * tp;
    const desc: number[][] = [];
    const corte = Math.floor(Math.random() * (n - 1)) + 1;
    let i = 0;
    while (i < qd) {
        const p1 = pop[roleta(fit, tp)];
        const p2 = pop[roleta(fit, tp)];
        let d1: number[];
        let d2: number[];
        if (Math.random() <= tc) {
            [d1, d2] = cruzamento(p1, p2, corte);
        } else {
            d1 = [...p1];
            d2 = [...p2];
        }
        if (Math.random() <= tm) d1 = mutacao(d1);
        if (Math.random() <= tm) d2 = mutacao(d2);
        desc.push(d1, d2);
        i += 2;
    }
    return desc;
}

function novaPop(pop: number[][], desc: number[][], tp: number, ig: number): number[][] {
    const elite = Math.ceil(ig * tp);
    const nova = pop.map((p) => [...p]);
    for (let i = 0; i < tp - elite; i++) nova[i + elite] = [...desc[i]];
    return nova;
}

function ajustaRestricao(demandas: Demanda[], desc: number[][], cMax: number): number[][] {
    const n = demandas.length;
    return desc.map((sol) => {
        const s = [...sol];
        let peso = tempoTotal(s, demandas);
        while (peso > cMax) {
            const j = Math.floor(Math.random() * n);
            if (s[j] === 1) {
                s[j] = 0;
                peso -= demandas[j].tempo;
            }
        }
        return s;
    });
}

export function executarAG(inst: InstanciaProblema, params: ParametrosAG): MetricaExecucao {
    const inicio = performance.now();
    const { demandas, capacidade: cMax } = inst;
    const n = demandas.length;
    const { tp, tc, tm, ig, ng } = params;

    let pop = popIni(demandas, tp, cMax);
    let fit = aptidao(demandas, pop, cMax);
    [pop, fit] = ordena(pop, fit);

    for (let g = 1; g <= ng; g++) {
        let desc = descendentes(n, pop, fit, tp, tc, tm);
        desc = ajustaRestricao(demandas, desc, cMax);
        const fitD = aptidao(demandas, desc, cMax);
        [desc] = ordena(desc, fitD);
        pop = novaPop(pop, desc, tp, ig);
        fit = aptidao(demandas, pop, cMax);
        [pop, fit] = ordena(pop, fit);
    }

    const melhor = pop[0];
    return montarMetrica(inst, melhor, inicio, ng);
}

// =====================================================================
// MÉTODOS BÁSICOS (SE / SET / TS)
// =====================================================================

function solucaoInicialVazia(demandas: Demanda[]): number[] {
    return new Array(demandas.length).fill(0);
}

function sucessorAleatorio(s: number[], _demandas: Demanda[]): number[] {
    const incluidas = s.map((v, i) => (v === 1 ? i : -1)).filter((v) => v >= 0);
    const excluidas = s.map((v, i) => (v === 0 ? i : -1)).filter((v) => v >= 0);
    const novo = [...s];
    const op = Math.random();
    if (op < 0.5 && incluidas.length > 0 && excluidas.length > 0) {
        novo[incluidas[Math.floor(Math.random() * incluidas.length)]] = 0;
        novo[excluidas[Math.floor(Math.random() * excluidas.length)]] = 1;
    } else if (op < 0.75 && excluidas.length > 0) {
        novo[excluidas[Math.floor(Math.random() * excluidas.length)]] = 1;
    } else if (incluidas.length > 0) {
        novo[incluidas[Math.floor(Math.random() * incluidas.length)]] = 0;
    }
    return novo;
}

function melhorSucessorVizinhanca(s: number[], demandas: Demanda[], capacidade: number): number[] {
    let melhorVizinho = [...s];
    let melhorValor = -Infinity;
    for (let i = 0; i < s.length; i++) {
        const vizinho = [...s];
        vizinho[i] = vizinho[i] === 0 ? 1 : 0;
        const valor = avaliar(vizinho, demandas, capacidade);
        if (valor > melhorValor) {
            melhorValor = valor;
            melhorVizinho = vizinho;
        }
    }
    return melhorVizinho;
}

// Subida da Encosta (Steepest Ascent)
export function executarSE(inst: InstanciaProblema, maxIter = 1000): MetricaExecucao {
    const inicio = performance.now();
    const { demandas, capacidade } = inst;
    let atual = solucaoInicialVazia(demandas);
    let va = avaliar(atual, demandas, capacidade);
    let iter = 0;
    while (iter < maxIter) {
        iter++;
        const novo = melhorSucessorVizinhanca(atual, demandas, capacidade);
        const vn = avaliar(novo, demandas, capacidade);
        if (vn > va) {
            atual = novo;
            va = vn;
        } else {
            break;
        }
    }
    return montarMetrica(inst, atual, inicio, iter);
}

// Subida de Encosta com Tentativas
export function executarSET(inst: InstanciaProblema, tmax: number, maxIter = 30000): MetricaExecucao {
    const inicio = performance.now();
    const { demandas, capacidade } = inst;
    let atual = solucaoInicialVazia(demandas);
    let va = avaliar(atual, demandas, capacidade);
    let t = 0;
    let iter = 0;
    while (t < tmax && iter < maxIter) {
        iter++;
        const novo = sucessorAleatorio(atual, demandas);
        const vn = avaliar(novo, demandas, capacidade);
        if (vn > va) {
            atual = novo;
            va = vn;
            t = 0;
        } else {
            t++;
        }
    }
    return montarMetrica(inst, atual, inicio, iter);
}

export interface ParametrosTS {
    ti: number; // Temperatura inicial
    tf: number; // Temperatura final
    fr: number; // Fator de resfriamento
}

// Têmpera Simulada
export function executarTS(inst: InstanciaProblema, params: ParametrosTS, maxIter = 50000): MetricaExecucao {
    const inicio = performance.now();
    const { demandas, capacidade } = inst;
    const { ti, tf, fr } = params;
    let atual = solucaoInicialVazia(demandas);
    let va = avaliar(atual, demandas, capacidade);
    let melhor = [...atual];
    let vm = va;
    let temp = ti;
    let iter = 0;
    while (temp > tf && iter < maxIter) {
        iter++;
        const novo = sucessorAleatorio(atual, demandas);
        const vn = avaliar(novo, demandas, capacidade);
        if (vn > va) {
            atual = novo;
            va = vn;
            if (va > vm) { melhor = [...atual]; vm = va; }
        } else if (vn !== -Infinity) {
            const d = va === -Infinity ? 0 : va - vn;
            if (Math.random() < Math.exp(-d / temp)) {
                atual = novo;
                va = vn;
            }
        }
        temp *= fr;
    }
    return montarMetrica(inst, melhor, inicio, iter);
}
