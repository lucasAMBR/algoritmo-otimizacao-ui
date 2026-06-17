// ---------------------------------------------------------------------
// Camada de domínio matemático.
// Define o problema (mochila/sprint backlog), a função de avaliação e a
// geração das instâncias usadas pelas simulações. Esta camada é pura
// (não depende de DOM/React) e pode rodar dentro de um Web Worker.
// ---------------------------------------------------------------------

export type Prioridade = 1 | 2 | 3;

export interface Demanda {
    id: number;
    nome: string;
    prioridade: Prioridade;
    tempo: number;
}

export interface InstanciaProblema {
    demandas: Demanda[];
    capacidade: number;
    // Pontuação de uma solução inicial de referência (sprint montada de forma
    // aleatória/ingênua, porém válida). Serve como "valor inicial" no cálculo
    // do ganho percentual da otimização. É a MESMA para todos os métodos nesta
    // instância, garantindo um denominador não-nulo e uma comparação justa.
    baseline: number;
}

export const PESO_PRIORIDADE: Record<Prioridade, number> = { 1: 10, 2: 5, 3: 1 };
export const LABEL_PRIORIDADE: Record<Prioridade, string> = { 1: 'Alta', 2: 'Média', 3: 'Baixa' };

// Catálogo de demandas de uma sprint de desenvolvimento. Mantém o relatório
// no tema do produto (backlog real), em vez de rótulos genéricos.
export const NOMES_DEMANDAS = [
    'Auth JWT', 'CRUD Usuários', 'Dashboard KPIs', 'Notif. Push', 'API Pagamentos',
    'Relatório PDF', 'Upload S3', 'Cache Redis', 'Busca Elastic', 'CI/CD Pipeline',
    'Tela Login', 'Perfil User', 'Websockets', 'Migração DB', 'Dark Mode',
    'i18n pt-BR', 'Rate Limit', 'Auditoria Log', 'Export CSV', 'Onboarding Flow',
    'Reset Senha', 'Two-Factor Auth', 'Feature Flags', 'Webhooks', 'Healthcheck',
    'Paginação API', 'Filtros Avançados', 'Tema Custom', 'Tour Guiado', 'Métricas APM',
    'Backup Auto', 'Soft Delete', 'Versionamento API', 'GraphQL Gateway', 'Fila SQS',
    'Compressão Imagens', 'Lazy Loading', 'Service Worker', 'PWA Offline', 'Skeleton UI',
    'Toast Notif.', 'Modal Confirm', 'Drag & Drop', 'Infinite Scroll', 'Breadcrumbs',
    'Atalhos Teclado', 'Logs Estruturados', 'Tracing OTel', 'Seed de Dados', 'Documentação API',
];

// Fração da carga total de trabalho que cabe na sprint. Modela uma sprint
// realista: o backlog não cabe inteiro, é preciso priorizar.
const FRACAO_CAPACIDADE = 0.4;

// Gera um nome de demanda; ao exceder o catálogo, cria variações estáveis.
function nomeDemanda(indice: number): string {
    const base = NOMES_DEMANDAS[indice % NOMES_DEMANDAS.length];
    const ciclo = Math.floor(indice / NOMES_DEMANDAS.length);
    return ciclo === 0 ? base : `${base} v${ciclo + 1}`;
}

// Monta uma solução inicial válida de forma ingênua: percorre as demandas em
// ordem aleatória e inclui cada uma enquanto couber na capacidade da sprint.
// Representa "uma sprint montada sem otimização", usada como referência.
function solucaoInicialReferencia(demandas: Demanda[], capacidade: number): number[] {
    const n = demandas.length;
    const s = new Array(n).fill(0);
    const ordem = Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5);
    let tempo = 0;
    for (const i of ordem) {
        if (tempo + demandas[i].tempo <= capacidade) {
            s[i] = 1;
            tempo += demandas[i].tempo;
        }
    }
    return s;
}

// ---------------------------------------------------------------------
// Gera um problema (backlog da sprint) com N demandas embaralhadas.
function gerarProblema(n: number): InstanciaProblema {
    const indices = Array.from({ length: NOMES_DEMANDAS.length }, (_, i) => i)
        .sort(() => Math.random() - 0.5);
    const demandas: Demanda[] = [];
    for (let i = 0; i < n; i++) {
        const idxNome = i < indices.length ? indices[i] : i;
        demandas.push({
            id: i + 1,
            nome: nomeDemanda(idxNome),
            prioridade: ([1, 1, 2, 2, 3][Math.floor(Math.random() * 5)]) as Prioridade,
            tempo: Math.floor(Math.random() * 8) + 2,
        });
    }
    const cargaTotal = demandas.reduce((acc, d) => acc + d.tempo, 0);
    const capacidade = Math.max(10, Math.round(cargaTotal * FRACAO_CAPACIDADE));
    // Denominador do ganho percentual: garante valor >= 1 para evitar divisão por zero.
    const baseline = Math.max(1, pontuacao(solucaoInicialReferencia(demandas, capacidade), demandas, capacidade));
    return { demandas, capacidade, baseline };
}

// ---------------------------------------------------------------------
// Gera o conjunto de instâncias independentes que serão reutilizadas por
// TODAS as configurações/algoritmos, garantindo uma comparação justa.
export function gerarInstancias(qtd: number, n: number): InstanciaProblema[] {
    const instancias: InstanciaProblema[] = [];
    for (let i = 0; i < qtd; i++) instancias.push(gerarProblema(n));
    return instancias;
}

// ---------------------------------------------------------------------
// Avaliação com penalização de capacidade (usada por SE/SET/TS).
// Soluções que estouram a capacidade recebem -Infinity.
export function avaliar(sol: number[], demandas: Demanda[], capacidade: number): number {
    let tempo = 0;
    let valor = 0;
    for (let i = 0; i < sol.length; i++) {
        if (sol[i] === 1) {
            tempo += demandas[i].tempo;
            valor += PESO_PRIORIDADE[demandas[i].prioridade];
        }
    }
    return tempo > capacidade ? -Infinity : valor;
}

// Pontuação "limpa" (>= 0) de uma solução já viável.
export function pontuacao(sol: number[], demandas: Demanda[], capacidade: number): number {
    return Math.max(0, avaliar(sol, demandas, capacidade));
}

export function tempoTotal(sol: number[], demandas: Demanda[]): number {
    let t = 0;
    for (let i = 0; i < sol.length; i++) if (sol[i] === 1) t += demandas[i].tempo;
    return t;
}
