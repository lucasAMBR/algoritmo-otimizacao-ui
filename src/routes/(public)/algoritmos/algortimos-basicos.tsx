import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Play, Shuffle, RotateCcw, Zap, Clock, TrendingUp, Thermometer, Mountain } from 'lucide-react';
import { useState, useCallback } from 'react';

export const Route = createFileRoute('/(public)/algoritmos/algortimos-basicos')({
    component: RouteComponent,
});

type Prioridade = 1 | 2 | 3;

interface Demanda {
    id: number;
    nome: string;
    prioridade: Prioridade;
    tempo: number;
}

interface ResultadoSimulacao {
    selecionadas: number[];
    valorTotal: number;
    tempoTotal: number;
    iteracoes: number;
    historico: { iter: number; valor: number; temp?: number }[];
    metodo: string;
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

function gerarDemandas(n: number): Demanda[] {
    const nomes = [...NOMES_DEMANDAS].sort(() => Math.random() - 0.5).slice(0, n);
    return nomes.map((nome, i) => ({
        id: i + 1,
        nome,
        prioridade: ([1, 1, 2, 2, 3][Math.floor(Math.random() * 5)]) as Prioridade,
        tempo: Math.floor(Math.random() * 8) + 2,
    }));
}

function avaliar(s: number[], demandas: Demanda[], capacidade: number): number {
    let tempo = 0;
    let valor = 0;
    for (let i = 0; i < s.length; i++) {
        if (s[i] === 1) {
            tempo += demandas[i].tempo;
            valor += PESO_PRIORIDADE[demandas[i].prioridade];
        }
    }
    return tempo > capacidade ? -Infinity : valor;
}

// Sucessor estocástico (usado na Têmpera Simulada e Encosta c/ Tentativas)
function sucessorAleatorio(s: number[], demandas: Demanda[], capacidade: number): number[] {
    const incluidas = s.map((v, i) => (v === 1 ? i : -1)).filter((v) => v >= 0);
    const excluidas = s.map((v, i) => (v === 0 ? i : -1)).filter((v) => v >= 0);
    const novo = [...s];

    const op = Math.random();

    if (op < 0.5 && incluidas.length > 0 && excluidas.length > 0) {
        const sai = incluidas[Math.floor(Math.random() * incluidas.length)];
        const entra = excluidas[Math.floor(Math.random() * excluidas.length)];
        novo[sai] = 0;
        novo[entra] = 1;
    } else if (op < 0.75 && excluidas.length > 0) {
        const entra = excluidas[Math.floor(Math.random() * excluidas.length)];
        novo[entra] = 1;
    } else if (incluidas.length > 0) {
        const sai = incluidas[Math.floor(Math.random() * incluidas.length)];
        novo[sai] = 0;
    }

    return novo;
}

// Explora toda a vizinhança 1-bit flip e retorna o melhor vizinho (Steepest Ascent)
function melhorSucessorVizinhança(s: number[], demandas: Demanda[], capacidade: number): number[] {
    let melhorVizinho = [...s];
    let melhorValor = -Infinity;

    for (let i = 0; i < s.length; i++) {
        const vizinho = [...s];
        vizinho[i] = vizinho[i] === 0 ? 1 : 0; // Flip
        const valor = avaliar(vizinho, demandas, capacidade);
        
        if (valor > melhorValor) {
            melhorValor = valor;
            melhorVizinho = vizinho;
        }
    }
    return melhorVizinho;
}

function solucaoInicialVazia(demandas: Demanda[]): number[] {
    return new Array(demandas.length).fill(0);
}

function solucaoInicialAleatoria(demandas: Demanda[], capacidade: number): number[] {
    const s = new Array(demandas.length).fill(0);
    let tempoUsado = 0;
    // Preenchimento subótimo proposital (probabilidade reduzida)
    for (let i = 0; i < demandas.length; i++) {
        if (Math.random() < 0.25 && tempoUsado + demandas[i].tempo <= capacidade) {
            s[i] = 1;
            tempoUsado += demandas[i].tempo;
        }
    }
    return s;
}

function solucaoInicialGulosa(demandas: Demanda[], capacidade: number): number[] {
    const s = new Array(demandas.length).fill(0);
    const indices = demandas
        .map((d, i) => ({ i, eficiencia: PESO_PRIORIDADE[d.prioridade] / d.tempo }))
        .sort((a, b) => b.eficiencia - a.eficiencia);
    let tempoUsado = 0;
    for (const { i } of indices) {
        if (tempoUsado + demandas[i].tempo <= capacidade) {
            s[i] = 1;
            tempoUsado += demandas[i].tempo;
        }
    }
    return s;
}

function metodoEncosta(
    s: number[], demandas: Demanda[], capacidade: number, maxIter = 1000,
): ResultadoSimulacao {
    const inicio = performance.now();
    let atual = [...s];
    let va = avaliar(atual, demandas, capacidade);
    const historico = [{ iter: 0, valor: Math.max(0, va) }];
    let iter = 0;

    // Implementação Profissional: Steepest Ascent (Avanço Mais Íngreme)
    while (iter < maxIter) {
        iter++;
        const novo = melhorSucessorVizinhança(atual, demandas, capacidade);
        const vn = avaliar(novo, demandas, capacidade);
        
        if (vn > va) {
            atual = novo;
            va = vn;
            historico.push({ iter, valor: va });
        } else {
            // Atingiu ótimo local
            break; 
        }
    }

    return montar('Subida de Encosta (Steepest Ascent)', atual, demandas, capacidade, iter, historico, inicio);
}

function metodoEncostaTentativas(
    s: number[], demandas: Demanda[], capacidade: number,
    tmax = 300, maxIter = 30000,
): ResultadoSimulacao {
    const inicio = performance.now();
    let atual = [...s];
    let va = avaliar(atual, demandas, capacidade);
    let t = 0;
    const historico = [{ iter: 0, valor: Math.max(0, va) }];
    let iter = 0;

    while (t < tmax && iter < maxIter) {
        iter++;
        const novo = sucessorAleatorio(atual, demandas, capacidade);
        const vn = avaliar(novo, demandas, capacidade);
        if (vn > va) {
            atual = novo;
            va = vn;
            t = 0;
            historico.push({ iter, valor: va });
        } else {
            t++;
        }
    }

    return montar('Subida de Encosta c/ Tentativas', atual, demandas, capacidade, iter, historico, inicio);
}

function metodoTemperaSimulada(
    s: number[], demandas: Demanda[], capacidade: number,
    ti = 100, tf = 0.1, fr = 0.995, maxIter = 50000,
): ResultadoSimulacao {
    const inicio = performance.now();
    let atual = [...s];
    let va = avaliar(atual, demandas, capacidade);
    let temp = ti;
    let melhor = [...atual];
    let vm = va;
    const historico = [{ iter: 0, valor: Math.max(0, va), temp }];
    let iter = 0;

    while (temp > tf && iter < maxIter) {
        iter++;
        const novo = sucessorAleatorio(atual, demandas, capacidade);
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
        if (iter % 500 === 0) historico.push({ iter, valor: Math.max(0, vm), temp: +temp.toFixed(3) });
    }

    return montar('Têmpera Simulada', melhor, demandas, capacidade, iter, historico, inicio);
}

function montar(
    metodo: string, s: number[], demandas: Demanda[], capacidade: number,
    iteracoes: number, historico: { iter: number; valor: number; temp?: number }[],
    inicio: number,
): ResultadoSimulacao {
    const selecionadas = s.map((v, i) => (v === 1 ? i : -1)).filter((v) => v >= 0);
    return {
        selecionadas,
        valorTotal: Math.max(0, avaliar(s, demandas, capacidade)),
        tempoTotal: selecionadas.reduce((acc, i) => acc + demandas[i].tempo, 0),
        iteracoes,
        historico,
        metodo,
        tempoMs: +(performance.now() - inicio).toFixed(2),
    };
}

function RouteComponent() {
    const navigate = useNavigate();

    const [tipoExecucao, setTipoExecucao] = useState<'vazia' | 'aleatorio' | 'guloso'>('vazia');
    const [qtdDemandas, setQtdDemandas] = useState('10');
    const [capacidade, setCapacidade] = useState('40');
    const [metodo, setMetodo] = useState('encosta');
    const [demandas, setDemandas] = useState<Demanda[] | null>(null);
    const [solucaoInicial, setSolucaoInicial] = useState<number[] | null>(null);
    const [resultado, setResultado] = useState<ResultadoSimulacao | null>(null);
    const [rodando, setRodando] = useState(false);

    const [tmax, setTmax] = useState('300');
    const [ti, setTi] = useState('100');
    const [tf, setTf] = useState('0.1');
    const [fr, setFr] = useState('0.995');

    const cap = parseInt(capacidade) || 40;

    const navigateToHome = () => navigate({ to: '/' });

    const handleGerarProblema = useCallback(() => {
        const n = Math.max(3, Math.min(20, parseInt(qtdDemandas) || 10));
        setDemandas(gerarDemandas(n));
        setSolucaoInicial(null);
        setResultado(null);
    }, [qtdDemandas]);

    const handleSolucaoInicial = useCallback(() => {
        if (!demandas) { alert('Gere as demandas primeiro!'); return; }
        
        let si: number[];
        if (tipoExecucao === 'guloso') si = solucaoInicialGulosa(demandas, cap);
        else if (tipoExecucao === 'aleatorio') si = solucaoInicialAleatoria(demandas, cap);
        else si = solucaoInicialVazia(demandas);
        
        setSolucaoInicial(si);
        setResultado(null);
    }, [demandas, tipoExecucao, cap]);

    const handleExecutar = useCallback(() => {
        if (!demandas || !solucaoInicial) { alert('Gere demandas e solução inicial!'); return; }
        setRodando(true);
        setTimeout(() => {
            let res: ResultadoSimulacao;
            switch (metodo) {
                case 'encosta':
                    res = metodoEncosta(solucaoInicial, demandas, cap);
                    break;
                case 'encosta-t':
                    res = metodoEncostaTentativas(solucaoInicial, demandas, cap, parseInt(tmax) || 300);
                    break;
                case 'tempera':
                    res = metodoTemperaSimulada(solucaoInicial, demandas, cap,
                        parseFloat(ti) || 100, parseFloat(tf) || 0.1, parseFloat(fr) || 0.995);
                    break;
                default:
                    res = metodoEncosta(solucaoInicial, demandas, cap);
            }
            setResultado(res);
            setRodando(false);
        }, 50);
    }, [demandas, solucaoInicial, metodo, cap, tmax, ti, tf, fr]);

    const totalHorasSI = solucaoInicial && demandas
        ? solucaoInicial.reduce((acc, v, i) => acc + (v === 1 ? demandas[i].tempo : 0), 0)
        : 0;

    const valorSI = solucaoInicial && demandas ? Math.max(0, avaliar(solucaoInicial, demandas, cap)) : 0;

    const metodoIcons: Record<string, React.ReactNode> = {
        encosta: <Mountain className="w-4 h-4" />,
        'encosta-t': <TrendingUp className="w-4 h-4" />,
        tempera: <Thermometer className="w-4 h-4" />,
    };

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
                            <CardTitle className="text-2xl font-bold">Sprint Backlog — Mochila</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                Maximize demandas entregues respeitando a capacidade da sprint
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
                            <Label>Solução Inicial</Label>
                            <Select value={tipoExecucao} onValueChange={(v) => setTipoExecucao(v as 'vazia' | 'aleatorio' | 'guloso')}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="vazia">Vazia</SelectItem>
                                    <SelectItem value="aleatorio">Aleatória Subótima</SelectItem>
                                    <SelectItem value="guloso">Maxima eficiencia</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label>Algoritmo de Busca</Label>
                            <Select value={metodo} onValueChange={setMetodo}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="encosta">Subida de Encosta</SelectItem>
                                    <SelectItem value="encosta-t">Subida de Encosta c/ Tentativas</SelectItem>
                                    <SelectItem value="tempera">Têmpera Simulada</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <AnimatePresence mode="wait">
                            {metodo === 'encosta-t' && (
                                <motion.div key="tmax"
                                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    className="flex flex-col gap-2">
                                    <Label>TMAX — tentativas sem melhora</Label>
                                    <Input type="number" value={tmax} onChange={(e) => setTmax(e.target.value)} />
                                </motion.div>
                            )}
                            {metodo === 'tempera' && (
                                <motion.div key="tempera"
                                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    className="grid grid-cols-3 gap-3">
                                    <div className="flex flex-col gap-2">
                                        <Label>TI (Temp. Inicial)</Label>
                                        <Input type="number" value={ti} onChange={(e) => setTi(e.target.value)} />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Label>TF (Temp. Final)</Label>
                                        <Input type="number" value={tf} onChange={(e) => setTf(e.target.value)} />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Label>FR (Resfriamento)</Label>
                                        <Input type="number" value={fr} step={0.001} onChange={(e) => setFr(e.target.value)} />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="grid grid-cols-3 gap-2">
                            <Button variant="outline" onClick={handleGerarProblema}>
                                <Shuffle className="w-4 h-4 mr-1" /> Gerar Sprint
                            </Button>
                            <Button variant="outline" onClick={handleSolucaoInicial} disabled={!demandas}>
                                <RotateCcw className="w-4 h-4 mr-1" /> Sol. Inicial
                            </Button>
                            <Button onClick={handleExecutar} disabled={!demandas || !solucaoInicial || rodando}>
                                {rodando ? (
                                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}>
                                        <Zap className="w-4 h-4" />
                                    </motion.div>
                                ) : (
                                    <><Play className="w-4 h-4 mr-1" /> Executar</>
                                )}
                            </Button>
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
                                                    {solucaoInicial && <th className="text-center px-2 py-2 font-medium">Inicial</th>}
                                                    {resultado && <th className="text-center px-2 py-2 font-medium">Otimizado</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {demandas.map((d, i) => {
                                                    const naInicial = solucaoInicial?.[i] === 1;
                                                    const naFinal = resultado?.selecionadas.includes(i);
                                                    const mudou = solucaoInicial && resultado && naInicial !== naFinal;
                                                    return (
                                                        <tr key={d.id} className={`border-t ${mudou ? 'bg-primary/5' : ''}`}>
                                                            <td className="px-3 py-1.5">{d.nome}</td>
                                                            <td className="px-2 py-1.5 text-center">
                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${COR_PRIORIDADE[d.prioridade]}`}>
                                                                    {LABEL_PRIORIDADE[d.prioridade]}
                                                                </span>
                                                            </td>
                                                            <td className="px-2 py-1.5 text-center font-mono">{d.tempo}h</td>
                                                            {solucaoInicial && <td className="px-2 py-1.5 text-center">{naInicial ? '✅' : '—'}</td>}
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
                                            <tfoot>
                                                <tr className="border-t bg-muted/30">
                                                    <td colSpan={3} className="px-3 py-1.5 text-xs text-muted-foreground font-medium">
                                                        Pontuação / Horas usadas
                                                    </td>
                                                    {solucaoInicial && (
                                                        <td className="px-2 py-1.5 text-center text-xs font-mono">
                                                            {valorSI}pts / {totalHorasSI}h
                                                        </td>
                                                    )}
                                                    {resultado && (
                                                        <td className="px-2 py-1.5 text-center text-xs font-mono font-bold text-green-700 dark:text-green-400">
                                                            {resultado.valorTotal}pts / {resultado.tempoTotal}h
                                                        </td>
                                                    )}
                                                </tr>
                                            </tfoot>
                                        </table>
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
                                    Gere a sprint, defina a solução inicial e execute o algoritmo
                                </motion.p>
                            )}

                            {rodando && (
                                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="flex items-center justify-center gap-3 py-6">
                                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                        className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                                    <span className="text-sm text-muted-foreground">Otimizando sprint...</span>
                                </motion.div>
                            )}

                            {resultado && !rodando && (
                                <motion.div key="resultado"
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {metodoIcons[metodo]}
                                            <h3 className="font-semibold text-sm">{resultado.metodo}</h3>
                                        </div>
                                        {resultado.valorTotal > valorSI && (
                                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                                +{resultado.valorTotal - valorSI} pts vs. inicial
                                            </span>
                                        )}
                                        {resultado.valorTotal === valorSI && (
                                            <span className="text-xs text-muted-foreground">
                                                Igual à solução inicial (já era ótimo local)
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-4 gap-3">
                                        {[
                                            { label: 'Pontuação', value: resultado.valorTotal, color: 'text-green-600 dark:text-green-400' },
                                            { label: 'Demandas', value: resultado.selecionadas.length, color: 'text-blue-600 dark:text-blue-400' },
                                            { label: 'Horas usadas', value: `${resultado.tempoTotal}h`, color: 'text-orange-600 dark:text-orange-400' },
                                            { label: 'Iterações', value: resultado.iteracoes.toLocaleString(), color: 'text-purple-600 dark:text-purple-400' },
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
                                            <span>{resultado.tempoTotal}h / {cap}h ({Math.round((resultado.tempoTotal / cap) * 100)}%)</span>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.min(100, (resultado.tempoTotal / cap) * 100)}%` }}
                                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                                className={`h-full rounded-full ${resultado.tempoTotal / cap > 0.9 ? 'bg-green-500' : resultado.tempoTotal / cap > 0.7 ? 'bg-blue-500' : 'bg-orange-400'}`}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                                            Demandas selecionadas
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {resultado.selecionadas
                                                .sort((a, b) => demandas![a].prioridade - demandas![b].prioridade)
                                                .map((i) => {
                                                    const d = demandas![i];
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

                                    {resultado.historico.length > 1 && (
                                        <div className="rounded-lg border bg-muted/40 p-3">
                                            <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2">Convergência</p>
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
                                                            <span className="text-muted-foreground w-20">iter {h.iter}</span>
                                                            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                                                <motion.div
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${Math.min(100, (h.valor / (resultado.valorTotal || 1)) * 100)}%` }}
                                                                    transition={{ duration: 0.5, delay: idx * 0.05 }}
                                                                    className="h-full bg-primary rounded-full"
                                                                />
                                                            </div>
                                                            <span className="font-mono w-12 text-right text-muted-foreground">{h.valor}</span>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}