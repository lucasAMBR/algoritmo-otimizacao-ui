// ---------------------------------------------------------------------
// Camada de geração visual do PDF (isolada do cálculo).
// Recebe `DadosRelatorio` já computado e produz um Blob de PDF.
// ---------------------------------------------------------------------

import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    pdf,
} from '@react-pdf/renderer';
import { LABEL_PRIORIDADE } from './dominio';
import type { DadosRelatorio, ResultadoMedio } from './tipos';

const cores = {
    primaria: '#4f46e5',
    texto: '#1f2937',
    suave: '#6b7280',
    borda: '#e5e7eb',
    cabecalho: '#eef2ff',
    destaque: '#dcfce7',
    zebra: '#f9fafb',
};

const styles = StyleSheet.create({
    page: { padding: 32, fontSize: 9, color: cores.texto, fontFamily: 'Helvetica' },
    titulo: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: cores.primaria },
    subtitulo: { fontSize: 10, color: cores.suave, marginTop: 2 },
    secao: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 18, marginBottom: 6, color: cores.texto },
    paragrafo: { fontSize: 9, color: cores.suave, marginBottom: 6, lineHeight: 1.4 },
    metaBox: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 10,
        marginBottom: 4,
    },
    metaItem: {
        backgroundColor: cores.cabecalho,
        borderRadius: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    metaLabel: { fontSize: 7, color: cores.suave, textTransform: 'uppercase' },
    metaValor: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: cores.primaria },
    tabela: { borderWidth: 1, borderColor: cores.borda, borderRadius: 4, marginTop: 4 },
    linha: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: cores.borda },
    linhaUltima: { flexDirection: 'row' },
    th: {
        backgroundColor: cores.cabecalho,
        fontFamily: 'Helvetica-Bold',
        fontSize: 8,
        paddingVertical: 6,
        paddingHorizontal: 4,
    },
    td: { fontSize: 8, paddingVertical: 5, paddingHorizontal: 4 },
    rodape: {
        position: 'absolute',
        bottom: 18,
        left: 32,
        right: 32,
        fontSize: 7,
        color: cores.suave,
        textAlign: 'center',
    },
});

interface Coluna {
    titulo: string;
    largura: number;
    alinhar?: 'left' | 'center' | 'right';
    valor: (r: ResultadoMedio) => string;
}

function fmt(n: number, casas = 2): string {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

// Formata um número removendo casas decimais desnecessárias (ex.: 0.20 -> "0,2").
function num(n: number): string {
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

// Formata um ganho percentual (ex.: 42.5 -> "+42,5%").
function pct(n: number): string {
    const v = n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `${n > 0 ? '+' : ''}${v}%`;
}

function Tabela({
    colunas,
    linhas,
    destacar,
}: {
    colunas: Coluna[];
    linhas: ResultadoMedio[];
    destacar?: (r: ResultadoMedio, i: number) => boolean;
}) {
    return (
        <View style={styles.tabela}>
            <View style={styles.linha} fixed>
                {colunas.map((c, i) => (
                    <Text
                        key={i}
                        style={[styles.th, { width: `${c.largura}%`, textAlign: c.alinhar ?? 'left' }]}
                    >
                        {c.titulo}
                    </Text>
                ))}
            </View>
            {linhas.map((r, idx) => {
                const ultima = idx === linhas.length - 1;
                const realce = destacar?.(r, idx);
                const bg = realce ? cores.destaque : idx % 2 === 1 ? cores.zebra : undefined;
                return (
                    <View key={idx} wrap={false} style={[ultima ? styles.linhaUltima : styles.linha, bg ? { backgroundColor: bg } : {}]}>
                        {colunas.map((c, i) => (
                            <Text
                                key={i}
                                style={[
                                    styles.td,
                                    { width: `${c.largura}%`, textAlign: c.alinhar ?? 'left' },
                                    realce ? { fontFamily: 'Helvetica-Bold' } : {},
                                ]}
                            >
                                {c.valor(r)}
                            </Text>
                        ))}
                    </View>
                );
            })}
        </View>
    );
}

// Tabelas da Parte I e Top 3: cada uma das 5 colunas mostra um parâmetro
// do AG (TP, TC, TM, IG, NG), seguido das métricas médias da sprint.
// "Ganho Médio (%)" = melhoria percentual sobre a solução inicial de referência.
const colsParteI: Coluna[] = [
    { titulo: 'Variação', largura: 13, valor: (r) => r.configuracao },
    { titulo: 'TP', largura: 7, alinhar: 'right', valor: (r) => (r.agParams ? num(r.agParams.tp) : '—') },
    { titulo: 'TC (%)', largura: 9, alinhar: 'right', valor: (r) => (r.agParams ? num(r.agParams.tc * 100) : '—') },
    { titulo: 'TM', largura: 7, alinhar: 'right', valor: (r) => (r.agParams ? num(r.agParams.tm) : '—') },
    { titulo: 'IG', largura: 7, alinhar: 'right', valor: (r) => (r.agParams ? num(r.agParams.ig) : '—') },
    { titulo: 'NG', largura: 7, alinhar: 'right', valor: (r) => (r.agParams ? num(r.agParams.ng) : '—') },
    { titulo: 'Ganho Médio (%)', largura: 16, alinhar: 'right', valor: (r) => pct(r.ganhoMedio) },
    { titulo: 'Pontos', largura: 9, alinhar: 'right', valor: (r) => fmt(r.pontuacaoMedia, 1) },
    { titulo: 'Demandas', largura: 10, alinhar: 'right', valor: (r) => fmt(r.demandasMedia, 1) },
    { titulo: 'Tempo (ms)', largura: 15, alinhar: 'right', valor: (r) => fmt(r.tempoMedioMs) },
];

// Tabela comparativa final (Parte II): colunas obrigatórias + contexto de sprint.
const colsComparativo: Coluna[] = [
    { titulo: 'Método / Configuração', largura: 28, valor: (r) => `${r.metodo} · ${r.configuracao}` },
    { titulo: 'Ganho Médio (%)', largura: 16, alinhar: 'right', valor: (r) => pct(r.ganhoMedio) },
    { titulo: 'Pontos', largura: 10, alinhar: 'right', valor: (r) => fmt(r.pontuacaoMedia, 1) },
    { titulo: 'Demandas', largura: 11, alinhar: 'right', valor: (r) => fmt(r.demandasMedia, 1) },
    { titulo: 'Horas', largura: 8, alinhar: 'right', valor: (r) => fmt(r.horasMedia, 1) },
    { titulo: 'Tempo (ms)', largura: 14, alinhar: 'right', valor: (r) => fmt(r.tempoMedioMs) },
    { titulo: 'Iter./Exec.', largura: 13, alinhar: 'right', valor: (r) => fmt(r.iteracoesMedia, 0) },
];

// Tabela auxiliar: amostra do backlog da sprint (ilustra o problema).
const styleBacklog = StyleSheet.create({
    th: {
        backgroundColor: cores.cabecalho,
        fontFamily: 'Helvetica-Bold',
        fontSize: 8,
        paddingVertical: 5,
        paddingHorizontal: 6,
    },
    td: { fontSize: 8, paddingVertical: 4, paddingHorizontal: 6 },
});

function TabelaBacklog({ demandas }: { demandas: DadosRelatorio['backlogExemplo'] }) {
    return (
        <View style={styles.tabela}>
            <View style={styles.linha}>
                <Text style={[styleBacklog.th, { width: '56%' }]}>Demanda</Text>
                <Text style={[styleBacklog.th, { width: '24%', textAlign: 'center' }]}>Prioridade</Text>
                <Text style={[styleBacklog.th, { width: '20%', textAlign: 'right' }]}>Tempo (h)</Text>
            </View>
            {demandas.map((d, idx) => {
                const ultima = idx === demandas.length - 1;
                const bg = idx % 2 === 1 ? cores.zebra : undefined;
                return (
                    <View key={idx} style={[ultima ? styles.linhaUltima : styles.linha, bg ? { backgroundColor: bg } : {}]}>
                        <Text style={[styleBacklog.td, { width: '56%' }]}>{d.nome}</Text>
                        <Text style={[styleBacklog.td, { width: '24%', textAlign: 'center' }]}>
                            {LABEL_PRIORIDADE[d.prioridade as 1 | 2 | 3]}
                        </Text>
                        <Text style={[styleBacklog.td, { width: '20%', textAlign: 'right' }]}>{d.tempo}h</Text>
                    </View>
                );
            })}
        </View>
    );
}

function RelatorioDocument({ dados }: { dados: DadosRelatorio }) {
    const topConfigs = new Set(dados.topTresAG.map((r) => `${r.metodo}|${r.configuracao}`));
    const data = new Date(dados.geradoEm).toLocaleString('pt-BR');
    const baseline = Object.entries(dados.baselineAG)
        .map(([k, v]) => `${k}=${v}`)
        .join(' · ');

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Text style={styles.titulo}>Relatório de Otimização da Sprint</Text>
                <Text style={styles.subtitulo}>
                    Organização de tempo e prioridade de demandas — comparação entre AG, SE, SET e TS
                </Text>

                <View style={styles.metaBox}>
                    <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Demandas no backlog</Text>
                        <Text style={styles.metaValor}>{dados.n}</Text>
                    </View>
                    <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Capacidade da sprint</Text>
                        <Text style={styles.metaValor}>{dados.capacidadeMedia}h</Text>
                    </View>
                    <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Carga total do backlog</Text>
                        <Text style={styles.metaValor}>{dados.cargaTotalMedia}h</Text>
                    </View>
                    <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Sprints simuladas</Text>
                        <Text style={styles.metaValor}>{dados.simulacoesPorConfig}</Text>
                    </View>
                    <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Configurações AG</Text>
                        <Text style={styles.metaValor}>{dados.parteI.length}</Text>
                    </View>
                </View>

                <Text style={styles.secao}>O Problema — Priorização do Backlog da Sprint</Text>
                <Text style={styles.paragrafo}>
                    Cada sprint possui um backlog de {dados.n} demandas, mas a capacidade da equipe
                    (~{dados.capacidadeMedia}h) não comporta toda a carga (~{dados.cargaTotalMedia}h). O objetivo é
                    selecionar o subconjunto de demandas que maximiza a pontuação de prioridade entregue, sem
                    estourar a capacidade. Cada demanda tem prioridade Alta (10 pts), Média (5 pts) ou Baixa
                    (1 pt) e um tempo estimado em horas.
                    Para rigor estatístico, cada configuração foi avaliada em {dados.simulacoesPorConfig} sprints
                    independentes (as mesmas para todos os métodos); os valores são médias.
                </Text>
                <Text style={styles.paragrafo}>
                    Ganho da otimização (%): mede a melhoria da solução final sobre uma solução inicial de
                    referência (uma sprint montada de forma aleatória, porém válida), pela fórmula clássica de
                    otimização para maximização: Ganho% = ((Pontuação Final − Pontuação Inicial) / |Pontuação
                    Inicial|) × 100. A referência é a mesma para todos os métodos em cada sprint. A coluna
                    "Pontos" mostra a pontuação absoluta média entregue.
                </Text>

                <Text style={styles.secao}>Exemplo de Backlog de uma Sprint</Text>
                <TabelaBacklog demandas={dados.backlogExemplo} />

                <Text style={styles.rodape} fixed>
                    Gerado em {data} · médias de {dados.simulacoesPorConfig} sprints simuladas
                </Text>
            </Page>

            <Page size="A4" style={styles.page}>
                <Text style={styles.secao}>Parte I — Análise de Parâmetros do AG</Text>
                <Text style={styles.paragrafo}>
                    Grid completo (produto cartesiano) de todas as combinações dos 5 parâmetros — TP (Tamanho da
                    População), TC (Taxa de Cruzamento), TM (Taxa de Mutação), IG (Intervalo de Geração/Elitismo)
                    e NG (Número de Gerações) — totalizando {dados.parteI.length} configurações. A partir da base
                    de referência ({baseline}), cada configuração foi avaliada em {dados.simulacoesPorConfig} sprints
                    independentes, resultando em {dados.parteI.length * dados.simulacoesPorConfig} execuções do AG.
                    Os valores são médias; cada linha (identificada por um código C###) detalha os parâmetros usados,
                    o ganho médio (% sobre a referência), a pontuação absoluta e a média de demandas selecionadas.
                    As 3 melhores configurações por ganho médio estão destacadas.
                </Text>
                <Tabela
                    colunas={colsParteI}
                    linhas={dados.parteI}
                    destacar={(r) => topConfigs.has(`${r.metodo}|${r.configuracao}`)}
                />

                <Text style={styles.secao} break>Top 3 Melhores Configurações do AG</Text>
                <Tabela colunas={colsParteI} linhas={dados.topTresAG} destacar={() => true} />

                <Text style={styles.rodape} fixed>
                    Gerado em {data} · médias de {dados.simulacoesPorConfig} sprints simuladas
                </Text>
            </Page>

            <Page size="A4" style={styles.page}>
                <Text style={styles.secao}>Parte II — Comparativo Final entre Métodos</Text>
                <Text style={styles.paragrafo}>
                    Qual técnica organiza melhor a sprint? Cruzamento das 3 melhores configurações do AG
                    (Parte I) contra a Subida da Encosta (SE), as 2 variações da Subida de Encosta com Tentativa
                    (SET) e os 4 conjuntos de parâmetros da Têmpera Simulada (TS). Todos resolveram as mesmas
                    {' '}{dados.simulacoesPorConfig} sprints. As colunas mostram o ganho médio (% sobre a solução
                    inicial de referência), a pontuação absoluta, as demandas entregues, as horas usadas da sprint,
                    o tempo de processamento e o número de iterações/execuções até o resultado. As linhas do AG
                    estão destacadas.
                </Text>
                <Tabela
                    colunas={colsComparativo}
                    linhas={dados.comparativoFinal}
                    destacar={(r) => r.metodo === 'AG'}
                />

                <Text style={styles.rodape} fixed>
                    Gerado em {data} · médias de {dados.simulacoesPorConfig} sprints simuladas
                </Text>
            </Page>
        </Document>
    );
}

export async function gerarPdfBlob(dados: DadosRelatorio): Promise<Blob> {
    return pdf(<RelatorioDocument dados={dados} />).toBlob();
}
