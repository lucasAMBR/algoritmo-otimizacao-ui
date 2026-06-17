import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Play, Shuffle, Zap, Clock, Dna, Users, FileText, Download, Loader2 } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useRelatorio } from '@/lib/relatorio/use-relatorio';

export const Route = createFileRoute('/(public)/algoritmos/algoritmos-geneticos')({
    component: RouteComponent,
});

type Prioridade = 1 | 2 | 3;

interface Demanda {
    id: number;
    nome: string;
    prioridade: Prioridade;
    tempo: number;
}

interface ResultadoAG {
    solucaoInicial: number[];
    solucaoFinal: number[];
    valorInicial: number;
    valorFinal: number;
    tempoInicial: number;
    tempoFinal: number;
    geracoes: number;
    historico: { geracao: number; melhor: number; media: number }[];
    tempoMs: number;
}

const PESO_PRIORIDADE: Record<Prioridade, number> = { 1: 10, 2: 5, 3: 1 };
const LABEL_PRIORIDADE: Record<Prioridade, string> = { 1: 'Alta', 2: 'Média', 3: 'Baixa' };
const COR_PRIORIDADE: Record<Prioridade, string> = {
    1: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    2: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    3: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
};

const NOMES_DEMANDAS = [
    'Auth JWT', 'CRUD Usuários', 'Dashboard KPIs', 'Notif. Push', 'API Pagamentos',
    'Relatório PDF', 'Upload S3', 'Cache Redis', 'Busca Elastic', 'CI/CD Pipeline',
    'Tela Login', 'Perfil User', 'Websockets', 'Migração DB', 'Dark Mode',
    'i18n pt-BR', 'Rate Limit', 'Auditoria Log', 'Export CSV', 'Onboarding Flow',
];

// ---------------------------------------------------------------------
// Gera o problema (backlog de demandas da sprint)
function gerarProblema(n: number): Demanda[] {
    const nomes = [...NOMES_DEMANDAS].sort(() => Math.random() - 0.5).slice(0, n);
    return nomes.map((nome, i) => ({
        id: i + 1,
        nome,
        prioridade: ([1, 1, 2, 2, 3][Math.floor(Math.random() * 5)]) as Prioridade,
        tempo: Math.floor(Math.random() * 8) + 2,
    }));
}

// ---------------------------------------------------------------------
// Custo/lucro de uma solução (pontuação por prioridade)
function avalia(demandas: Demanda[], sol: number[]): number {
    let v = 0;
    for (let i = 0; i < demandas.length; i++) {
        if (sol[i] === 1) v += PESO_PRIORIDADE[demandas[i].prioridade];
    }
    return v;
}

// Tempo total (horas) ocupado por uma solução
function tempoTotal(demandas: Demanda[], sol: number[]): number {
    let t = 0;
    for (let i = 0; i < demandas.length; i++) {
        if (sol[i] === 1) t += demandas[i].tempo;
    }
    return t;
}

// ---------------------------------------------------------------------
// Gera um cromossomo aleatório respeitando a capacidade da sprint
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

// ---------------------------------------------------------------------
// Gera a população inicial
function popIni(demandas: Demanda[], tp: number, cMax: number): number[][] {
    const pop: number[][] = [];
    for (let i = 0; i < tp; i++) {
        pop.push(cromossomo(demandas, cMax));
    }
    return pop;
}

// ---------------------------------------------------------------------
// Calcula aptidão (fitness normalizado da população)
function aptidao(demandas: Demanda[], pop: number[][], cMax: number): number[] {
    const fit = pop.map((sol) => {
        let f = avalia(demandas, sol);
        // Bônus quando a solução usa exatamente toda a capacidade da sprint
        if (tempoTotal(demandas, sol) === cMax) f = f * 100;
        return f;
    });
    const soma = fit.reduce((acc, v) => acc + v, 0);
    if (soma === 0) return fit.map(() => 1 / fit.length);
    return fit.map((f) => f / soma);
}

// ---------------------------------------------------------------------
// Ordena população por aptidão (decrescente)
function ordena(pop: number[][], fit: number[]): [number[][], number[]] {
    const pares = pop.map((p, i) => ({ p, f: fit[i] }));
    pares.sort((a, b) => b.f - a.f);
    return [pares.map((x) => x.p), pares.map((x) => x.f)];
}

// ---------------------------------------------------------------------
// Operador Roleta
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

// ---------------------------------------------------------------------
// Operador de cruzamento (um ponto de corte)
function cruzamento(p1: number[], p2: number[], ponto: number): [number[], number[]] {
    const d1 = [...p1.slice(0, ponto), ...p2.slice(ponto)];
    const d2 = [...p2.slice(0, ponto), ...p1.slice(ponto)];
    return [d1, d2];
}

// ---------------------------------------------------------------------
// Operador de mutação — troca simples (bit flip)
function mutacao(d: number[]): number[] {
    const novo = [...d];
    const pos = Math.floor(Math.random() * novo.length);
    novo[pos] = 1 - novo[pos];
    return novo;
}

// ---------------------------------------------------------------------
// Gera os descendentes via roleta + cruzamento + mutação
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

// ---------------------------------------------------------------------
// Nova população com elitismo (intervalo de geração)
function novaPop(pop: number[][], desc: number[][], tp: number, ig: number): number[][] {
    const elite = Math.ceil(ig * tp);
    const nova = pop.map((p) => [...p]);
    for (let i = 0; i < tp - elite; i++) {
        nova[i + elite] = [...desc[i]];
    }
    return nova;
}

// ---------------------------------------------------------------------
// Ajusta solução para atender à restrição de capacidade da sprint
function ajustaRestricao(demandas: Demanda[], desc: number[][], cMax: number): number[][] {
    const n = demandas.length;
    return desc.map((sol) => {
        const s = [...sol];
        let peso = tempoTotal(demandas, s);
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

// ---------------------------------------------------------------------
// Algoritmo Genético completo
function executarAG(
    demandas: Demanda[], cMax: number, popInicial: number[][],
    ng: number, tc: number, tm: number, ig: number,
): ResultadoAG {
    const inicio = performance.now();
    const n = demandas.length;
    const tp = popInicial.length;

    let pop = popInicial.map((p) => [...p]);
    let fit = aptidao(demandas, pop, cMax);
    [pop, fit] = ordena(pop, fit);
    const si = [...pop[0]];

    const historico: { geracao: number; melhor: number; media: number }[] = [];
    const registrar = (g: number) => {
        const valores = pop.map((p) => avalia(demandas, p));
        historico.push({
            geracao: g,
            melhor: Math.max(...valores),
            media: +(valores.reduce((a, b) => a + b, 0) / valores.length).toFixed(1),
        });
    };
    registrar(0);

    for (let g = 1; g <= ng; g++) {
        let desc = descendentes(n, pop, fit, tp, tc, tm);
        desc = ajustaRestricao(demandas, desc, cMax);
        let fitD = aptidao(demandas, desc, cMax);
        [desc] = ordena(desc, fitD);
        pop = novaPop(pop, desc, tp, ig);
        fit = aptidao(demandas, pop, cMax);
        [pop, fit] = ordena(pop, fit);
        registrar(g);
    }

    const sf = [...pop[0]];

    return {
        solucaoInicial: si,
        solucaoFinal: sf,
        valorInicial: avalia(demandas, si),
        valorFinal: avalia(demandas, sf),
        tempoInicial: tempoTotal(demandas, si),
        tempoFinal: tempoTotal(demandas, sf),
        geracoes: ng,
        historico,
        tempoMs: +(performance.now() - inicio).toFixed(2),
    };
}

function RouteComponent() {
    const navigate = useNavigate();

    const [qtdDemandas, setQtdDemandas] = useState('10');
    const [capacidade, setCapacidade] = useState('40');
    const [tamPopulacao, setTamPopulacao] = useState('10');
    const [taxaMutacao, setTaxaMutacao] = useState('0.1');
    const [taxaCruzamento, setTaxaCruzamento] = useState('0.8');
    const [intervaloGeracao, setIntervaloGeracao] = useState('0.2');
    const [numGeracoes, setNumGeracoes] = useState('30');

    const [demandas, setDemandas] = useState<Demanda[] | null>(null);
    const [populacao, setPopulacao] = useState<number[][] | null>(null);
    const [resultado, setResultado] = useState<ResultadoAG | null>(null);
    const [rodando, setRodando] = useState(false);

    const { estado: relatorio, gerar: gerarRelatorio } = useRelatorio();
    const gerandoRelatorio = relatorio.status === 'gerando' || relatorio.status === 'montando-pdf';
    const progressoPct =
        relatorio.status === 'montando-pdf'
            ? 100
            : relatorio.total > 0
                ? Math.round((relatorio.atual / relatorio.total) * 100)
                : 0;

    const cap = parseInt(capacidade) || 40;

    const navigateToHome = () => navigate({ to: '/' });

    const handleGerarProblema = useCallback(() => {
        const n = Math.max(3, Math.min(20, parseInt(qtdDemandas) || 10));
        setDemandas(gerarProblema(n));
        setPopulacao(null);
        setResultado(null);
    }, [qtdDemandas]);

    const handleGerarPopulacao = useCallback(() => {
        if (!demandas) { alert('Gere as demandas primeiro!'); return; }
        const tp = Math.max(2, Math.min(100, parseInt(tamPopulacao) || 10));
        setPopulacao(popIni(demandas, tp, cap));
        setResultado(null);
    }, [demandas, tamPopulacao, cap]);

    const handleExecutar = useCallback(() => {
        if (!demandas || !populacao) { alert('Gere as demandas e a população inicial!'); return; }
        setRodando(true);
        setTimeout(() => {
            const res = executarAG(
                demandas, cap, populacao,
                Math.max(1, parseInt(numGeracoes) || 30),
                parseFloat(taxaCruzamento) || 0.8,
                parseFloat(taxaMutacao) || 0.1,
                parseFloat(intervaloGeracao) || 0.2,
            );
            setResultado(res);
            setRodando(false);
        }, 50);
    }, [demandas, populacao, cap, numGeracoes, taxaCruzamento, taxaMutacao, intervaloGeracao]);

    const maxHistorico = resultado
        ? Math.max(...resultado.historico.map((h) => h.melhor), 1)
        : 1;

    return (
        <div className="w-screen min-h-screen flex justify-center items-start py-10 px-4 bg-background overflow-y-scroll">
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-2xl"
            >
                <Card className="shadow-lg">
                    <CardHeader>
                        <Button variant="ghost" onClick={navigateToHome} className="w-fit mb-2 -ml-2">
                            <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
                        </Button>
                        <motion.div
                            animate={{ y: [0, -4, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            <CardTitle className="text-2xl font-bold">Algoritmos Genéticos — Sprint</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                Evolua populações de soluções para maximizar a pontuação da sprint
                            </p>
                        </motion.div>
                    </CardHeader>

                    <CardContent className="flex flex-col gap-5">

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <Label>Nº de Demandas</Label>
                                <Input type="number" min={3} max={20} value={qtdDemandas}
                                    onChange={(e) => setQtdDemandas(e.target.value)} placeholder="ex: 10" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> Capacidade da Sprint (h)
                                </Label>
                                <Input type="number" min={10} max={200} value={capacidade}
                                    onChange={(e) => setCapacidade(e.target.value)} placeholder="ex: 40" />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label className="flex items-center gap-1">
                                <Dna className="w-3 h-3" /> Configuração do Algoritmo
                            </Label>
                            <Card>
                                <CardContent className="grid grid-cols-2 gap-4 pt-4">
                                    <div className="flex flex-col gap-2">
                                        <Label className="text-xs">Tamanho da População (TP)</Label>
                                        <Input type="number" min={2} max={100} value={tamPopulacao}
                                            onChange={(e) => setTamPopulacao(e.target.value)} placeholder="ex: 10" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Label className="text-xs">Nº de Gerações (NG)</Label>
                                        <Input type="number" min={1} max={1000} value={numGeracoes}
                                            onChange={(e) => setNumGeracoes(e.target.value)} placeholder="ex: 30" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Label className="text-xs">Taxa de Cruzamento (TC)</Label>
                                        <Input type="number" min={0} max={1} step={0.05} value={taxaCruzamento}
                                            onChange={(e) => setTaxaCruzamento(e.target.value)} placeholder="ex: 0.8" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Label className="text-xs">Taxa de Mutação (TM)</Label>
                                        <Input type="number" min={0} max={1} step={0.05} value={taxaMutacao}
                                            onChange={(e) => setTaxaMutacao(e.target.value)} placeholder="ex: 0.1" />
                                    </div>
                                    <div className="flex flex-col gap-2 col-span-2">
                                        <Label className="text-xs">Intervalo de Geração / Elitismo (IG)</Label>
                                        <Input type="number" min={0} max={1} step={0.05} value={intervaloGeracao}
                                            onChange={(e) => setIntervaloGeracao(e.target.value)} placeholder="ex: 0.2" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <Button variant="outline" onClick={handleGerarProblema}>
                                <Shuffle className="w-4 h-4 mr-1" /> Gerar Sprint
                            </Button>
                            <Button variant="outline" onClick={handleGerarPopulacao} disabled={!demandas}>
                                <Users className="w-4 h-4 mr-1" /> Gerar População
                            </Button>
                            <Button onClick={handleExecutar} disabled={!demandas || !populacao || rodando}>
                                {rodando ? (
                                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}>
                                        <Zap className="w-4 h-4" />
                                    </motion.div>
                                ) : (
                                    <><Play className="w-4 h-4 mr-1" /> Executar</>
                                )}
                            </Button>
                        </div>

                        {/* Geração de Relatório — Job em background (Web Worker) */}
                        <div className="rounded-lg border bg-muted/30 p-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    <div>
                                        <p className="text-sm font-semibold">Relatório de Otimização da Sprint (PDF)</p>
                                        <p className="text-xs text-muted-foreground">
                                            Backlog de 50 demandas · 20 sprints simuladas · AG, SE, SET e TS
                                        </p>
                                    </div>
                                </div>
                                <Button size="sm" onClick={() => gerarRelatorio({ n: 50, simulacoes: 20 })} disabled={gerandoRelatorio}>
                                    {gerandoRelatorio ? (
                                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}>
                                            <Loader2 className="w-4 h-4" />
                                        </motion.div>
                                    ) : (
                                        <><FileText className="w-4 h-4 mr-1" /> Gerar Relatório</>
                                    )}
                                </Button>
                            </div>

                            <AnimatePresence mode="wait">
                                {gerandoRelatorio && (
                                    <motion.div key="prog" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                        className="flex flex-col gap-1.5">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Gerando Relatório... {relatorio.fase}</span>
                                            <span>{relatorio.total > 0 ? `${relatorio.atual}/${relatorio.total}` : ''}</span>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                            <motion.div className="h-full bg-primary rounded-full"
                                                animate={{ width: `${progressoPct}%` }} transition={{ duration: 0.3 }} />
                                        </div>
                                    </motion.div>
                                )}

                                {relatorio.status === 'pronto' && relatorio.resultado && (
                                    <motion.div key="pronto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                        className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                            ✅ Relatório pronto para download
                                        </span>
                                        <a href={relatorio.resultado.url} download={relatorio.resultado.nomeArquivo}>
                                            <Button size="sm" variant="outline">
                                                <Download className="w-4 h-4 mr-1" /> Baixar PDF
                                            </Button>
                                        </a>
                                    </motion.div>
                                )}

                                {relatorio.status === 'erro' && (
                                    <motion.p key="erro" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        className="text-xs text-red-600 dark:text-red-400">
                                        Erro ao gerar relatório: {relatorio.erro}
                                    </motion.p>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Tabela backlog */}
                        <AnimatePresence>
                            {demandas && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-2">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                                        Backlog · {demandas.length} demandas · capacidade {cap}h
                                    </p>
                                    <div className="rounded-lg border overflow-hidden">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-muted/50">
                                                    <th className="text-left px-3 py-2 font-medium">Demanda</th>
                                                    <th className="text-center px-2 py-2 font-medium">Prior.</th>
                                                    <th className="text-center px-2 py-2 font-medium">Tempo</th>
                                                    {resultado && <th className="text-center px-2 py-2 font-medium">Inicial</th>}
                                                    {resultado && <th className="text-center px-2 py-2 font-medium">Final</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {demandas.map((d, i) => {
                                                    const naInicial = resultado?.solucaoInicial[i] === 1;
                                                    const naFinal = resultado?.solucaoFinal[i] === 1;
                                                    const mudou = resultado && naInicial !== naFinal;
                                                    return (
                                                        <tr key={d.id} className={`border-t ${mudou ? 'bg-primary/5' : ''}`}>
                                                            <td className="px-3 py-1.5">{d.nome}</td>
                                                            <td className="px-2 py-1.5 text-center">
                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${COR_PRIORIDADE[d.prioridade]}`}>
                                                                    {LABEL_PRIORIDADE[d.prioridade]}
                                                                </span>
                                                            </td>
                                                            <td className="px-2 py-1.5 text-center font-mono">{d.tempo}h</td>
                                                            {resultado && <td className="px-2 py-1.5 text-center">{naInicial ? '✅' : '—'}</td>}
                                                            {resultado && (
                                                                <td className="px-2 py-1.5 text-center">
                                                                    {naFinal
                                                                        ? mudou ? '🆕' : '✅'
                                                                        : mudou ? '❌' : '—'}
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            {resultado && (
                                                <tfoot>
                                                    <tr className="border-t bg-muted/30">
                                                        <td colSpan={3} className="px-3 py-1.5 text-xs text-muted-foreground font-medium">
                                                            Pontuação / Horas usadas
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center text-xs font-mono">
                                                            {resultado.valorInicial}pts / {resultado.tempoInicial}h
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center text-xs font-mono font-bold text-green-700 dark:text-green-400">
                                                            {resultado.valorFinal}pts / {resultado.tempoFinal}h
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* População inicial */}
                        <AnimatePresence>
                            {populacao && demandas && !resultado && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="flex flex-col gap-2">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                                        População inicial · {populacao.length} cromossomos
                                    </p>
                                    <div className="rounded-lg border bg-muted/30 p-3 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                                        {populacao.map((crom, i) => (
                                            <div key={i} className="flex items-center gap-2 text-xs">
                                                <span className="text-muted-foreground font-mono w-8">#{i + 1}</span>
                                                <div className="flex gap-0.5 flex-1">
                                                    {crom.map((gene, j) => (
                                                        <span key={j}
                                                            className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-mono ${
                                                                gene === 1
                                                                    ? 'bg-primary text-primary-foreground'
                                                                    : 'bg-muted text-muted-foreground'
                                                            }`}>
                                                            {gene}
                                                        </span>
                                                    ))}
                                                </div>
                                                <span className="font-mono text-muted-foreground w-24 text-right">
                                                    {avalia(demandas, crom)}pts · {tempoTotal(demandas, crom)}h
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="border-t" />

                        {/* Resultado */}
                        <AnimatePresence mode="wait">
                            {!resultado && !rodando && (
                                <motion.p key="placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="text-center text-muted-foreground text-sm py-6">
                                    Gere a sprint, a população inicial e execute o algoritmo genético
                                </motion.p>
                            )}

                            {rodando && (
                                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="flex items-center justify-center gap-3 py-6">
                                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                        className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                                    <span className="text-sm text-muted-foreground">Evoluindo gerações...</span>
                                </motion.div>
                            )}

                            {resultado && !rodando && demandas && (
                                <motion.div key="resultado"
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Dna className="w-4 h-4" />
                                            <h3 className="font-semibold text-sm">Algoritmo Genético</h3>
                                        </div>
                                        {resultado.valorFinal > resultado.valorInicial ? (
                                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                                +{resultado.valorFinal - resultado.valorInicial} pts vs. melhor inicial
                                            </span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">
                                                Melhor indivíduo já estava na população inicial
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-4 gap-3">
                                        {[
                                            { label: 'Pontuação', value: resultado.valorFinal, color: 'text-green-600 dark:text-green-400' },
                                            { label: 'Demandas', value: resultado.solucaoFinal.filter((v) => v === 1).length, color: 'text-blue-600 dark:text-blue-400' },
                                            { label: 'Horas usadas', value: `${resultado.tempoFinal}h`, color: 'text-orange-600 dark:text-orange-400' },
                                            { label: 'Gerações', value: resultado.geracoes, color: 'text-purple-600 dark:text-purple-400' },
                                        ].map(({ label, value, color }) => (
                                            <div key={label} className="rounded-lg border bg-muted/30 p-3 text-center">
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                                                <p className={`text-base font-bold mt-1 ${color}`}>{value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Uso da sprint</span>
                                            <span>{resultado.tempoFinal}h / {cap}h ({Math.round((resultado.tempoFinal / cap) * 100)}%)</span>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.min(100, (resultado.tempoFinal / cap) * 100)}%` }}
                                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                                className={`h-full rounded-full ${resultado.tempoFinal / cap > 0.9 ? 'bg-green-500' : resultado.tempoFinal / cap > 0.7 ? 'bg-blue-500' : 'bg-orange-400'}`}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                                            Demandas selecionadas
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {resultado.solucaoFinal
                                                .map((v, i) => (v === 1 ? i : -1))
                                                .filter((i) => i >= 0)
                                                .sort((a, b) => demandas[a].prioridade - demandas[b].prioridade)
                                                .map((i) => {
                                                    const d = demandas[i];
                                                    return (
                                                        <motion.span key={d.id}
                                                            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                                            className={`px-2 py-1 rounded text-[11px] font-medium border ${COR_PRIORIDADE[d.prioridade]}`}>
                                                            {d.nome} · {d.tempo}h
                                                        </motion.span>
                                                    );
                                                })}
                                        </div>
                                    </div>

                                    {/* Convergência por geração */}
                                    {resultado.historico.length > 1 && (
                                        <div className="rounded-lg border bg-muted/40 p-3">
                                            <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2">
                                                Convergência (melhor indivíduo por geração)
                                            </p>
                                            <div className="flex flex-col gap-1">
                                                {[
                                                    ...resultado.historico.slice(0, 3),
                                                    ...(resultado.historico.length > 6 ? [null] : []),
                                                    ...resultado.historico.slice(-3),
                                                ].map((h, idx) =>
                                                    h === null ? (
                                                        <p key="ellipsis" className="text-xs text-muted-foreground text-center">⋮</p>
                                                    ) : (
                                                        <div key={idx} className="flex items-center gap-2 text-xs">
                                                            <span className="text-muted-foreground w-16">ger. {h.geracao}</span>
                                                            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                                                <motion.div
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${Math.min(100, (h.melhor / maxHistorico) * 100)}%` }}
                                                                    transition={{ duration: 0.5, delay: idx * 0.05 }}
                                                                    className="h-full bg-primary rounded-full"
                                                                />
                                                            </div>
                                                            <span className="font-mono w-24 text-right text-muted-foreground">
                                                                {h.melhor}pts · μ{h.media}
                                                            </span>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <p className="text-[11px] text-muted-foreground text-center">
                                        Executado em {resultado.tempoMs}ms · roleta + cruzamento de 1 ponto + mutação bit-flip + elitismo
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
