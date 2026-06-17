// ---------------------------------------------------------------------
// Tipos compartilhados entre a camada de cálculo (worker) e a camada
// de apresentação (PDF / UI).
// ---------------------------------------------------------------------

// Métricas coletadas de UMA única execução de um algoritmo, no contexto
// da organização da sprint (seleção de demandas dentro da capacidade).
export interface MetricaExecucao {
    ganho: number; // Pontuação de prioridade entregue na sprint (absoluto)
    ganhoPercentual: number; // Ganho % sobre a solução inicial de referência
    tempoMs: number; // Tempo de processamento do algoritmo
    iteracoes: number; // Iterações/gerações até o resultado
    demandasEntregues: number; // Qtd. de demandas selecionadas
    horasUsadas: number; // Soma das horas das demandas selecionadas
}

// Conjunto completo dos 5 parâmetros usados em uma execução do AG.
export interface ParametrosAGDetalhe {
    tp: number; // Tamanho da População
    tc: number; // Taxa de Cruzamento (0..1)
    tm: number; // Taxa de Mutação (0..1)
    ig: number; // Intervalo de Geração / Elitismo (0..1)
    ng: number; // Número de Gerações
}

// Resultado agregado (médias) de N simulações independentes.
export interface ResultadoMedio {
    metodo: string;
    configuracao: string;
    ganhoMedio: number; // Ganho percentual médio da otimização (%)
    pontuacaoMedia: number; // Pontuação absoluta média entregue na sprint (pts)
    tempoMedioMs: number;
    iteracoesMedia: number;
    demandasMedia: number; // Média de demandas entregues
    horasMedia: number; // Média de horas usadas da sprint
    simulacoes: number;
    // Presente apenas para resultados do AG: os 5 parâmetros usados.
    agParams?: ParametrosAGDetalhe;
}

// Amostra de uma demanda do backlog (para ilustrar o problema no PDF).
export interface DemandaExemplo {
    nome: string;
    prioridade: number;
    tempo: number;
}

// Estrutura final entregue para a geração do PDF.
export interface DadosRelatorio {
    geradoEm: string;
    n: number; // Nº de demandas no backlog de cada sprint
    simulacoesPorConfig: number;
    capacidadeMedia: number; // Capacidade média da sprint (horas)
    cargaTotalMedia: number; // Carga total média do backlog (horas)
    backlogExemplo: DemandaExemplo[]; // Amostra do backlog de uma sprint
    baselineAG: Record<string, number | string>;
    parteI: ResultadoMedio[];
    topTresAG: ResultadoMedio[];
    parteII: ResultadoMedio[];
    comparativoFinal: ResultadoMedio[];
}

// Mensagens trocadas entre o Web Worker (Job em background) e a UI.
export type ProgressoRelatorio =
    | { tipo: 'progresso'; fase: string; atual: number; total: number }
    | { tipo: 'concluido'; dados: DadosRelatorio }
    | { tipo: 'erro'; mensagem: string };
