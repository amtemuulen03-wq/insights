export default function NavigationPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#829BEA]">Marketing Insight</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
          <a href="/insights/dashboard/campaign" className="mt-6 inline-flex rounded-xl bg-[#829BEA] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#718bdc]">
            Return to Campaign dashboard
          </a>
        </section>
      </div>
    </main>
  );
}
