import type { Metadata } from "next";
import { readFileSync, existsSync } from "node:fs";
import Panel from "@/components/Panel";

export const metadata: Metadata = {
    title: "Sinyal IDX",
    description: "Sinyal trading IDX hasil belajar mandiri (statistik + LLM) dari Signal Learner.",
};

// Titik ambil feed: URL (deploy terpisah) atau file lokal (self-host di mesin sama).
const FEED_PATH = process.env.SIGNAL_FEED_PATH || "C:/Users/Fandri/signal-learner/signal_feed.json";

type Decision = {
    date: string;
    ticker: string;
    stype: string;
    stat_proba: number | null;
    verdict: string;
    confidence: number | null;
    reason: string | null;
    outcome: number | null;
};

type Feed = {
    generated_at: string;
    strategy: string;
    stats: {
        signals_total: number;
        BUY: { auc: number | null; n: number | null };
        SELL: { auc: number | null; n: number | null };
        llm_accuracy: { n: number; win: number };
    };
    decisions: Decision[];
};

async function getFeed(): Promise<Feed | null> {
    const url = process.env.SIGNAL_FEED_URL;
    if (url) {
        try {
            const res = await fetch(url, { cache: "no-store" });
            if (res.ok) return (await res.json()) as Feed;
        } catch {
            /* lanjut ke fallback file */
        }
    }
    try {
        if (existsSync(FEED_PATH)) {
            return JSON.parse(readFileSync(FEED_PATH, "utf-8")) as Feed;
        }
    } catch {
        /* feed belum tersedia */
    }
    return null;
}

function pct(x: number | null | undefined): string {
    return x == null ? "—" : `${(x * 100).toFixed(0)}%`;
}

function verdictMeta(d: Decision): { label: string; cls: string } {
    if (d.verdict === "skip") return { label: "SKIP", cls: "text-zinc-400" };
    if (d.stype === "BUY") return { label: "TRADE", cls: "text-emerald-400" };
    return { label: "TRUST-AVOID", cls: "text-red-400" };
}

export default async function SignalsPage() {
    const feed = await getFeed();

    if (!feed) {
        return (
            <>
                <header className="page-head">
                    <div>
                        <h1 className="page-title">Sinyal IDX</h1>
                        <p className="page-sub">Belum ada feed — jalankan signal-learner dulu.</p>
                    </div>
                </header>
                <Panel title="Tidak ada data" sub="signal_feed.json belum dihasilkan">
                    <p className="text-sm text-zinc-400">
                        Jalankan <code className="text-zinc-200">run_daily.py</code> di{" "}
                        <code className="text-zinc-200">C:/Users/Fandri/signal-learner</code>, atau set{" "}
                        <code className="text-zinc-200">SIGNAL_FEED_URL</code>.
                    </p>
                </Panel>
            </>
        );
    }

    const { stats } = feed;
    const llmWin = stats.llm_accuracy.win;
    const llmN = stats.llm_accuracy.n;

    return (
        <>
            <header className="page-head">
                <div>
                    <h1 className="page-title">Sinyal IDX</h1>
                    <p className="page-sub">
                        {feed.strategy} · diperbarui {feed.generated_at.replace("T", " ")}
                    </p>
                </div>
            </header>

            {/* Statistik model */}
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Panel title="SELL · AUC" sub={`${stats.SELL.n ?? "—"} sinyal`}>
                    <p className="text-3xl font-semibold text-emerald-400">
                        {stats.SELL.auc != null ? stats.SELL.auc.toFixed(2) : "—"}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">kualitas pemilahan sinyal AVOID</p>
                </Panel>
                <Panel title="BUY · AUC" sub={`${stats.BUY.n ?? "—"} sinyal`}>
                    <p className="text-3xl font-semibold text-zinc-300">
                        {stats.BUY.auc != null ? stats.BUY.auc.toFixed(2) : "—"}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">≈0.5 berarti belum ada edge</p>
                </Panel>
                <Panel title="Akurasi LLM" sub="track record keputusan otak AI">
                    <p className="text-3xl font-semibold text-zinc-200">
                        {llmN > 0 ? `${llmWin}/${llmN}` : "—"}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                        {llmN > 0 ? `${pct(llmN ? llmWin / llmN : null)} benar (akumulasi harian)` : "belum ada hasil"}
                    </p>
                </Panel>
                <Panel title="Total sinyal" sub="dalam database">
                    <p className="text-3xl font-semibold text-zinc-200">{stats.signals_total}</p>
                    <p className="text-xs text-zinc-400 mt-1">sinyal bot yang dianalisis</p>
                </Panel>
            </section>

            {/* Keputusan harian */}
            <Panel
                title="Keputusan hari ini"
                sub="TRADE = ikuti beli · TRUST-AVOID = hindari · SKIP = lewati"
            >
                {feed.decisions.length === 0 ? (
                    <p className="text-sm text-zinc-400">Belum ada keputusan.</p>
                ) : (
                    <ul className="divide-y divide-zinc-800">
                        {feed.decisions.map((d) => {
                            const v = verdictMeta(d);
                            return (
                                <li key={d.date + d.ticker} className="py-3 first:pt-0 last:pb-0">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-baseline gap-2 min-w-0">
                                            <span className="font-mono font-semibold text-zinc-100">{d.ticker}</span>
                                            <span className={`text-xs font-medium ${d.stype === "BUY" ? "text-emerald-500" : "text-red-500"}`}>
                                                {d.stype}
                                            </span>
                                            <span className="text-xs text-zinc-500">{d.date}</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-xs text-zinc-500">P(benar) {pct(d.stat_proba)}</span>
                                            <span className={`text-xs font-bold ${v.cls}`}>{v.label}</span>
                                        </div>
                                    </div>
                                    {d.reason && (
                                        <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{d.reason}</p>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Panel>

            <p className="text-xs text-zinc-500 mt-2">
                Bukan rekomendasi jual/beli. Sinyal dihasilkan otomatis oleh Signal Learner (statistik + LLM).
            </p>
        </>
    );
}